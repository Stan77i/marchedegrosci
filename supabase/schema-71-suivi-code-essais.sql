-- ═════════ Schéma 71 (23/10/2026) — code de suivi du chauffeur : essais limités, tirage sûr ═════════
-- Faille trouvée à l'audit : suivi_code_jeton (ouverte à tous, sans compte) n'avait aucune limite d'essais ;
-- en essayant des codes à la chaîne, on pouvait tomber sur un lien actif (adresse de livraison, envoi de fausses positions).
-- Correction :
--   • au plus 10 codes FAUX par adresse internet et par quart d'heure, et 500 codes faux par quart d'heure pour tout le monde
--     (protection contre une attaque venue de nombreuses adresses) ; un code juste ne compte pas ;
--   • au-delà : « TROP_ESSAIS : … » (la page du chauffeur affiche le message) ;
--   • compteurs dans une table de taille FIXE (4 096 cases au plus, réutilisées à chaque quart d'heure) : aucun nettoyage à prévoir ;
--   • _suivi_code tire les caractères avec un générateur cryptographique (gen_random_bytes) au lieu de random().
-- Les codes existants restent valables. Aucun « drop » : create table if not exists, create or replace.

create table if not exists public.suivi_code_essais (
  case_n   int primary key,          -- case du compteur : adresse internet hachée sur 12 bits, ou -1 pour le total
  periode  bigint not null,          -- numéro du quart d'heure
  n        int not null default 0    -- codes faux dans ce quart d'heure
);
alter table public.suivi_code_essais enable row level security;
revoke all on public.suivi_code_essais from anon, authenticated;

create or replace function public._suivi_code() returns text
language plpgsql volatile set search_path = public as $$
declare a text := 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'; b bytea; c text; i int;
begin
  loop
    b := extensions.gen_random_bytes(6); c := '';
    -- 256 n'est pas un multiple de 31 : on jette les octets ≥ 248 (8 × 31) pour garder un tirage égal
    for i in 0..5 loop
      while get_byte(b, i) >= 248 loop b := overlay(b placing extensions.gen_random_bytes(1) from i + 1 for 1); end loop;
      c := c || substr(a, 1 + get_byte(b, i) % 31, 1);
    end loop;
    c := left(c, 3) || '-' || right(c, 3);
    exit when not exists (select 1 from public.suivi_liens where code = c);
  end loop;
  return c;
end $$;
revoke execute on function public._suivi_code() from public, anon, authenticated;

create or replace function public.suivi_code_jeton(p_code text) returns text
language plpgsql volatile security definer set search_path = public as $$
declare
  h json := nullif(current_setting('request.headers', true), '')::json;
  ip text := coalesce(nullif(trim(split_part(coalesce(h ->> 'x-forwarded-for', ''), ',', 1)), ''), h ->> 'cf-connecting-ip', 'inconnue');
  per bigint := floor(extract(epoch from now()) / 900);
  case_ip int := hashtext(ip) & 4095;
  v text := regexp_replace(upper(coalesce(p_code, '')), '[^A-Z0-9]', '', 'g');
  j text;
begin
  if exists (select 1 from public.suivi_code_essais where case_n = case_ip and periode = per and n >= 10)
     or exists (select 1 from public.suivi_code_essais where case_n = -1 and periode = per and n >= 500) then
    raise exception 'TROP_ESSAIS : Trop de codes essayés. Réessayez dans quelques minutes, ou demandez le lien au vendeur.';
  end if;
  if length(v) = 6 then
    select l.jeton into j from public.suivi_liens l join public.commandes c on c.id = l.commande_id
    where replace(l.code, '-', '') = v and l.actif and l.expire_le > now() and c.etat in ('a_confirmer', 'en_cours')
    limit 1;
  end if;
  if j is null then
    insert into public.suivi_code_essais as e (case_n, periode, n) values (case_ip, per, 1), (-1, per, 1)
    on conflict (case_n) do update set n = case when e.periode = excluded.periode then e.n + 1 else 1 end, periode = excluded.periode;
  end if;
  return j;
end $$;
revoke execute on function public.suivi_code_jeton(text) from public;
grant execute on function public.suivi_code_jeton(text) to anon, authenticated;
