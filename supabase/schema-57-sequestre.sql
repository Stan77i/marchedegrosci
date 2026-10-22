-- ═════════ Marché de Gros CI — schéma 57 : séquestre, libération du paiement et refus de la marchandise ═════════
-- Demandé par le propriétaire le 22/10/2026 (notes vocales + réponse écrite) :
--   • l'argent est BLOQUÉ chez un partenaire financier (Wave, Orange Money, MTN MoMo) dès que la commande est confirmée ;
--   • c'est l'ACHETEUR qui libère, après réception et vérification de la marchandise ;
--   • à la libération, chacun reçoit sa part : le vendeur (moins 3,5 %), le transporteur s'il y en a un (moins 6,9 %) ;
--   • le Marché de Gros n'est payé QU'À LA LIBÉRATION ;
--   • l'acheteur ne peut pas annuler une commande confirmée (l'annulation reste possible seulement d'un commun accord,
--     avant le chargement, comme avant : le vendeur doit l'accepter, il ne perd donc rien) ;
--   • après réception, si la marchandise est gâtée : l'acheteur refuse, avec des photos ; le chauffeur confirme dans
--     l'application ; le remboursement se fait sans intervention de l'équipe ;
--   • l'équipe ne lit pas les conversations : en cas de problème, elle s'appuie sur le numéro de commande et les accords enregistrés.
--
-- AUCUN PARTENAIRE N'EST ENCORE CONNECTÉ. Rien n'est prélevé, rien n'est bloqué, rien n'est versé :
--   • une ligne « sequestres » n'est créée QUE par sequestre_depot_confirme(), réservée au service (future fonction Edge qui
--     vérifiera la notification signée du partenaire). Aucun membre, ni l'application, ni l'admin ne peut l'appeler ;
--   • sans cette ligne, l'application affiche « Paiement sécurisé : bientôt » et « paiement à la livraison, hors application » ;
--   • les registres de commission gardent encaissement = 'aucun'.
-- Ce qui marche DÈS MAINTENANT, sans argent : la libération (l'acheteur confirme, ou 48 h passent), le refus avec photos,
-- la confirmation du chauffeur ou du vendeur, l'arbitrage de l'équipe. Les commissions deviennent « dues » à la libération.
--
-- Garde-fou ajouté (à valider par le propriétaire) : la confirmation du chauffeur suffit seule si le chauffeur n'a PAS été
-- choisi par l'acheteur. Un chauffeur choisi par l'acheteur pourrait s'entendre avec lui contre le vendeur : dans ce cas,
-- il faut que le vendeur reconnaisse le problème, sinon l'équipe tranche.
--
-- Appliqué par Claude avec l'outil Supabase. Aucun drop, aucune donnée effacée.

-- ——— 1) La commande garde la trace de la libération et du refus ———
alter table public.commandes add column if not exists libere_le timestamptz;
alter table public.commandes add column if not exists liberation text;
alter table public.commandes add column if not exists montant_refuse numeric not null default 0;
alter table public.commandes add column if not exists refus_quantite numeric;
alter table public.commandes add column if not exists refus_motif text;
alter table public.commandes add column if not exists refus_photos text[];
alter table public.commandes add column if not exists refus_le timestamptz;
alter table public.commandes add column if not exists refus_chauffeur text;
alter table public.commandes add column if not exists refus_chauffeur_le timestamptz;
alter table public.commandes add column if not exists refus_vendeur text;
alter table public.commandes add column if not exists refus_vendeur_le timestamptz;
do $$ begin
  alter table public.commandes add constraint commandes_liberation_check check (liberation is null or liberation in ('conforme', 'auto', 'refus', 'admin'));
exception when duplicate_object then null; end $$;
do $$ begin
  alter table public.commandes add constraint commandes_montant_refuse_check check (montant_refuse >= 0);
exception when duplicate_object then null; end $$;
do $$ begin
  alter table public.commandes add constraint commandes_refus_check check (
    (refus_motif is null or char_length(refus_motif) <= 300)
    and (refus_photos is null or cardinality(refus_photos) between 1 and 4)
    and (refus_quantite is null or refus_quantite > 0)
    and (refus_chauffeur is null or refus_chauffeur in ('confirme', 'conteste'))
    and (refus_vendeur is null or refus_vendeur in ('reconnu', 'conteste')));
exception when duplicate_object then null; end $$;

-- ——— 2) Le séquestre (argent réellement bloqué chez le partenaire) — vide tant qu'aucun partenaire n'est connecté ———
create table if not exists public.sequestres (
  id               uuid primary key default gen_random_uuid(),
  commande_id      uuid not null unique references public.commandes (id) on delete cascade,
  operateur        text not null check (operateur in ('wave', 'orange', 'mtn', 'moov')),
  reference        text not null check (char_length(reference) between 1 and 120),
  montant          numeric not null check (montant > 0),
  etat             text not null default 'bloque' check (etat in ('bloque', 'libere', 'partage', 'rembourse')),
  depose_le        timestamptz not null default now(),
  solde_le         timestamptz,
  unique (operateur, reference)
);
-- ce que le séquestre doit verser au moment où il est soldé (le virement réel viendra du partenaire)
create table if not exists public.sequestre_versements (
  id               uuid primary key default gen_random_uuid(),
  sequestre_id     uuid not null references public.sequestres (id) on delete cascade,
  beneficiaire     text not null check (beneficiaire in ('vendeur', 'transporteur', 'acheteur', 'marche')),
  user_id          uuid,
  brut             numeric not null check (brut >= 0),
  commission       numeric not null default 0 check (commission >= 0),
  net              numeric not null check (net >= 0),
  statut           text not null default 'a_verser' check (statut in ('a_verser', 'verse', 'echec')),
  reference        text,
  created_at       timestamptz not null default now(),
  verse_le         timestamptz
);
create index if not exists sequestre_versements_s on public.sequestre_versements (sequestre_id);
-- tout ce qui arrive au refus et au séquestre, horodaté ; ne se modifie pas
create table if not exists public.sequestre_journal (
  id               bigint generated always as identity primary key,
  commande_id      uuid not null references public.commandes (id) on delete cascade,
  evenement        text not null check (evenement in ('depot', 'liberee', 'liberee_auto', 'refus', 'refus_chauffeur_confirme', 'refus_chauffeur_conteste',
                                                     'refus_vendeur_reconnu', 'refus_vendeur_conteste', 'refus_applique', 'refus_admin', 'solde', 'rembourse')),
  par              uuid,
  role             text not null check (role in ('vendeur', 'acheteur', 'chauffeur', 'admin', 'systeme')),
  note             text check (char_length(note) <= 300),
  at               timestamptz not null default now()
);
create index if not exists sequestre_journal_c on public.sequestre_journal (commande_id, at);

