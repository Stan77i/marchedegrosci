-- ═════════ Marché de Gros CI — schéma 58 : règles du séquestre précisées par le propriétaire (22/10/2026) ═════════
-- Ses réponses :
--   • « Paiement à la livraison » reste écrit : c'est vrai. Le séquestre (en construction) sécurise le vendeur contre les
--     « plaisantins » qui font venir un camion puis refusent de payer ;
--   • commissions : 3,5 % pour le vendeur, 6,9 % pour le transporteur que nous connectons (inchangé) ;
--   • PAS de libération automatique : seul l'acheteur libère, quand il valide qu'il n'y a aucun problème.
--     Garde-fou : après 48 h sans réponse, la commande arrive dans la file de l'équipe, qui peut libérer (admin_liberer) ;
--   • l'acheteur ne peut PAS annuler une commande confirmée. Il doit attendre l'arrivée, prendre des photos, et le refus
--     se discute à trois : l'acheteur, le vendeur et le Marché de Gros (litige_messages) ;
--   • le chauffeur peut ne pas être sur la plateforme : sa confirmation ne compte que s'il est INTÉGRÉ (inscrit sur
--     l'application ET vérifié par l'équipe). Sinon, c'est à l'équipe de juger ;
--   • le vendeur glisse un MOT SECRET (écrit sur un papier) dans la marchandise ; l'acheteur le tape et le photographie
--     au refus : cela prouve que c'est bien le colis du vendeur et qu'il l'a reçu.
-- Appliqué par Claude avec l'outil Supabase. Aucun drop, aucune donnée effacée.

-- ——— 1) Le mot secret du vendeur ———
alter table public.commandes add column if not exists mot_secret text;
alter table public.commandes add column if not exists mot_essais integer not null default 0;
alter table public.commandes add column if not exists refus_mot text;      -- 'retrouve' | 'absent'
do $$ begin
  alter table public.commandes add constraint commandes_refus_mot_check check (refus_mot is null or refus_mot in ('retrouve', 'absent'));
exception when duplicate_object then null; end $$;

create or replace function public._mot_tirer() returns text
language sql volatile set search_path = public as $$
  select (array['MANGUE','ANANAS','IGNAME','MANIOC','GOMBO','PIMENT','TOMATE','BANANE','ARACHIDE','CAFE','CACAO','ATTIEKE',
                'PAPAYE','CITRON','AVOCAT','KARITE','SORGHO','COCO','ANACARDE','AUBERGINE','OIGNON','CAROTTE','PATATE','TARO'])[1 + floor(random() * 24)::int]
         || ' ' || (10 + floor(random() * 90)::int)::text;
$$;
revoke all on function public._mot_tirer() from public, anon, authenticated;

-- tiré une fois, quand la commande est confirmée
create or replace function public._cmd_mot() returns trigger
language plpgsql set search_path = public as $$
begin
  if new.etat = 'en_cours' and new.mot_secret is null then new.mot_secret := public._mot_tirer(); end if;
  return new;
end $$;
revoke all on function public._cmd_mot() from public, anon, authenticated;
create or replace trigger commandes_mot before insert or update of etat on public.commandes
  for each row execute function public._cmd_mot();

-- comparaison souple : majuscules, sans accents ni espaces
create or replace function public._mot_norm(t text) returns text
language sql immutable set search_path = public as $$
  select upper(regexp_replace(translate(coalesce(t, ''), 'àâäéèêëîïôöùûüçÀÂÄÉÈÊËÎÏÔÖÙÛÜÇ', 'aaaeeeeiioouuucAAAEEEEIIOOUUUC'), '[^A-Za-z0-9]', '', 'g'));
$$;
revoke all on function public._mot_norm(text) from public, anon, authenticated;

-- ——— 2) Le chauffeur « intégré » : inscrit sur l'application ET vérifié par l'équipe ———
-- (le nom reste _cmd_chauffeur_independant : il est déjà utilisé par plusieurs fonctions ; la règle change)
create or replace function public._cmd_chauffeur_independant(c public.commandes) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.transporteurs t where t.id = c.transporteur_id and t.user_id is not null and t.statut = 'verifie');
$$;
revoke all on function public._cmd_chauffeur_independant(public.commandes) from public, anon, authenticated;

