-- ═════════ Schéma 72 (23/10/2026) — code de secours : les essais ratés sont enfin comptés ═════════
-- Faille trouvée à l'audit : reinitialiser_code notait l'échec dans secours_essais PUIS levait une erreur,
-- ce qui annulait la note (la table comptait 0 ligne) : la limite de 5 essais par heure ne servait à rien,
-- n'importe qui pouvait faire calculer du bcrypt à la base sans fin, et le temps de réponse révélait quels numéros ont un compte.
-- Correction, sans réécrire reinitialiser_code (elle reste telle quelle et fait toujours le changement du code) :
--   • nouvelle porte d'entrée secours_reinitialiser(tel, cle, nouveau), appelée par l'application :
--       – limites : 5 échecs par numéro et par heure (comptés pour de vrai), 20 par adresse internet et par heure,
--         300 par heure pour tout le monde ;
--       – code de secours faux : l'échec est noté, la réponse est vide (pas d'erreur, donc la note reste) ;
--       – code juste : elle appelle reinitialiser_code, comme avant ;
--       – même temps de réponse que le numéro ait un compte ou non (calcul leurre) ;
--   • reinitialiser_code n'est plus appelable directement par les téléphones (seulement par cette porte).
-- Compteurs par adresse dans une table de taille fixe (4 096 cases + le total). Aucun « drop ».

create table if not exists public.secours_ip_essais (
  case_n   int primary key,          -- adresse internet hachée sur 12 bits, ou -1 pour le total
  periode  bigint not null,          -- numéro de l'heure
  n        int not null default 0    -- échecs dans cette heure
);
alter table public.secours_ip_essais enable row level security;
revoke all on public.secours_ip_essais from anon, authenticated;

create or replace function public.secours_reinitialiser(tel text, cle text, nouveau text) returns text
language plpgsql volatile security definer set search_path = public, extensions as $$
declare
  t text := regexp_replace(coalesce(tel, ''), '\D', '', 'g');
  h json := nullif(current_setting('request.headers', true), '')::json;
  ip text := coalesce(nullif(trim(split_part(coalesce(h ->> 'x-forwarded-for', ''), ',', 1)), ''), h ->> 'cf-connecting-ip', 'inconnue');
  per bigint := floor(extract(epoch from now()) / 3600);
  case_ip int := hashtext(ip) & 4095;
  u uuid; hs text; rates int; bon boolean;
begin
  if length(t) = 13 and left(t, 3) = '225' then t := substr(t, 4); end if;
  if t !~ '^[0-9]{10}$' then raise exception 'Numéro à 10 chiffres, par exemple 07 01 02 03 04.'; end if;
  if coalesce(nouveau, '') !~ '^[0-9]{6}$' then raise exception 'Le nouveau code secret fait 6 chiffres.'; end if;
  if nouveau ~ '^(\d)\1{5}$' or nouveau in ('123456', '654321') then raise exception 'Code trop facile à deviner : évitez 123456 ou 6 fois le même chiffre.'; end if;
  if exists (select 1 from public.secours_ip_essais where case_n = case_ip and periode = per and n >= 20)
     or exists (select 1 from public.secours_ip_essais where case_n = -1 and periode = per and n >= 300) then
    raise exception 'Trop d''essais depuis ce téléphone. Réessayez dans une heure, ou appelez le Marché de Gros.';
  end if;
  select count(*) into rates from public.secours_essais e where e.tel = t and not e.ok and e.at > now() - interval '1 hour';
  if rates >= 5 then raise exception 'Trop d''essais. Réessayez dans une heure, ou appelez le Marché de Gros.'; end if;
  select id into u from auth.users where email = '225' || t || '@tel.marchedegros.ci';
  select s.hash into hs from public.secours s where s.user_id = u;
  if hs is null then
    perform crypt('leurre', gen_salt('bf', 8));   -- même temps de réponse que pour un vrai compte
    bon := false;
  else
    bon := crypt(upper(regexp_replace(coalesce(cle, ''), '[^A-Za-z0-9]', '', 'g')), hs) = hs;
  end if;
  if not bon then
    insert into public.secours_essais (tel, ok) values (t, false);
    insert into public.secours_ip_essais as e (case_n, periode, n) values (case_ip, per, 1), (-1, per, 1)
    on conflict (case_n) do update set n = case when e.periode = excluded.periode then e.n + 1 else 1 end, periode = excluded.periode;
    return null;   -- l'application affiche « Numéro ou code de secours incorrect. »
  end if;
  return public.reinitialiser_code(tel, cle, nouveau);
end $$;
revoke execute on function public.secours_reinitialiser(text, text, text) from public;
grant execute on function public.secours_reinitialiser(text, text, text) to anon, authenticated;
revoke execute on function public.reinitialiser_code(text, text, text) from public, anon, authenticated;