alter table public.sequestres enable row level security;
alter table public.sequestre_versements enable row level security;
alter table public.sequestre_journal enable row level security;
revoke all on public.sequestres, public.sequestre_versements, public.sequestre_journal from anon, authenticated;

create or replace function public._seq_fige() returns trigger
language plpgsql set search_path = public as $$
begin raise exception 'Ce journal ne se modifie pas.'; end $$;
revoke all on function public._seq_fige() from public, anon, authenticated;
create or replace trigger sequestre_journal_fige before update on public.sequestre_journal
  for each row execute function public._seq_fige();

create or replace function public._seq_journal(p_cmd uuid, p_ev text, p_par uuid, p_role text, p_note text default null) returns void
language sql security definer set search_path = public as $$
  insert into public.sequestre_journal (commande_id, evenement, par, role, note, at) values (p_cmd, p_ev, p_par, p_role, left(p_note, 300), clock_timestamp());
  update public.commandes set updated_at = now() where id = p_cmd;
$$;
revoke all on function public._seq_journal(uuid, text, uuid, text, text) from public, anon, authenticated;

-- ——— 3) La répartition : qui reçoit quoi à la libération (calculée ici seulement) ———
-- transport compté dans le séquestre seulement s'il est payé à part (mission acceptée avec un prix, transport non compris
-- dans le prix du vendeur) ; s'il est compris, le vendeur paie lui-même son transporteur, comme aujourd'hui (schéma 50).
create or replace function public._seq_repartition(p_cmd uuid) returns json
language plpgsql stable security definer set search_path = public as $$
declare c public.commandes; m public.transport_missions; marchandise numeric; tr numeric := 0; refuse numeric; vb numeric; vk numeric; tk numeric := 0;
begin
  select * into c from public.commandes where id = p_cmd;
  if c.id is null or c.montant is null then return null; end if;
  marchandise := round(c.montant, 0);
  if not public._cmd_transport_inclus(c.id) then
    select * into m from public.transport_missions where commande_id = c.id and statut = 'acceptee' and prix is not null order by created_at desc limit 1;
    if m.id is not null then tr := round(m.prix, 0); tk := round(tr * 0.069, 0); end if;
  end if;
  refuse := least(round(coalesce(c.montant_refuse, 0), 0), marchandise);
  vb := marchandise - refuse;
  vk := case when public.est_admin_id(c.vendeur_id) then 0 else round(vb * 0.035, 0) end;
  return json_build_object(
    'marchandise', marchandise, 'transport', tr, 'total', marchandise + tr,
    'vendeur_brut', vb, 'vendeur_commission', vk, 'vendeur_net', vb - vk,
    'transporteur_brut', tr, 'transporteur_commission', tk, 'transporteur_net', tr - tk,
    'acheteur_rembourse', refuse, 'marche', vk + tk,
    'transporteur_user', (select t.user_id from public.transporteurs t where t.id = m.transporteur_id));
end $$;
revoke all on function public._seq_repartition(uuid) from public, anon, authenticated;

-- ——— 4) Les commissions ne sont dues qu'à la libération ———
create or replace function public._commission_sync() returns trigger
language plpgsql security definer set search_path = public as $$
declare s text; m numeric; k numeric; old_c public.commissions; motif text;
begin
  if new.montant is null or public.est_admin_id(new.vendeur_id) then return new; end if;
  m := greatest(round(new.montant, 0) - round(coalesce(new.montant_refuse, 0), 0), 0);
  s := case
         when new.etat = 'terminee' and new.libere_le is not null then case when m = 0 then 'annulee' else 'due' end
         when new.etat = 'litige' then 'suspendue'
         when new.etat = 'annulee' then 'annulee'
         else 'prevue' end;                    -- reçue mais pas encore libérée : toujours « prévue »
  k := round(m * 0.035, 0);
  select * into old_c from public.commissions where commande_id = new.id for update;
  if old_c.id is null then
    insert into public.commissions (commande_id, vendeur_id, acheteur_id, montant_vente, commission, statut)
      values (new.id, new.vendeur_id, new.acheteur_id, m, k, s) returning * into old_c;
    insert into public.commission_journal (commission_id, statut, montant_vente, commission, motif)
      values (old_c.id, s, m, k, 'commande ' || new.numero || ' : ' || new.etat);
  elsif old_c.statut <> s or old_c.montant_vente <> m then
    motif := 'commande ' || new.numero || ' : ' || old_c.statut || ' → ' || s
      || case when new.libere_le is not null and new.etat = 'terminee' then ' (libération' || case when m < round(new.montant, 0) then ', ' || round(new.montant_refuse, 0) || ' F refusés' else '' end || ')' else '' end;
    update public.commissions set statut = s, montant_vente = m, commission = k, updated_at = now() where id = old_c.id;
    insert into public.commission_journal (commission_id, statut, montant_vente, commission, motif)
      values (old_c.id, s, m, k, motif);
  end if;
  return new;