-- ——— 3) L'acheteur ne peut plus annuler une commande confirmée ———
create or replace function public.commande_annuler(p_id uuid, p_oui boolean default true, p_note text default null) returns text
language plpgsql volatile security definer set search_path = public as $$
declare me uuid := auth.uid(); c public.commandes; r text; nt text;
begin
  select * into c from public.commandes where id = p_id for update;
  r := public._cmd_role(c, me);
  if c.id is null or r is null then raise exception 'Commande introuvable.'; end if;
  if public.est_banni(me) then raise exception 'COMPTE_BANNI : ce compte a été banni du Marché de Gros.'; end if;
  nt := public._cmd_texte(p_note, 300);
  -- avant la confirmation, celui qui a créé la commande peut la retirer seul
  if c.etat = 'a_confirmer' then
    if me <> c.cree_par then raise exception 'Répondez plutôt à la commande (confirmer ou refuser).'; end if;
    update public.commandes set etat = 'annulee' where id = p_id;
    perform public._cmd_journal(p_id, 'annulee', me, r, 'declaration', null, null, null, nt);
    return 'annulee';
  end if;
  if c.etat <> 'en_cours' then raise exception 'Cette commande n''est pas en cours.'; end if;
  if c.etape not in ('confirmee', 'preparation') then raise exception 'La marchandise est chargée : l''annulation n''est plus possible.'; end if;
  if not p_oui then
    if c.annulation_par is null or c.annulation_par = me then raise exception 'Il n''y a pas de demande d''annulation à refuser.'; end if;
    update public.commandes set annulation_par = null where id = p_id;
    perform public._cmd_journal(p_id, 'annulation_refusee', me, r, 'declaration', null, null, null, nt);
    return 'en_cours';
  end if;
  if c.annulation_par = me then raise exception 'Vous avez déjà demandé l''annulation. L''autre partie doit l''accepter.'; end if;
  if c.annulation_par is null then
    -- seul le vendeur peut DEMANDER l'annulation d'une commande confirmée ; l'acheteur peut seulement l'accepter
    if me = c.acheteur_id then raise exception 'Commande confirmée : l''acheteur ne peut plus l''annuler. À l''arrivée, vous pourrez refuser la marchandise avec des photos.'; end if;
    update public.commandes set annulation_par = me where id = p_id;
    perform public._cmd_journal(p_id, 'annulation_demandee', me, r, 'declaration', null, null, null, nt);
    return 'annulation_demandee';
  end if;
  update public.commandes set etat = 'annulee' where id = p_id;
  perform public._cmd_journal(p_id, 'annulee', me, r, 'declaration', null, null, null, nt);
  perform public._cmd_rendre_stock(c);
  return 'annulee';
end $$;

