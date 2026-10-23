-- ═════════ Schéma 64 (23/10/2026) — lien de suivi : un code court en secours, et « le chauffeur a ouvert le lien » ═════════
-- Demande du propriétaire : le lien de suivi doit rester simple (pas de compte, pas d'application pour le chauffeur).
--   • chaque lien reçoit aussi un CODE COURT (ex. K7P-492) : le vendeur ou l'acheteur peut le dicter au téléphone ;
--     le chauffeur ouvre la page de suivi, tape le code, et le suivi démarre comme avec le lien ;
--   • l'ouverture du lien est notée (ouvert_le) : l'application affiche « Le chauffeur a ouvert le lien » avant la 1re position.
-- Aucun « drop » : colonnes ajoutées (if not exists), fonctions en create or replace, deux fonctions nouvelles.
-- Le code : 6 caractères tirés de 31 (sans 0/O, 1/I/L) → 887 millions de combinaisons ; il ne vit que tant que le lien est
-- actif (10 jours au plus, arrêt à la livraison) et ne donne accès qu'à ce que donne le lien (produit, trajet, envoyer sa position).

alter table public.suivi_liens add column if not exists code text;
alter table public.suivi_liens add column if not exists ouvert_le timestamptz;
create unique index if not exists suivi_liens_code on public.suivi_liens (code) where code is not null;

create or replace function public._suivi_code() returns text
language plpgsql volatile set search_path = public as $$
declare a text := 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'; c text; i int;
begin
  loop
    c := '';
    for i in 1..6 loop c := c || substr(a, 1 + floor(random() * length(a))::int, 1); end loop;
    c := left(c, 3) || '-' || right(c, 3);
    exit when not exists (select 1 from public.suivi_liens where code = c);
  end loop;
  return c;
end $$;
revoke execute on function public._suivi_code() from public, anon, authenticated;

-- les liens encore valables reçoivent leur code
update public.suivi_liens set code = public._suivi_code() where code is null and actif and expire_le > now();

create or replace function public.suivi_lien_creer(p_cmd uuid) returns text
language plpgsql volatile security definer set search_path = public as $$
declare me uuid := auth.uid(); c public.commandes; r text; j text;
begin
  if me is null then raise exception 'Connectez-vous d''abord.'; end if;
  select * into c from public.commandes where id = p_cmd;
  r := case when c.id is null then null else public._cmd_role2(c, me) end;
  if r is null or r not in ('vendeur', 'acheteur') then raise exception 'Commande introuvable.'; end if;
  if c.mode_transport = 'reseau' then raise exception 'Un transporteur du réseau suit la commande depuis son Espace chauffeur.'; end if;
  if c.mode_transport <> r then raise exception 'C''est % qui s''occupe du transport : c''est lui qui crée le lien.', case c.mode_transport when 'vendeur' then 'le vendeur' else 'l''acheteur' end; end if;
  if c.etat not in ('a_confirmer', 'en_cours') then raise exception 'La commande n''est plus en cours.'; end if;
  select jeton into j from public.suivi_liens where commande_id = c.id and actif and expire_le > now() order by created_at desc limit 1;
  if j is not null then
    update public.suivi_liens set code = public._suivi_code() where jeton = j and code is null;
    return j;
  end if;
  j := replace(gen_random_uuid()::text, '-', '');
  insert into public.suivi_liens (jeton, commande_id, cree_par, code) values (j, c.id, me, public._suivi_code());
  return j;
end $$;

-- état du lien pour l'application : le jeton et le code seulement pour celui qui transporte
create or replace function public.suivi_lien_etat(p_cmd uuid) returns json
language sql stable security definer set search_path = public as $$
  select case when c.id is null or public._cmd_role2(c, auth.uid()) not in ('vendeur', 'acheteur') then null else
    (select json_build_object('existe', true, 'vu_le', l.vu_le, 'ouvert_le', l.ouvert_le, 'created_at', l.created_at,
       'jeton', case when c.mode_transport = public._cmd_role2(c, auth.uid()) then l.jeton end,
       'code', case when c.mode_transport = public._cmd_role2(c, auth.uid()) then l.code end)
     from public.suivi_liens l where l.commande_id = c.id and l.actif and l.expire_le > now() order by l.created_at desc limit 1) end
  from (select 1) z left join public.commandes c on c.id = p_cmd;
$$;

-- page de suivi : le chauffeur tape le code → on lui rend le jeton du lien (rien d'autre)
create or replace function public.suivi_code_jeton(p_code text) returns text
language sql stable security definer set search_path = public as $$
  select l.jeton from public.suivi_liens l join public.commandes c on c.id = l.commande_id
  where replace(l.code, '-', '') = left(regexp_replace(upper(coalesce(p_code, '')), '[^A-Z0-9]', '', 'g'), 6)
    and length(regexp_replace(upper(coalesce(p_code, '')), '[^A-Z0-9]', '', 'g')) = 6
    and l.actif and l.expire_le > now() and c.etat in ('a_confirmer', 'en_cours')
  limit 1;
$$;

-- page de suivi : le chauffeur a ouvert le lien (la première fois seulement)
create or replace function public.suivi_lien_ouvert(p_jeton text) returns void
language sql volatile security definer set search_path = public as $$
  update public.suivi_liens set ouvert_le = now() where jeton = p_jeton and ouvert_le is null and actif and expire_le > now();
$$;

revoke execute on function public.suivi_code_jeton(text), public.suivi_lien_ouvert(text) from public;
grant execute on function public.suivi_code_jeton(text), public.suivi_lien_ouvert(text) to anon, authenticated;