end $$;
revoke all on function public._commission_sync() from public, anon, authenticated;
create or replace trigger commission_sync after insert or update of etat, montant, libere_le, montant_refuse on public.commandes
  for each row execute function public._commission_sync();

-- transport : dû à la libération, même si la marchandise est refusée (le chauffeur a fait son travail)
create or replace function public._ctr_sync(p_mission uuid) returns void
language plpgsql security definer set search_path = public as $$
declare m public.transport_missions; c public.commandes; o public.commissions_transport; s text; p numeric; k numeric;
begin
  select * into m from public.transport_missions where id = p_mission;
  if m.id is null then return; end if;
  select * into o from public.commissions_transport where mission_id = m.id for update;
  -- pas (ou plus) de mission acceptée avec un prix, ou transport compris dans le prix du vendeur (schéma 50) : la ligne est annulée
  if m.statut <> 'acceptee' or m.prix is null or public._cmd_transport_inclus(m.commande_id) then
    if o.id is not null and o.statut <> 'annulee' then
      update public.commissions_transport set statut = 'annulee', updated_at = now() where id = o.id;
      insert into public.commission_transport_journal (commission_id, statut, prix_transport, commission, motif)
        values (o.id, 'annulee', o.prix_transport, o.commission, 'mission ' || m.statut || (case when m.prix is null then ', sans prix' when m.statut = 'acceptee' then ', transport compris dans le prix du vendeur' else '' end));
    end if;
    return;
  end if;
  select * into c from public.commandes where id = m.commande_id;
  s := case
         when c.etat = 'terminee' and c.libere_le is not null then 'due'
         when c.etat = 'litige' then 'suspendue'
         when c.etat = 'annulee' then 'annulee'
         else 'prevue' end;
  p := round(m.prix, 0); k := round(p * 0.069, 0);
  if o.id is null then
    insert into public.commissions_transport (mission_id, commande_id, transporteur_id, prix_transport, commission, statut)
      values (m.id, m.commande_id, m.transporteur_id, p, k, s) returning * into o;
    insert into public.commission_transport_journal (commission_id, statut, prix_transport, commission, motif)
      values (o.id, s, p, k, 'commande ' || c.numero || ' : mission acceptée à ' || p || ' F');
  elsif o.statut <> s or o.prix_transport <> p then
    update public.commissions_transport set statut = s, prix_transport = p, commission = k, updated_at = now() where id = o.id;
    insert into public.commission_transport_journal (commission_id, statut, prix_transport, commission, motif)
      values (o.id, s, p, k, 'commande ' || c.numero || ' : ' || (case when o.prix_transport <> p then 'prix ' || o.prix_transport || ' → ' || p || ' F' else o.statut || ' → ' || s end));
  end if;
end $$;
revoke all on function public._ctr_sync(uuid) from public, anon, authenticated;

create or replace function public._ctr_commande() returns trigger
language plpgsql security definer set search_path = public as $$
declare mid uuid;
begin
  if new.etat is not distinct from old.etat and new.libere_le is not distinct from old.libere_le then return new; end if;
  for mid in select id from public.transport_missions where commande_id = new.id and statut = 'acceptee' loop perform public._ctr_sync(mid); end loop;
  return new;
end $$;
revoke all on function public._ctr_commande() from public, anon, authenticated;
create or replace trigger commandes_commission_transport after update of etat, libere_le on public.commandes
  for each row execute function public._ctr_commande();