-- ——— 4) Refuser : à l'arrivée ou après la réception, tant que rien n'est libéré ; mot secret + photos ———
-- retour : 'ok' · 'mot_incorrect:N' (N essais restants) · 'mot_bloque'
create or replace function public.commande_refuser2(p_id uuid, p_quantite numeric, p_motif text, p_photos text[], p_mot text default null, p_sans_mot boolean default false) returns text
language plpgsql volatile security definer set search_path = public as $$
declare me uuid := auth.uid(); c public.commandes; m text; x text; q numeric; mot text;
begin
  select * into c from public.commandes where id = p_id for update;
  if c.id is null or me is distinct from c.acheteur_id then raise exception 'Seul l''acheteur peut refuser la marchandise.'; end if;
  if public.est_banni(me) then raise exception 'COMPTE_BANNI : ce compte a été banni du Marché de Gros.'; end if;
  if not ((c.etat = 'en_cours' and c.etape = 'arrivee') or (c.etat = 'terminee' and c.libere_le is null)) then
    raise exception 'Le refus se fait quand le chauffeur est arrivé, ou après la réception, tant que le paiement n''est pas libéré.';
  end if;
  m := public._cmd_texte(p_motif, 300);
  if m is null then raise exception 'Expliquez le problème (marchandise gâtée, abîmée, quantité manquante…).'; end if;
  if p_photos is null or cardinality(p_photos) < 1 or cardinality(p_photos) > 4 then raise exception 'Ajoutez de 1 à 4 photos : la marchandise, et le papier du vendeur.'; end if;
  foreach x in array p_photos loop
    if split_part(x, '/', 1) <> me::text or not exists (select 1 from storage.objects o where o.bucket_id = 'preuves' and o.name = x) then
      raise exception 'Photo introuvable : renvoyez-la.';
    end if;
  end loop;
  if p_quantite is not null and p_quantite <= 0 then raise exception 'Quantité refusée invalide.'; end if;
  -- le mot secret du vendeur
  if c.mot_secret is not null and not coalesce(p_sans_mot, false) then
    if c.mot_essais >= 5 then return 'mot_bloque'; end if;
    if public._mot_norm(p_mot) <> public._mot_norm(c.mot_secret) then
      update public.commandes set mot_essais = mot_essais + 1 where id = c.id;
      return case when c.mot_essais + 1 >= 5 then 'mot_bloque' else 'mot_incorrect:' || (5 - c.mot_essais - 1) end;
    end if;
    mot := 'retrouve';
  elsif c.mot_secret is not null then
    mot := 'absent';
  end if;
  q := case when p_quantite is null or c.quantite is null or p_quantite >= c.quantite then null else p_quantite end;
  update public.commandes set etat = 'litige', litige_par = me, litige_motif = m, litige_le = now(),
    refus_quantite = q, refus_motif = m, refus_photos = p_photos, refus_le = now(), refus_mot = mot,
    refus_chauffeur = null, refus_chauffeur_le = null, refus_vendeur = null, refus_vendeur_le = null where id = c.id;
  perform public._seq_journal(c.id, 'refus', me, 'acheteur',
    case when q is null then 'toute la marchandise' else q || ' ' || coalesce(c.unite, '') end || ' : ' || m
    || case mot when 'retrouve' then ' · mot du vendeur retrouvé' when 'absent' then ' · papier du vendeur absent' else '' end);
  perform public._cmd_journal(c.id, 'litige', me, 'acheteur', 'declaration', null, null, null, 'Marchandise refusée : ' || m);
  return 'ok';
end $$;

-- l'ancienne version (sans mot secret) renvoie vers la nouvelle
create or replace function public.commande_refuser(p_id uuid, p_quantite numeric, p_motif text, p_photos text[]) returns void
language plpgsql volatile security definer set search_path = public as $$
begin raise exception 'Mettez l''application à jour (fermez-la et rouvrez-la) pour refuser la marchandise.'; end $$;

-- appliquer : la commande se termine (même refusée à l'arrivée), la partie refusée revient à l'acheteur
create or replace function public._cmd_refus_appliquer(p_id uuid, p_par uuid, p_role text, p_note text) returns void
language plpgsql security definer set search_path = public as $$
declare c public.commandes; mr numeric;
begin
  select * into c from public.commandes where id = p_id for update;
  mr := case when c.refus_quantite is null or c.quantite is null or c.quantite = 0 then round(c.montant, 0)
             else least(round(c.refus_quantite * c.prix_unitaire, 0), round(c.montant, 0)) end;
  update public.commandes set etat = 'terminee', etape = 'terminee', termine_le = coalesce(termine_le, now()),
    libere_le = now(), liberation = 'refus', montant_refuse = mr where id = c.id;
  perform public._seq_journal(c.id, 'refus_applique', p_par, p_role, mr || ' F rendus à l''acheteur · ' || coalesce(p_note, ''));
  perform public._cmd_journal(c.id, 'terminee', p_par, p_role, 'declaration', null, null, null,
    'Refus confirmé : ' || mr || ' F pour l''acheteur' || case when mr < round(c.montant, 0) then ', le reste pour le vendeur' else '' end);
end $$;
revoke all on function public._cmd_refus_appliquer(uuid, uuid, text, text) from public, anon, authenticated;

-- le chauffeur : sa confirmation ne compte seule que s'il est intégré ET que le mot du vendeur a été retrouvé
create or replace function public.commande_refus_chauffeur(p_id uuid, p_oui boolean, p_note text default null) returns text
language plpgsql volatile security definer set search_path = public as $$
declare me uuid := auth.uid(); c public.commandes; nt text;
begin
  select * into c from public.commandes where id = p_id for update;
  if c.id is null or not exists (select 1 from public.transporteurs t where t.id = c.transporteur_id and t.user_id = me) then raise exception 'Commande introuvable.'; end if;
  if c.etat <> 'litige' or c.refus_le is null then raise exception 'Aucun refus à confirmer sur cette commande.'; end if;
  if c.refus_chauffeur is not null then raise exception 'Vous avez déjà répondu.'; end if;
  nt := public._cmd_texte(p_note, 300);
  update public.commandes set refus_chauffeur = case when p_oui then 'confirme' else 'conteste' end, refus_chauffeur_le = now() where id = c.id;
  perform public._seq_journal(c.id, case when p_oui then 'refus_chauffeur_confirme' else 'refus_chauffeur_conteste' end, me, 'chauffeur', nt);
  if p_oui and public._cmd_chauffeur_independant(c) and coalesce(c.refus_mot, 'retrouve') = 'retrouve' then
    perform public._cmd_refus_appliquer(c.id, me, 'chauffeur', 'confirmé par le chauffeur intégré');
    return 'applique';
  end if;
  return 'equipe';
end $$;

-- ——— 5) Pas de libération automatique : l'équipe peut libérer une commande restée sans réponse ———
select cron.unschedule('mdg-liberer-echus') where exists (select 1 from cron.job where jobname = 'mdg-liberer-echus');

