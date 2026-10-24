-- ═════════ Schéma 96c (24/10/2026) — messages privés : un message renvoyé après une coupure n'arrive qu'une fois ═════════
-- Audit P2 n° 25 : dm_envoyer appelé deux fois avec le même texte (réponse perdue, nouvel essai) créait 2 messages identiques
-- (test de l'audit : 2 lignes). Correction :
--   • colonne dm.client_id : identifiant choisi par le téléphone pour chaque message (une seule fois, gardé dans sa file
--     d'attente) ; index unique (auteur_id, client_id) ;
--   • dm_envoyer(p_discussion, p_texte, p_client) : si ce message est déjà arrivé, le renvoie tel quel (« deja » = true)
--     sans le recréer ni le recompter ; sinon même contrôles qu'avant ;
--   • dm_envoyer(p_discussion, p_texte) (anciens téléphones) : passe par la nouvelle, sans identifiant.
-- Ajouts seulement (add column if not exists, create … if not exists, create or replace).

alter table public.dm add column if not exists client_id text;
create unique index if not exists dm_auteur_client on public.dm (auteur_id, client_id) where client_id is not null;

create or replace function public.dm_envoyer(p_discussion uuid, p_texte text, p_client text)
returns json language plpgsql security definer set search_path = public as $$
declare d public.discussions; v_autre uuid; v_t text := btrim(coalesce(p_texte, '')); r public.dm;
  v_c text := nullif(btrim(coalesce(p_client, '')), '');
begin
  if auth.uid() is null then raise exception 'Connectez-vous d''abord.'; end if;
  if v_c is not null and (char_length(v_c) > 64 or v_c !~ '^[A-Za-z0-9_-]+$') then raise exception 'Identifiant de message invalide.'; end if;
  -- déjà arrivé (réponse perdue, nouvel essai) : le même message, sans doublon
  if v_c is not null then
    select * into r from public.dm where auteur_id = auth.uid() and client_id = v_c;
    if r.id is not null then
      return json_build_object('id', r.id, 'created_at', r.created_at, 'auteur_id', r.auteur_id, 'texte', r.texte, 'deja', true);
    end if;
  end if;
  select * into d from public.discussions where id = p_discussion and auth.uid() in (a_id, b_id);
  if d.id is null then raise exception 'Conversation introuvable.'; end if;
  v_autre := case when d.a_id = auth.uid() then d.b_id else d.a_id end;
  if public.dm_bloque(auth.uid(), v_autre) then raise exception 'BLOQUE'; end if;
  if exists (select 1 from public.profils where user_id = v_autre and supprime_le is not null) then raise exception 'Ce compte n''existe plus.'; end if;
  if public._dm_mission_interdite(auth.uid(), v_autre) then
    raise exception 'Pendant une mission, le transporteur et les parties ne s''écrivent pas en privé. Le prix du transport se convient par propositions, dans la commande.';
  end if;
  if v_t = '' then raise exception 'Message vide.'; end if;
  if char_length(v_t) > 2000 then raise exception 'Message trop long (2 000 caractères au plus).'; end if;
  if (select count(*) from public.dm where auteur_id = auth.uid() and created_at > now() - interval '1 minute') >= 20 then raise exception 'TROP_VITE'; end if;
  if (select count(*) from public.dm where auteur_id = auth.uid() and created_at > now() - interval '1 day') >= 500 then raise exception 'TROP_VITE'; end if;
  begin
    insert into public.dm (discussion_id, auteur_id, texte, client_id) values (d.id, auth.uid(), v_t, v_c) returning * into r;
  exception when unique_violation then
    -- deux essais en même temps : le premier a gagné, on rend le sien
    select * into r from public.dm where auteur_id = auth.uid() and client_id = v_c;
    return json_build_object('id', r.id, 'created_at', r.created_at, 'auteur_id', r.auteur_id, 'texte', r.texte, 'deja', true);
  end;
  update public.discussions set updated_at = r.created_at, dernier_texte = left(r.texte, 140), dernier_par = auth.uid(),
    lu_a = case when a_id = auth.uid() then r.created_at else lu_a end, lu_b = case when b_id = auth.uid() then r.created_at else lu_b end,
    cache_a = case when a_id = auth.uid() then null else cache_a end, cache_b = case when b_id = auth.uid() then null else cache_b end
  where id = d.id;
  return json_build_object('id', r.id, 'created_at', r.created_at, 'auteur_id', r.auteur_id, 'texte', r.texte);
end $$;
revoke execute on function public.dm_envoyer(uuid, text, text) from public, anon;
grant execute on function public.dm_envoyer(uuid, text, text) to authenticated;

create or replace function public.dm_envoyer(p_discussion uuid, p_texte text)
returns json language sql security definer set search_path = public as $$
  select public.dm_envoyer(p_discussion, p_texte, null::text);
$$;
revoke execute on function public.dm_envoyer(uuid, text) from public, anon;
grant execute on function public.dm_envoyer(uuid, text) to authenticated;