-- ——— 5) Solder le séquestre quand la commande est libérée ou annulée (seulement s'il y a de l'argent bloqué) ———
create or replace function public._seq_commande() returns trigger
language plpgsql security definer set search_path = public as $$
declare s public.sequestres; r json; e text;
begin
  select * into s from public.sequestres where commande_id = new.id for update;
  if s.id is null or s.etat <> 'bloque' then return new; end if;
  if new.etat = 'annulee' and old.etat <> 'annulee' then
    -- commande annulée (commun accord avant chargement, ou décision de l'équipe) : tout revient à l'acheteur
    insert into public.sequestre_versements (sequestre_id, beneficiaire, user_id, brut, net) values (s.id, 'acheteur', new.acheteur_id, s.montant, s.montant);
    update public.sequestres set etat = 'rembourse', solde_le = now() where id = s.id;
    perform public._seq_journal(new.id, 'rembourse', null, 'systeme', 'commande annulée : ' || s.montant || ' F à rendre à l''acheteur');
  elsif new.etat = 'terminee' and new.libere_le is not null and old.libere_le is null then
    r := public._seq_repartition(new.id);
    if (r->>'vendeur_brut')::numeric > 0 then
      insert into public.sequestre_versements (sequestre_id, beneficiaire, user_id, brut, commission, net)
        values (s.id, 'vendeur', new.vendeur_id, (r->>'vendeur_brut')::numeric, (r->>'vendeur_commission')::numeric, (r->>'vendeur_net')::numeric);
    end if;
    if (r->>'transporteur_brut')::numeric > 0 then
      insert into public.sequestre_versements (sequestre_id, beneficiaire, user_id, brut, commission, net)
        values (s.id, 'transporteur', (r->>'transporteur_user')::uuid, (r->>'transporteur_brut')::numeric, (r->>'transporteur_commission')::numeric, (r->>'transporteur_net')::numeric);
    end if;
    if (r->>'acheteur_rembourse')::numeric > 0 then
      insert into public.sequestre_versements (sequestre_id, beneficiaire, user_id, brut, net)
        values (s.id, 'acheteur', new.acheteur_id, (r->>'acheteur_rembourse')::numeric, (r->>'acheteur_rembourse')::numeric);
    end if;
    if (r->>'marche')::numeric > 0 then
      insert into public.sequestre_versements (sequestre_id, beneficiaire, brut, net) values (s.id, 'marche', (r->>'marche')::numeric, (r->>'marche')::numeric);
    end if;
    e := case when (r->>'acheteur_rembourse')::numeric = 0 then 'libere' when (r->>'vendeur_brut')::numeric = 0 and (r->>'transporteur_brut')::numeric = 0 then 'rembourse' else 'partage' end;
    update public.sequestres set etat = e, solde_le = now() where id = s.id;
    perform public._seq_journal(new.id, 'solde', null, 'systeme', 'séquestre soldé : ' || e);
  end if;
  return new;
end $$;
revoke all on function public._seq_commande() from public, anon, authenticated;
create or replace trigger commandes_sequestre after update of etat, libere_le on public.commandes
  for each row execute function public._seq_commande();

-- ——— 6) Le dépôt : SEUL le service (future fonction Edge, notification signée du partenaire) peut l'enregistrer ———
create or replace function public.sequestre_depot_confirme(p_cmd uuid, p_operateur text, p_reference text, p_montant numeric) returns text
language plpgsql security definer set search_path = public as $$
declare c public.commandes; r json; s public.sequestres;
begin
  select * into c from public.commandes where id = p_cmd for update;
  if c.id is null then raise exception 'Commande introuvable.'; end if;
  if c.etat <> 'en_cours' then raise exception 'Les fonds se bloquent quand la commande est confirmée et pas encore terminée.'; end if;
  select * into s from public.sequestres where commande_id = c.id;
  if s.id is not null then return s.etat; end if;              -- notification reçue deux fois : rien ne change
  r := public._seq_repartition(c.id);
  if p_montant is null or round(p_montant, 0) <> (r->>'total')::numeric then
    raise exception 'Montant reçu (%) différent du total attendu (%).', p_montant, r->>'total';
  end if;
  insert into public.sequestres (commande_id, operateur, reference, montant) values (c.id, p_operateur, p_reference, round(p_montant, 0));
  perform public._seq_journal(c.id, 'depot', null, 'systeme', round(p_montant, 0) || ' F bloqués chez ' || p_operateur || ' (réf. ' || p_reference || ')');
  return 'bloque';
end $$;
revoke all on function public.sequestre_depot_confirme(uuid, text, text, numeric) from public, anon, authenticated;
grant execute on function public.sequestre_depot_confirme(uuid, text, text, numeric) to service_role;

-- ——— 7) L'acheteur libère (marchandise conforme) ———
create or replace function public.commande_liberer(p_id uuid) returns void
language plpgsql volatile security definer set search_path = public as $$
declare me uuid := auth.uid(); c public.commandes;
begin
  select * into c from public.commandes where id = p_id for update;
  if c.id is null or me is distinct from c.acheteur_id then raise exception 'Seul l''acheteur libère le paiement.'; end if;
  if public.est_banni(me) then raise exception 'COMPTE_BANNI : ce compte a été banni du Marché de Gros.'; end if;
  if c.etat <> 'terminee' then raise exception 'La libération se fait après la réception.'; end if;
  if c.libere_le is not null then raise exception 'Déjà libéré.'; end if;
  update public.commandes set libere_le = now(), liberation = 'conforme' where id = c.id;
  perform public._seq_journal(c.id, 'liberee', me, 'acheteur', 'marchandise conforme');
end $$;

-- après 48 h sans refus ni litige, la libération est automatique (tâche planifiée)
create or replace function public.sequestre_liberer_echus() returns integer
language plpgsql security definer set search_path = public as $$
declare c public.commandes; n integer := 0;
begin
  for c in select * from public.commandes where etat = 'terminee' and libere_le is null and termine_le < now() - interval '48 hours' for update skip locked loop
    update public.commandes set libere_le = now(), liberation = 'auto' where id = c.id;
    perform public._seq_journal(c.id, 'liberee_auto', null, 'systeme', '48 h après la réception, sans problème signalé');
    n := n + 1;
  end loop;
  return n;
end $$;
revoke all on function public.sequestre_liberer_echus() from public, anon, authenticated;

-- ——— 8) Le refus de la marchandise (après réception, 48 h au plus, avec photos) ———
create or replace function public.commande_refuser(p_id uuid, p_quantite numeric, p_motif text, p_photos text[]) returns void
language plpgsql volatile security definer set search_path = public as $$
declare me uuid := auth.uid(); c public.commandes; m text; x text; q numeric;
begin
  select * into c from public.commandes where id = p_id for update;
  if c.id is null or me is distinct from c.acheteur_id then raise exception 'Seul l''acheteur peut refuser la marchandise.'; end if;
  if public.est_banni(me) then raise exception 'COMPTE_BANNI : ce compte a été banni du Marché de Gros.'; end if;
  if c.etat <> 'terminee' or c.libere_le is not null then raise exception 'Le refus se fait après la réception, avant la libération du paiement.'; end if;
  if c.termine_le < now() - interval '48 hours' then raise exception 'Le délai de 48 h après la réception est passé.'; end if;
  m := public._cmd_texte(p_motif, 300);
  if m is null then raise exception 'Expliquez le problème (marchandise gâtée, abîmée, quantité manquante…).'; end if;
  if p_photos is null or cardinality(p_photos) < 1 or cardinality(p_photos) > 4 then raise exception 'Ajoutez de 1 à 4 photos de la marchandise.'; end if;
  foreach x in array p_photos loop
    if split_part(x, '/', 1) <> me::text or not exists (select 1 from storage.objects o where o.bucket_id = 'preuves' and o.name = x) then
      raise exception 'Photo introuvable : renvoyez-la.';
    end if;
  end loop;
  q := case when p_quantite is null or c.quantite is null or p_quantite >= c.quantite then null else p_quantite end;
  if p_quantite is not null and p_quantite <= 0 then raise exception 'Quantité refusée invalide.'; end if;
  update public.commandes set etat = 'litige', litige_par = me, litige_motif = m, litige_le = now(),
    refus_quantite = q, refus_motif = m, refus_photos = p_photos, refus_le = now(),
    refus_chauffeur = null, refus_chauffeur_le = null, refus_vendeur = null, refus_vendeur_le = null where id = c.id;
  perform public._seq_journal(c.id, 'refus', me, 'acheteur', case when q is null then 'toute la marchandise' else q || ' ' || coalesce(c.unite, '') end || ' : ' || m);
  perform public._cmd_journal(c.id, 'litige', me, 'acheteur', 'declaration', null, null, null, 'Marchandise refusée : ' || m);