create or replace function public.admin_liberer(p_cmd uuid, p_note text) returns void
language plpgsql volatile security definer set search_path = public as $$
declare c public.commandes; nt text := nullif(btrim(coalesce(p_note, '')), '');
begin
  if not public.est_admin() then raise exception 'Réservé à l''administration.'; end if;
  if nt is null or char_length(nt) > 300 then raise exception 'Expliquez la décision (300 caractères au plus).'; end if;
  select * into c from public.commandes where id = p_cmd for update;
  if c.id is null or c.etat <> 'terminee' or c.libere_le is not null then raise exception 'Rien à libérer sur cette commande.'; end if;
  update public.commandes set libere_le = now(), liberation = 'admin' where id = c.id;
  perform public._cmd_journal(c.id, 'terminee', auth.uid(), 'admin', 'admin', null, null, null, 'Paiement libéré par l''équipe : ' || nt);
end $$;

-- ——— 6) La discussion à trois (acheteur, vendeur, Marché de Gros) pendant un litige ———
create table if not exists public.litige_messages (
  id           bigint generated always as identity primary key,
  commande_id  uuid not null references public.commandes (id) on delete cascade,
  auteur_id    uuid,
  role         text not null check (role in ('acheteur', 'vendeur', 'admin')),
  texte        text not null check (char_length(texte) between 1 and 600),
  at           timestamptz not null default now()
);
create index if not exists litige_messages_c on public.litige_messages (commande_id, at);
alter table public.litige_messages enable row level security;
revoke all on public.litige_messages from anon, authenticated;
create or replace trigger litige_messages_fige before update on public.litige_messages
  for each row execute function public._seq_fige();

create or replace function public.litige_messages_lire(p_cmd uuid) returns json
language plpgsql stable security definer set search_path = public as $$
declare me uuid := auth.uid(); c public.commandes; adm boolean := public.est_admin();
begin
  select * into c from public.commandes where id = p_cmd;
  if c.id is null or me is null or not (me in (c.vendeur_id, c.acheteur_id) or adm) then return null; end if;
  return json_build_object(
    'ouvert', c.etat = 'litige',
    'messages', (select coalesce(json_agg(json_build_object('role', m.role, 'texte', m.texte, 'at', m.at, 'moi', m.auteur_id = me) order by m.at), '[]'::json)
                 from public.litige_messages m where m.commande_id = c.id));
end $$;

