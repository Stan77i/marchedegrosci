-- ═════════ Marché de Gros CI — schéma 43 : les « annonces du marché » (diffusion à tous les comptes) ═════════
-- Demandé par le propriétaire le 22/10/2026 :
--   • un achat groupé lancé → tous les comptes sont prévenus (ils peuvent le rejoindre) ;
--   • un approvisionnement professionnel publié → tous les comptes réguliers et bien identifiés (identité vérifiée)
--     sont prévenus : « Restaurant X s'approvisionne chaque mois : igname, tomate… ».
-- Garde-fous (pour que les gens ne coupent pas toutes les notifications) :
--   • l'achat groupé est annoncé quand il s'OUVRE (le vendeur a accepté), pas quand il est seulement proposé ;
--   • un besoin = UNE notification, quel que soit le nombre de produits ;
--   • (ajouté le même jour, après un essai du propriétaire : une demande de gombo n'avait prévenu personne) chaque nouvelle
--     offre ou demande prévient aussi tous les comptes ; ces notifications se REMPLACENT sur le téléphone (même étiquette) ;
--   • au plus 10 annonces du marché par personne et par jour (plafond passé par la fonction « pousser » ;
--     les notifications personnelles ne sont pas comptées) ;
--   • chacun peut couper les annonces du marché (Mon compte → Notifications), sans couper ses notifications personnelles ;
--   • jamais à soi-même, jamais aux comptes bannis ou supprimés ; seulement aux comptes qui ont activé les notifications.
-- Appliqué par Claude avec l'outil Supabase. Aucun drop, aucune donnée existante modifiée.

-- ——— 1) le réglage, côté serveur (le serveur doit savoir qui ne veut pas des annonces) ———
create table if not exists public.notif_reglages (
  user_id     uuid primary key references auth.users (id) on delete cascade,
  diffusions  boolean not null default true,
  updated_at  timestamptz not null default now()
);
alter table public.notif_reglages enable row level security;
revoke all on public.notif_reglages from anon, authenticated;

create or replace function public.notif_reglage_moi() returns json
language sql stable security definer set search_path = public as $$
  select json_build_object('diffusions', coalesce((select diffusions from public.notif_reglages where user_id = auth.uid()), true))
  where auth.uid() is not null;
$$;
create or replace function public.notif_reglage_diffusions(p_oui boolean) returns boolean
language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then raise exception 'Connectez-vous.'; end if;
  insert into public.notif_reglages (user_id, diffusions) values (auth.uid(), coalesce(p_oui, true))
  on conflict (user_id) do update set diffusions = excluded.diffusions, updated_at = now();
  return coalesce(p_oui, true);
end $$;
revoke execute on function public.notif_reglage_moi(), public.notif_reglage_diffusions(boolean) from public, anon;
grant execute on function public.notif_reglage_moi(), public.notif_reglage_diffusions(boolean) to authenticated;

-- ——— 2) le plafond du jour ———
create table if not exists public.push_diffusions_jour (
  user_id  uuid not null references auth.users (id) on delete cascade,
  jour     date not null,
  n        int not null default 0,
  primary key (user_id, jour)
);
alter table public.push_diffusions_jour enable row level security;
revoke all on public.push_diffusions_jour from anon, authenticated;

-- les destinataires d'une annonce du marché (réservé au rôle service : la fonction « pousser ») ;
-- compte UNE annonce pour chacun d'eux (plafond par jour, heure d'Abidjan = UTC)
create or replace function public.push_diffusion_cible(p_type text, p_exclure uuid[] default '{}', p_max_jour int default 3) returns setof uuid
language plpgsql security definer set search_path = public as $$
declare j date := (now() at time zone 'UTC')::date; u uuid;
begin
  if p_type not in ('groupe', 'besoin', 'annonce') then raise exception 'type inconnu'; end if;
  for u in
    select distinct a.user_id from public.push_abonnements a
    join public.profils p on p.user_id = a.user_id and p.supprime_le is null
    left join public.notif_reglages r on r.user_id = a.user_id
    left join public.push_diffusions_jour d on d.user_id = a.user_id and d.jour = j
    where coalesce(r.diffusions, true)
      and not (a.user_id = any (coalesce(p_exclure, '{}')))
      and coalesce(d.n, 0) < p_max_jour
      and not public.est_banni(a.user_id)
  loop
    if p_type = 'besoin' and not exists (select 1 from public.identite_verifiee(array[u]) i where i = u) then continue; end if;
    insert into public.push_diffusions_jour (user_id, jour, n) values (u, j, 1)
      on conflict (user_id, jour) do update set n = push_diffusions_jour.n + 1;
    return next u;
  end loop;
end $$;
revoke all on function public.push_diffusion_cible(text, uuid[], int) from public, anon, authenticated;
grant execute on function public.push_diffusion_cible(text, uuid[], int) to service_role;

-- ——— 3) un besoin publié → la fonction « pousser » (cas 12), une seule fois par besoin ———
create or replace function public.push_besoin() returns trigger
language plpgsql security definer set search_path = public, vault, extensions as $$
declare v_url text; v_cle text;
begin
  select decrypted_secret into v_url from vault.decrypted_secrets where name = 'mdg_push_url';
  select decrypted_secret into v_cle from vault.decrypted_secrets where name = 'mdg_push_cle';
  if v_url is null or v_cle is null then return new; end if;
  -- envoyé après la validation de la transaction : les lignes (demandes) du besoin existent alors
  perform net.http_post(url := v_url, body := jsonb_build_object('besoin_id', new.id), headers := jsonb_build_object('Content-Type', 'application/json', 'x-mdg-cle', v_cle), timeout_milliseconds := 8000);
  return new;
exception when others then return new;
end $$;
revoke all on function public.push_besoin() from public, anon, authenticated;
create or replace trigger besoins_push after insert on public.besoins for each row execute function public.push_besoin();
