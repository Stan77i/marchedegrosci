-- ═════════ Schéma 75 (23/10/2026) — alertes « nouvelle annonce » : au plus 10 par membre et par jour ═════════
-- Faille trouvée à l'audit : chaque nouvelle offre ou demande prévient TOUS les abonnés du produit (push_annonce → pousser),
-- sans plafond : un membre pouvait publier, retirer, republier en boucle et inonder les téléphones des autres.
-- Correction : au plus 10 annonces par membre et par jour (heure d'Abidjan = UTC) déclenchent l'alerte ;
-- au-delà, l'annonce est publiée normalement, simplement sans alerte. Compteur dans push_annonce_jour (une ligne par membre et par jour).
-- Le reste de push_annonce est identique. Aucun « drop » (create table if not exists, create or replace).

create table if not exists public.push_annonce_jour (
  user_id uuid not null,
  jour    date not null,
  n       int  not null default 0,
  primary key (user_id, jour)
);
alter table public.push_annonce_jour enable row level security;
revoke all on public.push_annonce_jour from anon, authenticated;

create or replace function public.push_annonce() returns trigger
language plpgsql security definer set search_path to 'public', 'vault', 'extensions' as $function$
declare v_url text; v_cle text; v_n int;
begin
  if not exists (select 1 from public.alertes_produits a where a.product_slug = new.product_slug and a.user_id <> new.user_id
                 and ((tg_table_name = 'offres' and a.offres) or (tg_table_name = 'demandes' and a.demandes))) then return new; end if;
  -- plafond : 10 alertes « nouvelle annonce » par membre et par jour
  insert into public.push_annonce_jour as j (user_id, jour, n) values (new.user_id, (now() at time zone 'UTC')::date, 1)
  on conflict (user_id, jour) do update set n = j.n + 1 returning j.n into v_n;
  if v_n > 10 then return new; end if;
  select decrypted_secret into v_url from vault.decrypted_secrets where name = 'mdg_push_url';
  select decrypted_secret into v_cle from vault.decrypted_secrets where name = 'mdg_push_cle';
  if v_url is null or v_cle is null then return new; end if;
  perform net.http_post(url := v_url, body := jsonb_build_object('annonce', tg_table_name, 'id', new.id),
    headers := jsonb_build_object('Content-Type', 'application/json', 'x-mdg-cle', v_cle), timeout_milliseconds := 8000);
  return new;
exception when others then return new;
end $function$;