end $$;

-- le chauffeur qui n'a pas été choisi par l'acheteur ?
create or replace function public._cmd_chauffeur_independant(c public.commandes) returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce((select m.propose_role <> 'acheteur' from public.transport_missions m
                   where m.commande_id = c.id and m.transporteur_id = c.transporteur_id and m.statut = 'acceptee'
                   order by m.created_at desc limit 1), false) and c.mode_transport <> 'acheteur';
$$;
revoke all on function public._cmd_chauffeur_independant(public.commandes) from public, anon, authenticated;

-- appliquer le refus : la partie refusée revient à l'acheteur, le reste au vendeur, le transport au chauffeur
create or replace function public._cmd_refus_appliquer(p_id uuid, p_par uuid, p_role text, p_note text) returns void
language plpgsql security definer set search_path = public as $$
declare c public.commandes; mr numeric;
begin
  select * into c from public.commandes where id = p_id for update;
  mr := case when c.refus_quantite is null or c.quantite is null or c.quantite = 0 then round(c.montant, 0)
             else least(round(c.refus_quantite * c.prix_unitaire, 0), round(c.montant, 0)) end;
  update public.commandes set etat = 'terminee', libere_le = now(), liberation = 'refus', montant_refuse = mr where id = c.id;
  perform public._seq_journal(c.id, 'refus_applique', p_par, p_role, mr || ' F rendus à l''acheteur · ' || coalesce(p_note, ''));
  perform public._cmd_journal(c.id, 'terminee', p_par, p_role, 'declaration', null, null, null,
    'Refus confirmé : ' || mr || ' F pour l''acheteur' || case when mr < round(c.montant, 0) then ', le reste pour le vendeur' else '' end);
end $$;
revoke all on function public._cmd_refus_appliquer(uuid, uuid, text, text) from public, anon, authenticated;

-- le chauffeur confirme (ou conteste) ce qu'il a vu à la livraison
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
  if p_oui and (public._cmd_chauffeur_independant(c) or c.refus_vendeur = 'reconnu') then
    perform public._cmd_refus_appliquer(c.id, me, 'chauffeur', 'confirmé par le chauffeur');
    return 'applique';
  end if;
  return case when p_oui then 'attente_vendeur' else 'equipe' end;
end $$;