create or replace function public.litige_ecrire(p_cmd uuid, p_texte text) returns void
language plpgsql volatile security definer set search_path = public as $$
declare me uuid := auth.uid(); c public.commandes; t text := btrim(coalesce(p_texte, '')); r text; refus text;
begin
  select * into c from public.commandes where id = p_cmd;
  if c.id is null or me is null then raise exception 'Commande introuvable.'; end if;
  -- une partie de la commande écrit sous son rôle, même si son compte est administrateur (correctif 58b)
  r := case when me = c.acheteur_id then 'acheteur' when me = c.vendeur_id then 'vendeur' when public.est_admin() then 'admin' end;
  if r is null then raise exception 'Commande introuvable.'; end if;
  if r <> 'admin' and public.est_banni(me) then raise exception 'COMPTE_BANNI : ce compte a été banni du Marché de Gros.'; end if;
  if c.etat <> 'litige' then raise exception 'La discussion est close : le litige est réglé.'; end if;
  if t = '' then raise exception 'Écrivez votre message.'; end if;
  if char_length(t) > 600 then raise exception '600 caractères au plus.'; end if;
  if r <> 'admin' then refus := public.texte_refus(t); if refus is not null then raise exception '%', refus; end if; end if;
  insert into public.litige_messages (commande_id, auteur_id, role, texte) values (c.id, me, r, t);
  update public.commandes set updated_at = now() where id = c.id;
end $$;

-- notification aux deux autres (fonction Edge « pousser », { litige_msg_id })
create or replace function public.push_litige_msg() returns trigger
language plpgsql security definer set search_path = public, vault, extensions as $$
declare v_url text; v_cle text;
begin
  select decrypted_secret into v_url from vault.decrypted_secrets where name = 'mdg_push_url';
  select decrypted_secret into v_cle from vault.decrypted_secrets where name = 'mdg_push_cle';
  if v_url is null or v_cle is null then return new; end if;
  perform net.http_post(url := v_url, body := jsonb_build_object('litige_msg_id', new.id),
    headers := jsonb_build_object('Content-Type', 'application/json', 'x-mdg-cle', v_cle), timeout_milliseconds := 8000);
  return new;
exception when others then return new;
end $$;
revoke all on function public.push_litige_msg() from public, anon, authenticated;
create or replace trigger litige_messages_push after insert on public.litige_messages for each row execute function public.push_litige_msg();

-- ——— 7) Lire le séquestre : le mot secret (vendeur et équipe seulement), plus d'échéance automatique ———
create or replace function public.commande_sequestre(p_id uuid) returns json
language plpgsql stable security definer set search_path = public as $$
declare me uuid := auth.uid(); c public.commandes; r text; rep json; s public.sequestres;
begin
  select * into c from public.commandes where id = p_id;
  if c.id is null or me is null then return null; end if;
  r := public._cmd_role2(c, me);
  if r is null and public.est_admin() then r := 'admin'; end if;
  if r is null then return null; end if;
  rep := public._seq_repartition(c.id);
  select * into s from public.sequestres where commande_id = c.id;
  return json_build_object(
    'role', r,
    'actif', s.id is not null,
    'etat', coalesce(s.etat, 'non_ouvert'), 'operateur', s.operateur, 'depose_le', s.depose_le, 'solde_le', s.solde_le,
    'libere_le', c.libere_le, 'liberation', c.liberation, 'echeance', null, 'montant_refuse', c.montant_refuse,
    'sans_reponse', c.etat = 'terminee' and c.libere_le is null and c.termine_le < now() - interval '48 hours',
    'mot', case when r in ('vendeur', 'admin') then c.mot_secret end,
    'avec_mot', c.mot_secret is not null,
    'repartition', case when r = 'chauffeur' then json_build_object('transporteur_brut', rep->'transporteur_brut', 'transporteur_commission', rep->'transporteur_commission', 'transporteur_net', rep->'transporteur_net') else rep end,
    'refus', case when c.refus_le is null then null else json_build_object(
      'le', c.refus_le, 'quantite', c.refus_quantite, 'unite', c.unite, 'motif', c.refus_motif, 'photos', c.refus_photos, 'mot', c.refus_mot,
      'chauffeur', c.refus_chauffeur, 'chauffeur_le', c.refus_chauffeur_le, 'vendeur', c.refus_vendeur, 'vendeur_le', c.refus_vendeur_le,
      'chauffeur_suffit', public._cmd_chauffeur_independant(c) and coalesce(c.refus_mot, 'retrouve') = 'retrouve',
      'a_chauffeur', exists (select 1 from public.transporteurs t where t.id = c.transporteur_id and t.user_id is not null)) end,
    'peut_liberer', r = 'acheteur' and c.etat = 'terminee' and c.libere_le is null,
    'peut_refuser', r = 'acheteur' and ((c.etat = 'en_cours' and c.etape = 'arrivee') or (c.etat = 'terminee' and c.libere_le is null)),
    'mot_bloque', c.mot_essais >= 5,
    'peut_constater', r = 'chauffeur' and c.etat = 'litige' and c.refus_le is not null and c.refus_chauffeur is null,
    'peut_repondre', r = 'vendeur' and c.etat = 'litige' and c.refus_le is not null and c.refus_vendeur is null);
