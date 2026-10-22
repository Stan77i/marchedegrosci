-- ═════════ Marché de Gros CI — schéma 45 : notifications « marketing » régulières (à la manière d'Orange Max it) ═════════
-- Demandé par le propriétaire le 22/10/2026. Ses choix (questions posées dans la session) :
--   • 30 par jour et par personne ;
--   • tous les comptes qui ont activé les notifications, avec l'interrupteur « Annonces du marché » pour les couper.
-- Règle maintenue par Claude (signalée au propriétaire) : AUCUN message faux (« une personne vous attend » sans que ce soit
-- vrai). Les messages sont tirés des vraies données du moment (offres, demandes, groupes, besoins, prix) ou présentent
-- une vraie fonction de l'application. Le texte est écrit par la fonction « pousser » (cas 13).
-- Garde-fous : entre 7 h et 21 h (heure d'Abidjan = UTC) ; la notification remplace la précédente sur le téléphone ;
-- compteur séparé de celui des annonces du marché ; le nombre par jour se change ici, sans toucher au code :
--   update public.marketing_reglage set max_jour = 12;   (0 = arrêt)
-- Appliqué par Claude avec l'outil Supabase. Aucun drop.

create table if not exists public.marketing_reglage (
  id             int primary key default 1 check (id = 1),
  max_jour       int not null default 30 check (max_jour between 0 and 60),
  debut_h        int not null default 7 check (debut_h between 0 and 23),
  fin_h          int not null default 21 check (fin_h between 1 and 24),
  dernier_envoi  timestamptz,
  numero         int not null default 0,   -- tour de rôle des sujets
  check (fin_h > debut_h)
);
insert into public.marketing_reglage (id) values (1) on conflict (id) do nothing;
alter table public.marketing_reglage enable row level security;
revoke all on public.marketing_reglage from anon, authenticated;
grant select, update on public.marketing_reglage to service_role;

create table if not exists public.push_marketing_jour (
  user_id  uuid not null references auth.users (id) on delete cascade,
  jour     date not null,
  n        int not null default 0,
  primary key (user_id, jour)
);
alter table public.push_marketing_jour enable row level security;
revoke all on public.push_marketing_jour from anon, authenticated;

-- destinataires d'un envoi marketing (rôle service) : notifications activées, interrupteur ouvert, ni banni ni supprimé,
-- sous le plafond du jour ; compte l'envoi pour chacun
create or replace function public.push_marketing_cible() returns setof uuid
language plpgsql security definer set search_path = public as $$
declare j date := (now() at time zone 'UTC')::date; mx int; u uuid;
begin
  select max_jour into mx from public.marketing_reglage where id = 1;
  if coalesce(mx, 0) <= 0 then return; end if;
  for u in
    select distinct a.user_id from public.push_abonnements a
    join public.profils p on p.user_id = a.user_id and p.supprime_le is null
    left join public.notif_reglages r on r.user_id = a.user_id
    left join public.push_marketing_jour d on d.user_id = a.user_id and d.jour = j
    where coalesce(r.diffusions, true) and coalesce(d.n, 0) < mx and not public.est_banni(a.user_id)
  loop
    insert into public.push_marketing_jour (user_id, jour, n) values (u, j, 1)
      on conflict (user_id, jour) do update set n = push_marketing_jour.n + 1;
    return next u;
  end loop;
end $$;
revoke all on function public.push_marketing_cible() from public, anon, authenticated;
grant execute on function public.push_marketing_cible() to service_role;

-- l'horloge : toutes les 10 minutes, on envoie si l'intervalle est écoulé ((fin − début) / max_jour)
create or replace function public.marketing_tick() returns text
language plpgsql security definer set search_path = public, vault, extensions as $$
declare r public.marketing_reglage; h int := extract(hour from now() at time zone 'UTC'); pas interval; v_url text; v_cle text;
begin
  select * into r from public.marketing_reglage where id = 1 for update;
  if r.max_jour <= 0 or h < r.debut_h or h >= r.fin_h then return 'hors plage'; end if;
  pas := make_interval(mins => floor((r.fin_h - r.debut_h) * 60.0 / r.max_jour)::int) - interval '2 minutes';
  if r.dernier_envoi is not null and now() - r.dernier_envoi < pas then return 'trop tôt'; end if;
  select decrypted_secret into v_url from vault.decrypted_secrets where name = 'mdg_push_url';
  select decrypted_secret into v_cle from vault.decrypted_secrets where name = 'mdg_push_cle';
  if v_url is null or v_cle is null then return 'pas de clé'; end if;
  update public.marketing_reglage set dernier_envoi = now(), numero = numero + 1 where id = 1;
  perform net.http_post(url := v_url, body := jsonb_build_object('marketing', true, 'numero', r.numero + 1),
    headers := jsonb_build_object('Content-Type', 'application/json', 'x-mdg-cle', v_cle), timeout_milliseconds := 30000);
  return 'envoyé n°' || (r.numero + 1);
end $$;
revoke all on function public.marketing_tick() from public, anon, authenticated;

do $$ begin
  if not exists (select 1 from cron.job where jobname = 'mdg-marketing') then
    perform cron.schedule('mdg-marketing', '*/10 * * * *', 'select public.marketing_tick()');
  end if;
end $$;