-- le vendeur reconnaît le problème (remboursement immédiat) ou le conteste (l'équipe tranche, sauf chauffeur indépendant qui confirme)
create or replace function public.commande_refus_vendeur(p_id uuid, p_oui boolean, p_note text default null) returns text
language plpgsql volatile security definer set search_path = public as $$
declare me uuid := auth.uid(); c public.commandes; nt text;
begin
  select * into c from public.commandes where id = p_id for update;
  if c.id is null or me is distinct from c.vendeur_id then raise exception 'Commande introuvable.'; end if;
  if c.etat <> 'litige' or c.refus_le is null then raise exception 'Aucun refus sur cette commande.'; end if;
  if c.refus_vendeur is not null then raise exception 'Vous avez déjà répondu.'; end if;
  nt := public._cmd_texte(p_note, 300);
  if not p_oui and nt is null then raise exception 'Expliquez pourquoi vous contestez.'; end if;
  update public.commandes set refus_vendeur = case when p_oui then 'reconnu' else 'conteste' end, refus_vendeur_le = now() where id = c.id;
  perform public._seq_journal(c.id, case when p_oui then 'refus_vendeur_reconnu' else 'refus_vendeur_conteste' end, me, 'vendeur', nt);
  if p_oui then
    perform public._cmd_refus_appliquer(c.id, me, 'vendeur', 'reconnu par le vendeur');
    return 'applique';
  end if;
  return 'equipe';
end $$;

-- l'équipe tranche un refus : quantité refusée retenue (0 = refus rejeté, tout est libéré au vendeur)
create or replace function public.admin_refus_trancher(p_cmd uuid, p_quantite numeric, p_note text) returns void
language plpgsql volatile security definer set search_path = public as $$
declare c public.commandes; nt text := nullif(btrim(coalesce(p_note, '')), ''); mr numeric;
begin
  if not public.est_admin() then raise exception 'Réservé à l''administration.'; end if;
  if nt is null or char_length(nt) > 300 then raise exception 'Expliquez la décision (300 caractères au plus).'; end if;
  select * into c from public.commandes where id = p_cmd for update;
  if c.id is null or c.etat <> 'litige' or c.refus_le is null then raise exception 'Cette commande n''a pas de refus en cours.'; end if;
  if p_quantite is null or p_quantite < 0 then raise exception 'Indiquez la quantité refusée retenue (0 si le refus est rejeté).'; end if;
  mr := case when c.quantite is null or p_quantite >= c.quantite then round(c.montant, 0) else least(round(p_quantite * c.prix_unitaire, 0), round(c.montant, 0)) end;
  update public.commandes set etat = 'terminee', libere_le = now(), liberation = 'admin', montant_refuse = mr where id = c.id;
  perform public._seq_journal(c.id, 'refus_admin', auth.uid(), 'admin', mr || ' F pour l''acheteur · ' || nt);
  perform public._cmd_journal(c.id, 'terminee', auth.uid(), 'admin', 'admin', null, null, null, nt);
end $$;

-- l'ancien arbitrage : « terminée » vaut libération (le vendeur et le transporteur sont payés)
create or replace function public.admin_litige_trancher(p_cmd uuid, p_issue text, p_note text) returns void
language plpgsql volatile security definer set search_path = public as $$
declare c public.commandes; nt text := nullif(btrim(coalesce(p_note, '')), '');
begin
  if not public.est_admin() then raise exception 'Réservé à l''administration.'; end if;
  if p_issue not in ('terminee', 'annulee') then raise exception 'Issue inconnue.'; end if;
  if nt is null or char_length(nt) > 300 then raise exception 'Expliquez la décision (300 caractères au plus).'; end if;
  select * into c from public.commandes where id = p_cmd for update;
  if c.id is null or c.etat <> 'litige' then raise exception 'Cette commande n''est pas en litige.'; end if;
  update public.commandes set etat = p_issue, etape = case when p_issue = 'terminee' then 'terminee' else etape end,
    termine_le = case when p_issue = 'terminee' then coalesce(termine_le, now()) else termine_le end,
    libere_le = case when p_issue = 'terminee' then now() else libere_le end,
    liberation = case when p_issue = 'terminee' then 'admin' else liberation end,
    montant_refuse = case when p_issue = 'terminee' then 0 else montant_refuse end where id = c.id;
  perform public._cmd_journal(c.id, p_issue, auth.uid(), 'admin', 'admin', null, null, null, nt);
end $$;

-- ——— 9) Lire : le séquestre d'une commande (acheteur, vendeur, chauffeur pour sa part, admin) ———
create or replace function public.commande_sequestre(p_id uuid) returns json
language plpgsql stable security definer set search_path = public as $$
declare me uuid := auth.uid(); c public.commandes; r text; rep json; s public.sequestres; ech timestamptz;
begin
  select * into c from public.commandes where id = p_id;
  if c.id is null or me is null then return null; end if;
  r := public._cmd_role2(c, me);
  if r is null and public.est_admin() then r := 'admin'; end if;
  if r is null then return null; end if;
  rep := public._seq_repartition(c.id);
  select * into s from public.sequestres where commande_id = c.id;
  ech := case when c.etat = 'terminee' and c.libere_le is null then c.termine_le + interval '48 hours' end;
  return json_build_object(
    'role', r,
    'actif', s.id is not null,                     -- de l'argent est-il réellement bloqué chez un partenaire ?
    'etat', coalesce(s.etat, 'non_ouvert'), 'operateur', s.operateur, 'depose_le', s.depose_le, 'solde_le', s.solde_le,
    'libere_le', c.libere_le, 'liberation', c.liberation, 'echeance', ech, 'montant_refuse', c.montant_refuse,
    'repartition', case when r = 'chauffeur' then json_build_object('transporteur_brut', rep->'transporteur_brut', 'transporteur_commission', rep->'transporteur_commission', 'transporteur_net', rep->'transporteur_net') else rep end,
    'refus', case when c.refus_le is null then null else json_build_object(
      'le', c.refus_le, 'quantite', c.refus_quantite, 'unite', c.unite, 'motif', c.refus_motif, 'photos', c.refus_photos,
      'chauffeur', c.refus_chauffeur, 'chauffeur_le', c.refus_chauffeur_le, 'vendeur', c.refus_vendeur, 'vendeur_le', c.refus_vendeur_le,
      'chauffeur_suffit', public._cmd_chauffeur_independant(c),
      'a_chauffeur', exists (select 1 from public.transporteurs t where t.id = c.transporteur_id and t.user_id is not null)) end,
    'peut_liberer', r = 'acheteur' and c.etat = 'terminee' and c.libere_le is null,
    'peut_refuser', r = 'acheteur' and c.etat = 'terminee' and c.libere_le is null and c.termine_le > now() - interval '48 hours',
    'peut_constater', r = 'chauffeur' and c.etat = 'litige' and c.refus_le is not null and c.refus_chauffeur is null,
    'peut_repondre', r = 'vendeur' and c.etat = 'litige' and c.refus_le is not null and c.refus_vendeur is null);
end $$;

-- les photos du refus : visibles par le vendeur et le chauffeur de la commande (l'admin les voit déjà)
create or replace function public._preuve_refus_visible(p_nom text) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.commandes c
                 where c.refus_photos @> array[p_nom]
                   and (auth.uid() in (c.vendeur_id, c.acheteur_id)
                        or exists (select 1 from public.transporteurs t where t.id = c.transporteur_id and t.user_id = auth.uid())));
$$;
revoke all on function public._preuve_refus_visible(text) from public, anon;
grant execute on function public._preuve_refus_visible(text) to authenticated;
do $$ begin
  create policy "preuves : lecture refus commande" on storage.objects for select to authenticated
    using (bucket_id = 'preuves' and (select public._preuve_refus_visible(name)));
exception when duplicate_object then null; end $$;