end $$;

-- ——— 8) File de l'équipe : les commandes reçues sans réponse de l'acheteur depuis 48 h ———
create or replace function public.admin_commandes(p_vue text default 'a_traiter') returns json
language plpgsql stable security definer set search_path = public as $$
begin
  if not public.est_admin() then raise exception 'Réservé à l''administration.'; end if;
  return (select coalesce(json_agg(x order by x.maj desc), '[]'::json) from (
    select c.id, c.numero, c.etat, c.etape, c.produit, c.quantite, c.unite, c.montant, c.commission_montant, c.mode_transport,
      c.ville_depart, c.lieu_livraison, c.litige_motif, c.litige_le, c.updated_at maj,
      coalesce(public.nom_public(c.vendeur_id), 'Membre') vendeur, coalesce(public.nom_public(c.acheteur_id), 'Membre') acheteur,
      (select json_build_object('id', m.id, 'statut', m.statut, 'nom', t.nom, 'prix', m.prix, 'avec_application', t.user_id is not null) from public.transport_missions m join public.transporteurs t on t.id = m.transporteur_id
        where m.commande_id = c.id order by m.created_at desc limit 1) mission,
      case when c.refus_le is null then null else json_build_object('le', c.refus_le, 'quantite', c.refus_quantite, 'motif', c.refus_motif, 'photos', c.refus_photos, 'mot', c.refus_mot,
        'chauffeur', c.refus_chauffeur, 'vendeur', c.refus_vendeur, 'chauffeur_suffit', public._cmd_chauffeur_independant(c)) end refus,
      c.libere_le, c.liberation, c.montant_refuse, c.mot_secret,
      (c.etat = 'terminee' and c.libere_le is null and c.termine_le < now() - interval '48 hours') sans_reponse
    from public.commandes c
    where case p_vue
      when 'a_traiter' then c.etat = 'litige'
        or (c.etat = 'terminee' and c.libere_le is null and c.termine_le < now() - interval '48 hours')
        or (c.mode_transport = 'reseau' and c.etat in ('a_confirmer', 'en_cours') and coalesce(c.etape, 'confirmee') in ('confirmee', 'preparation')
            and not exists (select 1 from public.transport_missions m where m.commande_id = c.id and m.statut in ('proposee', 'acceptee')))
        or (c.etat in ('a_confirmer', 'en_cours') and coalesce(c.etape, 'confirmee') in ('confirmee', 'preparation')
            and exists (select 1 from public.transport_missions m join public.transporteurs t on t.id = m.transporteur_id
                        where m.commande_id = c.id and m.statut = 'acceptee' and m.prix is null and t.user_id is null))
      when 'en_cours' then c.etat in ('a_confirmer', 'en_cours')
      else true end
    order by c.updated_at desc limit 300) x);
end $$;

-- ——— 9) Droits ———
revoke execute on function public.commande_refuser2(uuid, numeric, text, text[], text, boolean), public.admin_liberer(uuid, text),
  public.litige_messages_lire(uuid), public.litige_ecrire(uuid, text) from public, anon;
grant execute on function public.commande_refuser2(uuid, numeric, text, text[], text, boolean), public.admin_liberer(uuid, text),
  public.litige_messages_lire(uuid), public.litige_ecrire(uuid, text) to authenticated;

-- ——— 10) Commandes déjà en cours : elles reçoivent leur mot secret (le vendeur le voit dans sa commande) ———
update public.commandes set mot_secret = public._mot_tirer() where etat = 'en_cours' and mot_secret is null;
