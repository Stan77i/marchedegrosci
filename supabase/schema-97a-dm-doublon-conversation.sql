-- Schéma 97a (étape 7, tests de bout en bout) : message privé envoyé deux fois — le doublon se cherche dans la MÊME conversation.
-- Avant (96c) : un identifiant de message (client_id) déjà utilisé par le même auteur dans une AUTRE conversation renvoyait
-- l'ancien message et n'écrivait rien (test dm-anti-doublon T3 : « autre conv lignes=0 »).
-- Maintenant : le doublon n'est reconnu que dans la même conversation. Si l'identifiant existe déjà ailleurs (collision rare),
-- le message est écrit avec l'identifiant suffixé par la conversation (l'index unique auteur + client_id reste en place).
-- Projet de TEST seulement tant que le propriétaire n'a pas donné son accord pour la production.

create or replace function public.dm_envoyer(p_discussion uuid, p_texte text, p_client text)
returns json
language plpgsql
security definer
set search_path to 'public'
as $$
declare d public.discussions; v_autre uuid; v_t text := btrim(coalesce(p_texte, '')); r public.dm;
  v_c text := nullif(btrim(coalesce(p_client, '')), ''); v_k text;
begin
  if auth.uid() is null then raise exception 'Connectez-vous d''abord.'; end if;
  if v_c is not null and (char_length(v_c) > 64 or v_c !~ '^[A-Za-z0-9_-]+$') then raise exception 'Identifiant de message invalide.'; end if;
  if v_c is not null then
    select * into r from public.dm
      where auteur_id = auth.uid() and discussion_id = p_discussion and client_id in (v_c, v_c || '.' || p_discussion::text)
      limit 1;
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
  -- identifiant déjà pris dans une autre conversation : on le rend propre à celle-ci
  v_k := v_c;
  if v_c is not null and exists (select 1 from public.dm where auteur_id = auth.uid() and client_id = v_c) then
    v_k := v_c || '.' || d.id::text;
  end if;
  begin
    insert into public.dm (discussion_id, auteur_id, texte, client_id) values (d.id, auth.uid(), v_t, v_k) returning * into r;
  exception when unique_violation then
    select * into r from public.dm where auteur_id = auth.uid() and client_id = v_k and discussion_id = d.id;
    if r.id is null then raise exception 'Message déjà envoyé ailleurs : réessayez.'; end if;
    return json_build_object('id', r.id, 'created_at', r.created_at, 'auteur_id', r.auteur_id, 'texte', r.texte, 'deja', true);
  end;
  update public.discussions set updated_at = r.created_at, dernier_texte = left(r.texte, 140), dernier_par = auth.uid(),
    lu_a = case when a_id = auth.uid() then r.created_at else lu_a end, lu_b = case when b_id = auth.uid() then r.created_at else lu_b end,
    cache_a = case when a_id = auth.uid() then null else cache_a end, cache_b = case when b_id = auth.uid() then null else cache_b end
  where id = d.id;
  return json_build_object('id', r.id, 'created_at', r.created_at, 'auteur_id', r.auteur_id, 'texte', r.texte);
end $$;