-- ——— 10) L'historique de la commande montre aussi le séquestre et le refus ———
create or replace function public.commande_journal(p_id uuid)
 returns table(evenement text, role text, preuve text, lieu text, lat double precision, lon double precision, note text, at timestamp with time zone, par_moi boolean)
 language sql stable security definer set search_path = public as $$
  with ok as (select 1 from public.commandes c0 where c0.id = p_id and auth.uid() is not null
              and (public._cmd_role2(c0, auth.uid()) is not null or public.est_admin()))
  select * from (
    select e.evenement, e.role, e.preuve, e.lieu, e.lat, e.lon, e.note, e.at, e.par = auth.uid()
    from public.commande_etapes e where e.commande_id = p_id and exists (select 1 from ok)
    union all
    select 'transporteur_' || m.statut, case when m.statut = 'proposee' then m.propose_role else 'chauffeur' end, case when m.propose_role = 'admin' then 'admin' else 'declaration' end,
      t.nom || ' · ' || public._tr_vehicule(t.vehicule), null, null, m.note, coalesce(m.repondu_le, m.created_at),
      (m.statut = 'proposee' and m.propose_par = auth.uid()) or (m.statut <> 'proposee' and t.user_id = auth.uid())
    from public.transport_missions m join public.transporteurs t on t.id = m.transporteur_id
    where m.commande_id = p_id and exists (select 1 from ok)
    union all
    select 'code_' || k.etape || '_cree', case k.etape when 'prise_en_charge' then 'vendeur' when 'reception' then 'acheteur' else 'chauffeur' end,
      'code', k.lieu, null, null, null, k.cree_le, k.detenteur_id = auth.uid()
    from public.commande_codes k where k.commande_id = p_id and exists (select 1 from ok)
    union all
    select 'code_' || k.etape || '_bloque', 'systeme', 'auto', null, null, null, '5 essais faux', k.cree_le + interval '1 second', false
    from public.commande_codes k where k.commande_id = p_id and k.essais >= 5 and k.utilise_le is null and exists (select 1 from ok)
    union all
    select 'sq_' || q.evenement, q.role, case when q.role = 'systeme' then 'auto' when q.role = 'admin' then 'admin' else 'declaration' end,
      null, null, null, q.note, q.at, q.par = auth.uid()
    from public.sequestre_journal q where q.commande_id = p_id and exists (select 1 from ok)
  ) j order by j.at;
$$;

-- ——— 11) mes_commandes et admin_commandes : l'état de la libération ———
-- (nouvelle fonction à côté de l'ancienne : le type de retour change, on ne la remplace pas)
create or replace function public.mes_commandes2()
 returns table(id uuid, numero text, negociation_id uuid, role text, etat text, etape text, produit text, quantite numeric, unite text, prix_unitaire numeric, montant numeric, commission_montant numeric, mode_transport text, validation text, ville_depart text, lieu_livraison text, partenaire_id uuid, partenaire_nom text, cree_par_moi boolean, annulation text, created_at timestamp with time zone, updated_at timestamp with time zone,
               termine_le timestamptz, libere_le timestamptz, liberation text, montant_refuse numeric, refus_le timestamptz)
 language sql stable security definer set search_path = public as $$
  select c.id, c.numero, c.negociation_id, public._cmd_role(c, auth.uid()), c.etat, c.etape, c.produit, c.quantite, c.unite,
    c.prix_unitaire, c.montant, case when auth.uid() = c.vendeur_id then c.commission_montant end, c.mode_transport, c.validation,
    c.ville_depart, c.lieu_livraison,
    case when auth.uid() = c.vendeur_id then c.acheteur_id else c.vendeur_id end,
    coalesce(public.nom_public(case when auth.uid() = c.vendeur_id then c.acheteur_id else c.vendeur_id end), 'Membre'),
    c.cree_par = auth.uid(),
    case when c.annulation_par is null then null when c.annulation_par = auth.uid() then 'moi' else 'autre' end,
    c.created_at, c.updated_at, c.termine_le, c.libere_le, c.liberation, c.montant_refuse, c.refus_le
  from public.commandes c
  where auth.uid() is not null and auth.uid() in (c.vendeur_id, c.acheteur_id)
  order by c.updated_at desc
  limit 500;
$$;

-- l'équipe retrouve une commande par son numéro (le « code de transaction »)
create or replace function public.admin_commande_numero(p_numero text) returns json
language plpgsql stable security definer set search_path = public as $$
declare c public.commandes;
begin
  if not public.est_admin() then raise exception 'Réservé à l''administration.'; end if;
  select * into c from public.commandes where upper(numero) = upper(btrim(coalesce(p_numero, '')));
  if c.id is null then return null; end if;
  return json_build_object('id', c.id, 'numero', c.numero, 'etat', c.etat, 'etape', c.etape, 'produit', c.produit, 'quantite', c.quantite, 'unite', c.unite,
    'prix_unitaire', c.prix_unitaire, 'montant', c.montant, 'mode_transport', c.mode_transport, 'validation', c.validation,
    'ville_depart', c.ville_depart, 'lieu_livraison', c.lieu_livraison, 'cree_le', c.created_at, 'termine_le', c.termine_le,
    'vendeur', coalesce(public.nom_public(c.vendeur_id), 'Membre'), 'acheteur', coalesce(public.nom_public(c.acheteur_id), 'Membre'),
    'negociation', (select json_build_object('prix_final', n.prix_final, 'quantite_finale', n.quantite_finale, 'transport_final', n.transport_final, 'conditions_finales', n.conditions_finales, 'statut', n.statut, 'conclu_le', n.conclu_le)
                    from public.negociations n where n.id = c.negociation_id),
    'sequestre', public.commande_sequestre(c.id),
    'journal', (select coalesce(json_agg(j), '[]'::json) from public.commande_journal(c.id) j));
end $$;

-- la file de l'équipe montre le refus (photos, réponses du chauffeur et du vendeur)
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
      case when c.refus_le is null then null else json_build_object('le', c.refus_le, 'quantite', c.refus_quantite, 'motif', c.refus_motif, 'photos', c.refus_photos,
        'chauffeur', c.refus_chauffeur, 'vendeur', c.refus_vendeur, 'chauffeur_suffit', public._cmd_chauffeur_independant(c)) end refus,
      c.libere_le, c.liberation, c.montant_refuse
    from public.commandes c
    where case p_vue
      when 'a_traiter' then c.etat = 'litige'
        or (c.mode_transport = 'reseau' and c.etat in ('a_confirmer', 'en_cours') and coalesce(c.etape, 'confirmee') in ('confirmee', 'preparation')
            and not exists (select 1 from public.transport_missions m where m.commande_id = c.id and m.statut in ('proposee', 'acceptee')))
        or (c.etat in ('a_confirmer', 'en_cours') and coalesce(c.etape, 'confirmee') in ('confirmee', 'preparation')
            and exists (select 1 from public.transport_missions m join public.transporteurs t on t.id = m.transporteur_id
                        where m.commande_id = c.id and m.statut = 'acceptee' and m.prix is null and t.user_id is null))
      when 'en_cours' then c.etat in ('a_confirmer', 'en_cours')
      else true end
    order by c.updated_at desc limit 300) x);
