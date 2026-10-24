-- Schéma 84b : fiabilité (chantier 2). Partie 2 : score, historique du membre, contestation, suspension, espace administrateur.
-- Le score public tient en une ligne (« Fiabilité : 96 % sur 25 commandes ») ; le détail n'est lu que par l'intéressé.
-- La suspension est toujours décidée par l'administrateur (7 jours, puis 30 en récidive) : annonces cachées pendant la suspension,
-- nouvelles annonces et nouvelles commandes refusées, commandes en cours qui continuent (est_banni n'est pas touché).
-- Testé sur le projet de test, pas encore appliqué en production.

-- 1. Les annonces cachées par une suspension gardent la trace de la suspension, pour être remises en ligne à la fin
alter table public.offres add column if not exists suspension_id uuid;
alter table public.demandes add column if not exists suspension_id uuid;

-- 2. Suspendu en ce moment ?
create or replace function public.est_suspendu(p_uid uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select p_uid is not null and exists (select 1 from public.sanctions s where s.user_id = p_uid and s.type = 'suspension'
    and s.levee_le is null and now() >= s.debut and now() < s.fin);
$$;
revoke all on function public.est_suspendu(uuid) from public, anon, authenticated;

-- 3. Le score : commandes réalisées contre annulations imputables (abusives et litiges perdus), depuis la mise en service.
--    Sur la fenêtre de 90 jours, 3 ou 4 abusives pèsent double (baisse du score), 5 et plus pèsent triple (pénalité renforcée).
create or replace function public._fiab_score(p_uid uuid)
returns json language plpgsql stable security definer set search_path = public as $$
declare t integer; i integer; n integer; poids integer; sur integer; pal text;
  sb integer := public._fiab_regle('seuil_baisse', 3); se integer := public._fiab_regle('seuil_examen', 5); sa integer := public._fiab_regle('seuil_avertissement', 1);
begin
  select count(*) into t from public.commandes c
  where p_uid in (c.vendeur_id, c.acheteur_id) and c.etat = 'terminee' and coalesce(c.termine_le, c.updated_at) >= public._fiab_debut();
  select count(distinct coalesce(a.groupe_id, a.commande_id)) into i from public.annulations a
  where a.imputable_id = p_uid and a.categorie in ('abusive', 'litige');
  n := public._fiab_n90(p_uid);
  poids := i + case when n >= se then 2 * n when n >= sb then n else 0 end;
  sur := t + i;
  pal := case when n >= se then 'examen' when n >= sb then 'baisse' when n >= sa then 'avertissement' else 'aucun' end;
  return json_build_object('pourcent', case when sur = 0 then null else round(100.0 * t / greatest(t + poids, 1))::integer end,
    'sur', sur, 'terminees', t, 'imputables', i, 'n90', n, 'palier', pal);
end $$;
revoke all on function public._fiab_score(uuid) from public, anon, authenticated;

-- 4. Le score public, sans aucun détail (pas de motif, pas d'avertissement)
create or replace function public.fiabilite_publique(p_uid uuid)
returns json language sql stable security definer set search_path = public as $$
  select json_build_object('pourcent', s -> 'pourcent', 'sur', s -> 'sur')
  from (select public._fiab_score(p_uid) s) x
  where p_uid is not null and not public.est_banni(p_uid) and not public.est_admin_id(p_uid);
$$;
revoke all on function public.fiabilite_publique(uuid) from public;
grant execute on function public.fiabilite_publique(uuid) to anon, authenticated;

-- 5. Mon historique de fiabilité (seulement le membre connecté)
create or replace function public.ma_fiabilite()
returns json language plpgsql stable security definer set search_path = public as $$
declare me uuid := auth.uid(); cj integer := public._fiab_regle('contestation_jours', 7);
begin
  if me is null then raise exception 'Connectez-vous.'; end if;
  return json_build_object(
    'score', public._fiab_score(me),
    'debut', public._fiab_debut(),
    'fenetre_jours', public._fiab_regle('fenetre_jours', 90),
    'seuils', json_build_object('avertissement', public._fiab_regle('seuil_avertissement', 1), 'baisse', public._fiab_regle('seuil_baisse', 3), 'examen', public._fiab_regle('seuil_examen', 5)),
    'contestation_jours', cj,
    'suspension', (select json_build_object('fin', s.fin, 'motif', s.motif) from public.sanctions s where s.user_id = me and s.type = 'suspension'
                   and s.levee_le is null and now() >= s.debut and now() < s.fin order by s.fin desc limit 1),
    'non_vues', (select count(*) from public.sanctions s where s.user_id = me and s.vue_le is null and s.levee_le is null),
    'annulations', coalesce((select json_agg(x order by x.cree_le desc) from (
      select a.id, a.cree_le, a.chemin, a.motif_code, a.motif_texte, a.categorie, a.accord, a.note_admin,
        k.numero, k.produit,
        case when a.vendeur_id = me then 'vendeur' else 'acheteur' end mon_role,
        a.imputable_id = me contre_moi, a.demandeur_id = me demande_par_moi,
        (a.imputable_id = me and a.categorie in ('abusive', 'litige') and t.id is null
          and now() <= greatest(a.cree_le, coalesce(a.decide_le, a.cree_le)) + make_interval(days => cj)) contestable,
        case when t.id is not null then json_build_object('statut', t.statut, 'texte', t.texte, 'reponse', t.reponse, 'cree_le', t.cree_le,
          'decide_le', t.decide_le, 'repondre_avant', t.repondre_avant) end contestation
      from public.annulations a
      left join public.commandes k on k.id = a.commande_id
      left join public.contestations t on t.annulation_id = a.id
      where me in (a.vendeur_id, a.acheteur_id)
      order by a.cree_le desc limit 100) x), '[]'::json),
    'sanctions', coalesce((select json_agg(y order by y.cree_le desc) from (
      select s.id, s.type, s.nb_90j, s.debut, s.fin, s.motif, s.levee_le, s.levee_motif, s.vue_le, s.cree_le
      from public.sanctions s where s.user_id = me order by s.cree_le desc limit 50) y), '[]'::json));
end $$;
revoke all on function public.ma_fiabilite() from public, anon;
grant execute on function public.ma_fiabilite() to authenticated;

create or replace function public.fiabilite_vu()
returns void language sql security definer set search_path = public as $$
  update public.sanctions set vue_le = now() where user_id = auth.uid() and vue_le is null;
$$;
revoke all on function public.fiabilite_vu() from public, anon;
grant execute on function public.fiabilite_vu() to authenticated;

-- 6. Contester une annulation comptée contre soi (7 jours ; l'équipe répond en 7 jours)
create or replace function public.contester_annulation(p_annulation uuid, p_texte text)
returns uuid language plpgsql security definer set search_path = public as $$
declare me uuid := auth.uid(); a public.annulations; t text; cid uuid;
begin
  if me is null then raise exception 'Connectez-vous.'; end if;
  if public.est_banni(me) then raise exception 'COMPTE_BANNI : ce compte a été banni du Marché de Gros.'; end if;
  select * into a from public.annulations where id = p_annulation;
  if a.id is null or a.imputable_id is distinct from me then raise exception 'Cette annulation ne compte pas contre vous.'; end if;
  if a.categorie not in ('abusive', 'litige') then raise exception 'Cette annulation ne compte pas contre vous.'; end if;
  if now() > greatest(a.cree_le, coalesce(a.decide_le, a.cree_le)) + make_interval(days => public._fiab_regle('contestation_jours', 7)) then
    raise exception 'Le délai pour contester est passé (% jours).', public._fiab_regle('contestation_jours', 7);
  end if;
  t := public._cmd_texte(p_texte, 600);
  if t is null or char_length(t) < 5 then raise exception 'Expliquez en quelques mots pourquoi.'; end if;
  insert into public.contestations (annulation_id, auteur_id, texte, repondre_avant)
  values (a.id, me, t, now() + make_interval(days => public._fiab_regle('reponse_jours', 7)))
  on conflict (annulation_id) do nothing returning id into cid;
  if cid is null then raise exception 'Vous avez déjà contesté cette annulation.'; end if;
  return cid;
end $$;
revoke all on function public.contester_annulation(uuid, text) from public, anon;
grant execute on function public.contester_annulation(uuid, text) to authenticated;

-- 7. Gardes de la suspension : pas de nouvelle annonce, pas de remise en ligne, pas de nouvelle négociation ni commande
create or replace function public._fiab_garde_annonce()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.status = 'active' and (tg_op = 'INSERT' or old.status is distinct from 'active') and public.est_suspendu(new.user_id) then
    raise exception 'COMPTE_SUSPENDU : votre compte est suspendu pour l''instant. Vos annonces reviendront à la fin de la suspension.';
  end if;
  return new;
end $$;
revoke all on function public._fiab_garde_annonce() from public, anon, authenticated;

create or replace function public._fiab_garde_nego()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if public.est_suspendu(new.auteur_id) then
    raise exception 'COMPTE_SUSPENDU : votre compte est suspendu pour l''instant. Vos commandes en cours continuent.';
  end if;
  if public.est_suspendu(new.proprio_id) then raise exception 'Ce membre est suspendu pour l''instant.'; end if;
  return new;
end $$;
revoke all on function public._fiab_garde_nego() from public, anon, authenticated;

create or replace function public._fiab_garde_commande()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.groupe_id is not null then return new; end if;   -- achat groupé déjà engagé : il continue
  if public.est_suspendu(auth.uid()) then
    raise exception 'COMPTE_SUSPENDU : votre compte est suspendu pour l''instant. Vos commandes en cours continuent.';
  end if;
  if public.est_suspendu(new.vendeur_id) or public.est_suspendu(new.acheteur_id) then
    raise exception 'Ce membre est suspendu pour l''instant : pas de nouvelle commande avec lui.';
  end if;
  return new;
end $$;
revoke all on function public._fiab_garde_commande() from public, anon, authenticated;

do $$ begin
  if not exists (select 1 from pg_trigger where tgname = 'offres_fiab_garde') then
    create trigger offres_fiab_garde before insert or update of status on public.offres for each row execute function public._fiab_garde_annonce();
  end if;
  if not exists (select 1 from pg_trigger where tgname = 'demandes_fiab_garde') then
    create trigger demandes_fiab_garde before insert or update of status on public.demandes for each row execute function public._fiab_garde_annonce();
  end if;
  if not exists (select 1 from pg_trigger where tgname = 'negociations_fiab_garde') then
    create trigger negociations_fiab_garde before insert on public.negociations for each row execute function public._fiab_garde_nego();
  end if;
  if not exists (select 1 from pg_trigger where tgname = 'commandes_fiab_garde') then
    create trigger commandes_fiab_garde before insert on public.commandes for each row execute function public._fiab_garde_commande();
  end if;
end $$;

-- 8. Remettre en ligne les annonces cachées par une suspension (fin, levée), sauf pour un compte banni
create or replace function public._fiab_rendre_annonces(p_sanction uuid)
returns void language plpgsql security definer set search_path = public as $$
declare s public.sanctions;
begin
  select * into s from public.sanctions where id = p_sanction;
  if s.id is null or s.annonces_rendues_le is not null then return; end if;
  if not public.est_banni(s.user_id) then
    update public.offres set status = 'active', suspension_id = null where suspension_id = s.id and status = 'masquee';
    update public.demandes set status = 'active', suspension_id = null where suspension_id = s.id and status = 'masquee';
  end if;
  update public.sanctions set annonces_rendues_le = now() where id = s.id;
end $$;
revoke all on function public._fiab_rendre_annonces(uuid) from public, anon, authenticated;

create or replace function public.suspensions_echues()
returns integer language plpgsql security definer set search_path = public as $$
declare s record; n integer := 0;
begin
  for s in select id from public.sanctions where type = 'suspension' and annonces_rendues_le is null
      and (levee_le is not null or fin <= now()) for update skip locked loop
    perform public._fiab_rendre_annonces(s.id); n := n + 1;
  end loop;
  return n;
end $$;
revoke all on function public.suspensions_echues() from public, anon, authenticated;

-- 9. Espace administrateur
create or replace function public._fiab_qui(p_uid uuid)
returns json language sql stable security definer set search_path = public as $$
  select json_build_object('id', p_uid, 'nom', coalesce(public.nom_public(p_uid), 'Membre'), 'tel', (select u.phone from auth.users u where u.id = p_uid));
$$;
revoke all on function public._fiab_qui(uuid) from public, anon, authenticated;

create or replace function public.admin_fiabilite()
returns json language plpgsql stable security definer set search_path = public as $$
declare se integer := public._fiab_regle('seuil_examen', 5);
begin
  if not public.est_admin() then raise exception 'Réservé à l''administration.'; end if;
  return json_build_object(
    'reglages', (select valeur from public.reglages where cle = 'fiabilite'),
    'examen', coalesce((select json_agg(z order by z.n90 desc) from (
      select u.uid, public._fiab_qui(u.uid) qui, public._fiab_n90(u.uid) n90, public._fiab_score(u.uid) score,
        public.est_suspendu(u.uid) suspendu,
        (select count(*) from public.sanctions s where s.user_id = u.uid and s.type = 'suspension') suspensions
      from (select distinct imputable_id uid from public.annulations where imputable_id is not null and categorie = 'abusive') u
      where public._fiab_n90(u.uid) >= se) z), '[]'::json),
    'contestations', coalesce((select json_agg(z order by z.ouverte desc, z.cree_le) from (
      select t.id, t.texte, t.statut, t.reponse, t.cree_le, t.decide_le, t.repondre_avant, t.statut = 'ouverte' ouverte,
        a.id annulation_id, a.categorie, a.chemin, a.motif_code, a.motif_texte, a.role_imputable, k.numero, k.produit,
        public._fiab_qui(t.auteur_id) qui
      from public.contestations t join public.annulations a on a.id = t.annulation_id left join public.commandes k on k.id = a.commande_id
      where t.statut = 'ouverte' or t.decide_le > now() - interval '30 days'
      order by t.cree_le desc limit 100) z), '[]'::json),
    'annulations', coalesce((select json_agg(z order by z.cree_le desc) from (
      select a.id, a.cree_le, a.chemin, a.motif_code, a.motif_texte, a.accord, a.categorie, a.categorie_auto, a.note_admin, a.decide_le,
        a.etat_avant, a.etape_avant, a.role_imputable, a.groupe_id, k.numero, k.produit,
        a.vendeur_id, a.acheteur_id, a.imputable_id, public._fiab_qui(a.vendeur_id) vendeur, public._fiab_qui(a.acheteur_id) acheteur
      from public.annulations a left join public.commandes k on k.id = a.commande_id
      order by a.cree_le desc limit 150) z), '[]'::json),
    'suspensions', coalesce((select json_agg(z order by z.fin) from (
      select s.id, s.user_id, s.debut, s.fin, s.motif, public._fiab_qui(s.user_id) qui
      from public.sanctions s where s.type = 'suspension' and s.levee_le is null and s.fin > now()) z), '[]'::json));
end $$;
revoke all on function public.admin_fiabilite() from public, anon;
grant execute on function public.admin_fiabilite() to authenticated;

-- requalifier une annulation (catégorie et personne imputable)
create or replace function public.admin_annulation_classer(p_id uuid, p_categorie text, p_imputable uuid default null, p_note text default null)
returns void language plpgsql security definer set search_path = public as $$
declare a public.annulations; nt text := left(nullif(btrim(coalesce(p_note, '')), ''), 300); imp uuid;
begin
  if not public.est_admin() then raise exception 'Réservé à l''administration.'; end if;
  if p_categorie not in ('abusive', 'legitime', 'litige', 'technique') then raise exception 'Catégorie inconnue.'; end if;
  select * into a from public.annulations where id = p_id for update;
  if a.id is null then raise exception 'Annulation introuvable.'; end if;
  if p_imputable is not null and p_imputable not in (a.vendeur_id, a.acheteur_id) then raise exception 'La personne doit être le vendeur ou l''acheteur.'; end if;
  imp := case when p_categorie in ('abusive', 'litige') then p_imputable end;
  if p_categorie = 'abusive' and imp is null then raise exception 'Une annulation abusive doit être imputée au vendeur ou à l''acheteur.'; end if;
  update public.annulations set categorie = p_categorie, imputable_id = imp,
    role_imputable = case when imp is null then null when imp = a.vendeur_id then 'vendeur' else 'acheteur' end,
    decide_par = auth.uid(), decide_le = now(), note_admin = coalesce(nt, note_admin) where id = a.id;
  -- la sanction liée suit la nouvelle catégorie (levée, ou recalculée), jamais en double
  update public.sanctions set levee_le = now(), levee_par = auth.uid(), levee_motif = 'Annulation requalifiée par l''équipe'
  where annulation_id = a.id and levee_le is null and (p_categorie <> 'abusive' or user_id is distinct from imp);
  if p_categorie = 'abusive' then
    update public.sanctions set user_id = imp where annulation_id = a.id and user_id is distinct from imp;
    perform public._fiab_paliers(imp, a.id);
  end if;
end $$;
revoke all on function public.admin_annulation_classer(uuid, text, uuid, text) from public, anon;
grant execute on function public.admin_annulation_classer(uuid, text, uuid, text) to authenticated;

-- répondre à une contestation : acceptée, l'annulation ne compte plus (légitime ou technique) ; refusée, elle reste
create or replace function public.admin_contestation_decider(p_id uuid, p_accepter boolean, p_reponse text, p_categorie text default 'legitime')
returns void language plpgsql security definer set search_path = public as $$
declare t public.contestations; r text := nullif(btrim(coalesce(p_reponse, '')), '');
begin
  if not public.est_admin() then raise exception 'Réservé à l''administration.'; end if;
  if r is null or char_length(r) > 600 then raise exception 'Écrivez la réponse (600 caractères au plus).'; end if;
  if p_accepter and p_categorie not in ('legitime', 'technique') then raise exception 'Catégorie inconnue.'; end if;
  select * into t from public.contestations where id = p_id for update;
  if t.id is null then raise exception 'Contestation introuvable.'; end if;
  if t.statut <> 'ouverte' then raise exception 'Cette contestation a déjà reçu une réponse.'; end if;
  update public.contestations set statut = case when p_accepter then 'acceptee' else 'refusee' end, reponse = r,
    decide_par = auth.uid(), decide_le = now() where id = t.id;
  if p_accepter then
    update public.annulations set categorie = p_categorie, imputable_id = null, role_imputable = null,
      decide_par = auth.uid(), decide_le = now(), note_admin = left('Contestation acceptée : ' || r, 300) where id = t.annulation_id;
    update public.sanctions set levee_le = now(), levee_par = auth.uid(), levee_motif = 'Contestation acceptée'
    where annulation_id = t.annulation_id and levee_le is null;
  end if;
end $$;
revoke all on function public.admin_contestation_decider(uuid, boolean, text, text) from public, anon;
grant execute on function public.admin_contestation_decider(uuid, boolean, text, text) to authenticated;

-- suspendre : 7 jours la première fois, 30 en récidive (réglables) ; annonces cachées, commandes en cours qui continuent
create or replace function public.admin_suspendre(p_user uuid, p_motif text, p_jours integer default null)
returns json language plpgsql security definer set search_path = public as $$
declare j integer; sid uuid; m text := nullif(btrim(coalesce(p_motif, '')), ''); f timestamptz; rec boolean;
begin
  if not public.est_admin() then raise exception 'Réservé à l''administration.'; end if;
  if p_user is null or public.est_admin_id(p_user) then raise exception 'Ce compte ne peut pas être suspendu.'; end if;
  if m is null or char_length(m) > 300 then raise exception 'Expliquez la décision (300 caractères au plus).'; end if;
  if public.est_suspendu(p_user) then raise exception 'Ce compte est déjà suspendu.'; end if;
  rec := exists (select 1 from public.sanctions where user_id = p_user and type = 'suspension');
  j := coalesce(p_jours, case when rec then public._fiab_regle('recidive_jours', 30) else public._fiab_regle('suspension_jours', 7) end);
  if j < 1 or j > 365 then raise exception 'Durée entre 1 et 365 jours.'; end if;
  f := now() + make_interval(days => j);
  insert into public.sanctions (user_id, type, debut, fin, motif, par, nb_90j)
  values (p_user, 'suspension', now(), f, m, auth.uid(), public._fiab_n90(p_user)) returning id into sid;
  update public.offres set status = 'masquee', suspension_id = sid where user_id = p_user and status = 'active';
  update public.demandes set status = 'masquee', suspension_id = sid where user_id = p_user and status = 'active';
  return json_build_object('id', sid, 'jours', j, 'fin', f, 'recidive', rec);
end $$;
revoke all on function public.admin_suspendre(uuid, text, integer) from public, anon;
grant execute on function public.admin_suspendre(uuid, text, integer) to authenticated;

create or replace function public.admin_suspension_lever(p_sanction uuid, p_motif text default null)
returns void language plpgsql security definer set search_path = public as $$
declare s public.sanctions;
begin
  if not public.est_admin() then raise exception 'Réservé à l''administration.'; end if;
  select * into s from public.sanctions where id = p_sanction and type = 'suspension' for update;
  if s.id is null then raise exception 'Suspension introuvable.'; end if;
  if s.levee_le is not null then raise exception 'Cette suspension est déjà levée.'; end if;
  update public.sanctions set levee_le = now(), levee_par = auth.uid(), levee_motif = left(nullif(btrim(coalesce(p_motif, '')), ''), 300) where id = s.id;
  perform public._fiab_rendre_annonces(s.id);
end $$;
revoke all on function public.admin_suspension_lever(uuid, text) from public, anon;
grant execute on function public.admin_suspension_lever(uuid, text) to authenticated;

-- changer les seuils et les durées (nombres entiers seulement, clés connues seulement)
create or replace function public.admin_fiabilite_regler(p_valeurs jsonb)
returns json language plpgsql security definer set search_path = public as $$
declare k text; v jsonb; cur jsonb;
begin
  if not public.est_admin() then raise exception 'Réservé à l''administration.'; end if;
  select valeur into cur from public.reglages where cle = 'fiabilite' for update;
  for k, v in select * from jsonb_each(coalesce(p_valeurs, '{}'::jsonb)) loop
    if k not in ('fenetre_jours', 'seuil_avertissement', 'seuil_baisse', 'seuil_examen', 'suspension_jours', 'recidive_jours',
                 'contestation_jours', 'reponse_jours', 'expiration_heures') then raise exception 'Réglage inconnu : %', k; end if;
    if jsonb_typeof(v) <> 'number' or (v #>> '{}')::numeric <> floor((v #>> '{}')::numeric) or (v #>> '{}')::numeric < 1 or (v #>> '{}')::numeric > 1000 then
      raise exception 'Valeur incorrecte pour %', k;
    end if;
    cur := jsonb_set(cur, array[k], v);
  end loop;
  if (cur ->> 'seuil_avertissement')::int > (cur ->> 'seuil_baisse')::int or (cur ->> 'seuil_baisse')::int > (cur ->> 'seuil_examen')::int then
    raise exception 'Les seuils doivent monter : avertissement, puis baisse, puis examen.';
  end if;
  update public.reglages set valeur = cur, maj_le = now(), maj_par = auth.uid() where cle = 'fiabilite';
  return cur::json;
end $$;
revoke all on function public.admin_fiabilite_regler(jsonb) from public, anon;
grant execute on function public.admin_fiabilite_regler(jsonb) to authenticated;

-- 10. Prévenir le membre : notification sur le téléphone (fonction « pousser »), gratuite
create or replace function public.push_fiabilite()
returns trigger language plpgsql security definer set search_path = public, vault, extensions as $$
declare v_url text; v_cle text; corps jsonb;
begin
  if tg_table_name = 'sanctions' then corps := jsonb_build_object('sanction_id', new.id);
  elsif tg_table_name = 'contestations' and new.statut <> 'ouverte' and old.statut = 'ouverte' then corps := jsonb_build_object('contestation_id', new.id);
  else return new; end if;
  select decrypted_secret into v_url from vault.decrypted_secrets where name = 'mdg_push_url';
  select decrypted_secret into v_cle from vault.decrypted_secrets where name = 'mdg_push_cle';
  if v_url is null or v_cle is null then return new; end if;
  perform net.http_post(url := v_url, body := corps,
    headers := jsonb_build_object('Content-Type', 'application/json', 'x-mdg-cle', v_cle), timeout_milliseconds := 8000);
  return new;
exception when others then return new;
end $$;
revoke all on function public.push_fiabilite() from public, anon, authenticated;
do $$ begin
  if not exists (select 1 from pg_trigger where tgname = 'sanctions_push') then
    create trigger sanctions_push after insert on public.sanctions for each row execute function public.push_fiabilite();
  end if;
  if not exists (select 1 from pg_trigger where tgname = 'contestations_push') then
    create trigger contestations_push after update of statut on public.contestations for each row execute function public.push_fiabilite();
  end if;
end $$;