end $$;

-- ——— 12) Droits ———
revoke execute on function public.commande_liberer(uuid), public.commande_refuser(uuid, numeric, text, text[]),
  public.commande_refus_chauffeur(uuid, boolean, text), public.commande_refus_vendeur(uuid, boolean, text),
  public.admin_refus_trancher(uuid, numeric, text), public.commande_sequestre(uuid), public.mes_commandes2(),
  public.admin_commande_numero(text) from public, anon;
grant execute on function public.commande_liberer(uuid), public.commande_refuser(uuid, numeric, text, text[]),
  public.commande_refus_chauffeur(uuid, boolean, text), public.commande_refus_vendeur(uuid, boolean, text),
  public.admin_refus_trancher(uuid, numeric, text), public.commande_sequestre(uuid), public.mes_commandes2(),
  public.admin_commande_numero(text) to authenticated;

-- ——— 13) Libération automatique toutes les 15 minutes ———
select cron.schedule('mdg-liberer-echus', '*/15 * * * *', 'select public.sequestre_liberer_echus()');

-- ——— 14) Commandes déjà terminées depuis plus de 48 h : considérées libérées à l'échéance (rien d'autre ne change) ———
update public.commandes set libere_le = termine_le + interval '48 hours', liberation = 'auto'
where etat = 'terminee' and libere_le is null and termine_le < now() - interval '48 hours';

-- ——— 15) Espace chauffeur : le refus à confirmer apparaît sur la mission ———
create or replace function public.chauffeur_missions() returns json
language sql stable security definer set search_path = public as $$
  select coalesce(json_agg(json_build_object(
      'mission_id', m.id, 'mission', m.statut, 'propose_role', m.propose_role, 'propose_le', m.created_at, 'note', m.note,
      'prix', m.prix, 'taux', 0.069, 'commission', case when m.prix is not null then round(round(m.prix, 0) * 0.069, 0) end,
      'net', case when m.prix is not null then round(m.prix, 0) - round(round(m.prix, 0) * 0.069, 0) end,
      'commande_id', c.id, 'numero', c.numero, 'etat', c.etat, 'etape', c.etape, 'validation', c.validation, 'produit', c.produit, 'quantite', c.quantite, 'unite', c.unite,
      'ville_depart', c.ville_depart, 'lieu_livraison', c.lieu_livraison,
      'vendeur', coalesce(public.nom_public(c.vendeur_id), 'Membre'), 'acheteur', coalesce(public.nom_public(c.acheteur_id), 'Membre'),
      'libere_le', c.libere_le,
      'refus', case when c.refus_le is not null and c.transporteur_id = t.id then json_build_object(
          'le', c.refus_le, 'quantite', c.refus_quantite, 'motif', c.refus_motif, 'photos', c.refus_photos,
          'reponse', c.refus_chauffeur, 'a_repondre', c.etat = 'litige' and c.refus_chauffeur is null, 'suffit', public._cmd_chauffeur_independant(c)) end,
      'maj', c.updated_at) order by (m.statut = 'proposee') desc, (c.etat = 'litige' and c.refus_le is not null and c.refus_chauffeur is null) desc, c.updated_at desc), '[]'::json)
  from public.transport_missions m
  join public.transporteurs t on t.id = m.transporteur_id and t.user_id = auth.uid()
  join public.commandes c on c.id = m.commande_id
  where m.statut in ('proposee', 'acceptee') or (m.statut = 'refusee' and m.repondu_le > now() - interval '7 days');
$$;

-- l'historique dans l'ordre : la libération est écrite avant le solde du séquestre
create or replace function public.commande_liberer(p_id uuid) returns void
language plpgsql volatile security definer set search_path = public as $$
declare me uuid := auth.uid(); c public.commandes;
begin
  select * into c from public.commandes where id = p_id for update;
  if c.id is null or me is distinct from c.acheteur_id then raise exception 'Seul l''acheteur libère le paiement.'; end if;
  if public.est_banni(me) then raise exception 'COMPTE_BANNI : ce compte a été banni du Marché de Gros.'; end if;
  if c.etat <> 'terminee' then raise exception 'La libération se fait après la réception.'; end if;
  if c.libere_le is not null then raise exception 'Déjà libéré.'; end if;
  perform public._seq_journal(c.id, 'liberee', me, 'acheteur', 'marchandise conforme');
  update public.commandes set libere_le = now(), liberation = 'conforme' where id = c.id;
end $$;
