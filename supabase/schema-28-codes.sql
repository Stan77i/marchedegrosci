-- ═════════ Marché de Gros CI — schéma 28 : les codes à usage unique ═════════
-- Appliqué par Claude avec l'outil Supabase. Aucun drop.
--
-- Trois codes, pour une commande en validation « code » (chauffeur avec l'application) :
--   • PRISE EN CHARGE : le vendeur le voit, le donne au chauffeur quand la marchandise est chargée ; le chauffeur le tape → « Chargement confirmé » ;
--   • TRANSFERT : le chauffeur qui transmet la marchandise désigne le nouveau chauffeur (par son code T-XXXX) et voit un code ;
--     il le donne au nouveau chauffeur, qui le tape → « Transbordement », le nouveau chauffeur prend la mission ;
--   • RÉCEPTION : l'acheteur le voit, le donne au chauffeur APRÈS avoir vérifié la marchandise ; le chauffeur le tape → « Réception confirmée ».
-- Règles :
--   • le code est tiré au hasard par le serveur (6 chiffres), gardé seulement sous forme chiffrée (bcrypt) : personne ne peut le relire,
--     pas même l'équipe ; il est montré UNE fois à celui qui le détient, jamais à celui qui doit le taper ;
--   • lié à une commande et à une étape ; expire (6 h, 2 h pour un transfert) ; un nouveau code annule le précédent ;
--   • 5 essais au plus, puis le code est bloqué : le détenteur en demande un nouveau ;
--   • un code faux ne lève PAS d'erreur (une erreur annulerait aussi le compteur d'essais) : la fonction répond « incorrect, il reste N essais » ;
--   • historique horodaté : création, utilisation, blocage, visibles dans l'historique de la commande (sans jamais le code).
-- Aussi :
--   • commande_creer accepte maintenant la validation « code » ;
--   • en validation « code », le chargement et la réception ne peuvent plus être simplement déclarés : il faut le code ;
--   • l'équipe ne peut pas confier une commande « avec codes » à un chauffeur sans application.

-- ——— 1) Table ———
create table if not exists public.commande_codes (
  id              uuid primary key default gen_random_uuid(),
  commande_id     uuid not null references public.commandes (id) on delete cascade,
  etape           text not null check (etape in ('prise_en_charge', 'transfert', 'reception')),
  hash            text not null,
  detenteur_id    uuid not null,                  -- celui qui voit le code
  cible_id        uuid references public.transporteurs (id) on delete cascade,   -- transfert : le nouveau chauffeur
  lieu            text check (char_length(lieu) <= 120),
  essais          int not null default 0,
  cree_le         timestamptz not null default now(),
  expire_le       timestamptz not null,
  utilise_le      timestamptz,
  utilise_par     uuid,
  annule_le       timestamptz
);
create index if not exists commande_codes_cmd on public.commande_codes (commande_id, etape, cree_le desc);
create index if not exists commande_codes_cible on public.commande_codes (cible_id) where utilise_le is null and annule_le is null;
alter table public.commande_codes enable row level security;
revoke all on public.commande_codes from anon, authenticated;

-- ——— 2) Outils ———
create or replace function public._code_six() returns text
language sql volatile set search_path = public, extensions as $$
  select lpad(((('x' || encode(gen_random_bytes(4), 'hex'))::bit(32)::bigint % 1000000))::text, 6, '0');
$$;

-- crée un code (annule le précédent du même genre) et renvoie le code EN CLAIR, une seule fois
create or replace function public._code_creer(p_cmd uuid, p_etape text, p_detenteur uuid, p_duree interval, p_cible uuid default null, p_lieu text default null) returns json
language plpgsql volatile security definer set search_path = public, extensions as $$
declare c text := public._code_six(); e timestamptz := now() + p_duree;
begin
  update public.commande_codes set annule_le = now() where commande_id = p_cmd and etape = p_etape and utilise_le is null and annule_le is null;
  insert into public.commande_codes (commande_id, etape, hash, detenteur_id, cible_id, lieu, expire_le)
  values (p_cmd, p_etape, crypt(c, gen_salt('bf', 8)), p_detenteur, p_cible, p_lieu, e);
  update public.commandes set updated_at = now() where id = p_cmd;
  return json_build_object('code', c, 'expire_le', e);
end $$;

-- ——— 3) Le détenteur obtient son code (vendeur : prise en charge ; acheteur : réception) ———
create or replace function public.commande_code_obtenir(p_cmd uuid, p_etape text) returns json
language plpgsql volatile security definer set search_path = public as $$
declare me uuid := auth.uid(); c public.commandes; r text;
begin
  select * into c from public.commandes where id = p_cmd for update;
  r := public._cmd_role(c, me);
  if c.id is null or r is null then raise exception 'Commande introuvable.'; end if;
  if public.est_banni(me) then raise exception 'COMPTE_BANNI : ce compte a été banni du Marché de Gros.'; end if;
  if c.validation <> 'code' then raise exception 'Cette commande se valide sans code.'; end if;
  if c.etat <> 'en_cours' then raise exception 'Cette commande n''est pas en cours.'; end if;
  if not exists (select 1 from public.transporteurs t where t.id = c.transporteur_id and t.user_id is not null) then
    raise exception 'Attendez qu''un chauffeur avec l''application accepte la mission.';
  end if;
  if p_etape = 'prise_en_charge' then
    if r <> 'vendeur' then raise exception 'Le code de prise en charge est réservé au vendeur.'; end if;
    if c.etape not in ('confirmee', 'preparation') then raise exception 'La marchandise est déjà prise en charge.'; end if;
  elsif p_etape = 'reception' then
    if r <> 'acheteur' then raise exception 'Le code de réception est réservé à l''acheteur.'; end if;
    if c.etape not in ('transport', 'transbordement', 'arrivee') then raise exception 'Le code de réception s''obtient quand la marchandise est en route.'; end if;
  else
    raise exception 'Code inconnu.';
  end if;
  return public._code_creer(c.id, p_etape, me, interval '6 hours');
end $$;

-- ——— 4) Le chauffeur prépare un transfert vers un autre chauffeur ———
create or replace function public.commande_transfert_preparer(p_cmd uuid, p_code_transporteur text, p_lieu text) returns json
language plpgsql volatile security definer set search_path = public as $$
declare me uuid := auth.uid(); c public.commandes; t public.transporteurs; lieu text; res json;
  cd text := upper(regexp_replace(coalesce(p_code_transporteur, ''), '[^A-Za-z0-9]', '', 'g'));
begin
  select * into c from public.commandes where id = p_cmd for update;
  if c.id is null or public._cmd_role2(c, me) is distinct from 'chauffeur' then raise exception 'Mission introuvable.'; end if;
  if public.est_banni(me) then raise exception 'COMPTE_BANNI : ce compte a été banni du Marché de Gros.'; end if;
  if c.etat <> 'en_cours' or c.etape not in ('transport', 'transbordement') then raise exception 'Un transfert se fait pendant le transport.'; end if;
  if c.validation <> 'code' then raise exception 'Cette commande se valide sans code : signalez simplement le transbordement.'; end if;
  lieu := public._cmd_texte(p_lieu, 120);
  if lieu is null then raise exception 'Indiquez le lieu du transfert.'; end if;
  if cd !~ '^T[A-Z0-9]{4}$' then raise exception 'Code transporteur invalide (exemple : T-4K7P).'; end if;
  select * into t from public.transporteurs where replace(code, '-', '') = cd;
  if t.id is null then raise exception 'Aucun transporteur avec ce code.'; end if;
  if t.id = c.transporteur_id then raise exception 'C''est votre propre code : demandez celui du nouveau chauffeur.'; end if;
  if t.statut in ('refuse', 'suspendu') then raise exception 'Ce transporteur ne peut pas recevoir de mission.'; end if;
  if t.user_id is null then raise exception 'Ce transporteur n''a pas l''application.'; end if;
  if t.user_id in (c.vendeur_id, c.acheteur_id) then raise exception 'Ce transporteur est une des parties de la commande.'; end if;
  res := public._code_creer(c.id, 'transfert', me, interval '2 hours', t.id, lieu);
  return (res::jsonb || jsonb_build_object('nom', t.nom))::json;
end $$;

-- le nouveau chauffeur voit les transferts qui l'attendent
create or replace function public.chauffeur_transferts() returns json
language sql stable security definer set search_path = public as $$
  select coalesce(json_agg(json_build_object('commande_id', c.id, 'produit', c.produit, 'quantite', c.quantite, 'unite', c.unite,
      'lieu', k.lieu, 'lieu_livraison', c.lieu_livraison, 'de', (select t0.nom from public.transporteurs t0 where t0.id = c.transporteur_id),
      'expire_le', k.expire_le) order by k.cree_le desc), '[]'::json)
  from public.commande_codes k
  join public.transporteurs t on t.id = k.cible_id and t.user_id = auth.uid()
  join public.commandes c on c.id = k.commande_id
  where k.etape = 'transfert' and k.utilise_le is null and k.annule_le is null and k.expire_le > now() and k.essais < 5
    and c.etat = 'en_cours';
$$;

-- ——— 5) Le chauffeur tape un code ———
-- Réponse : { ok: true, etape } ou { ok: false, message, reste } — jamais d'erreur pour un code faux (le compteur d'essais doit rester).
create or replace function public.commande_valider_code(p_cmd uuid, p_code text, p_lat double precision default null, p_lon double precision default null) returns json
language plpgsql volatile security definer set search_path = public as $$
declare me uuid := auth.uid(); c public.commandes; r text; k public.commande_codes; quoi text; moi_tr public.transporteurs;
  saisi text := regexp_replace(coalesce(p_code, ''), '\D', '', 'g'); pv text; bon boolean; ancien uuid;
begin
  select * into c from public.commandes where id = p_cmd for update;
  if c.id is null then raise exception 'Commande introuvable.'; end if;
  if public.est_banni(me) then raise exception 'COMPTE_BANNI : ce compte a été banni du Marché de Gros.'; end if;
  if c.etat <> 'en_cours' then raise exception 'Cette commande n''est pas en cours.'; end if;
  if (p_lat is null) <> (p_lon is null) or (p_lat is not null and (p_lat not between -90 and 90 or p_lon not between -180 and 180)) then raise exception 'Position invalide.'; end if;
  r := public._cmd_role2(c, me);
  select * into moi_tr from public.transporteurs where user_id = me;
  -- quel code ? (le chauffeur ne choisit pas : le serveur le déduit de l'étape)
  if r = 'chauffeur' and c.etape in ('confirmee', 'preparation') then quoi := 'prise_en_charge';
  elsif r = 'chauffeur' and c.etape in ('transport', 'transbordement', 'arrivee') then quoi := 'reception';
  elsif moi_tr.id is not null and exists (select 1 from public.commande_codes x where x.commande_id = c.id and x.etape = 'transfert'
          and x.cible_id = moi_tr.id and x.utilise_le is null and x.annule_le is null) then quoi := 'transfert';
  else raise exception 'Seul le chauffeur de cette commande peut taper un code.';
  end if;
  select * into k from public.commande_codes x where x.commande_id = c.id and x.etape = quoi and x.utilise_le is null and x.annule_le is null
    and (quoi <> 'transfert' or x.cible_id = moi_tr.id) order by x.cree_le desc limit 1 for update;
  if k.id is null then
    return json_build_object('ok', false, 'reste', null, 'message', case quoi when 'prise_en_charge' then 'Le vendeur n''a pas encore affiché le code de prise en charge.'
      when 'reception' then 'L''acheteur n''a pas encore affiché le code de réception.' else 'Aucun transfert en attente.' end);
  end if;
  if k.expire_le <= now() then return json_build_object('ok', false, 'reste', 0, 'message', 'Ce code a expiré : demandez-en un nouveau.'); end if;
  if k.essais >= 5 then return json_build_object('ok', false, 'reste', 0, 'message', 'Trop d''essais : ce code est bloqué. Demandez-en un nouveau.'); end if;
  bon := saisi ~ '^[0-9]{6}$' and extensions.crypt(saisi, k.hash) = k.hash;
  if not bon then
    update public.commande_codes set essais = essais + 1 where id = k.id;
    return json_build_object('ok', false, 'reste', 4 - k.essais,
      'message', case when k.essais + 1 >= 5 then 'Code incorrect. Ce code est maintenant bloqué : demandez-en un nouveau.' else 'Code incorrect. Il reste ' || (4 - k.essais) || ' essai' || case when 4 - k.essais > 1 then 's' else '' end || '.' end);
  end if;
  update public.commande_codes set utilise_le = now(), utilise_par = me where id = k.id;
  pv := 'code';
  if quoi = 'prise_en_charge' then
    update public.commandes set etape = 'chargement' where id = c.id;
    perform public._cmd_journal(c.id, 'chargement', me, 'chauffeur', pv, null, p_lat, p_lon, 'Code de prise en charge');
    update public.commandes set etape = 'transport' where id = c.id;
    perform public._cmd_journal(c.id, 'transport', null, 'systeme', 'auto');
    return json_build_object('ok', true, 'etape', 'transport');
  elsif quoi = 'reception' then
    update public.commandes set etape = 'reception' where id = c.id;
    perform public._cmd_journal(c.id, 'reception', me, 'chauffeur', pv, null, p_lat, p_lon, 'Code de réception');
    update public.commandes set etape = 'terminee', etat = 'terminee', termine_le = now() where id = c.id;
    perform public._cmd_journal(c.id, 'terminee', null, 'systeme', 'auto');
    return json_build_object('ok', true, 'etape', 'terminee');
  else
    -- transfert : l'ancienne mission est retirée, le nouveau chauffeur prend la mission
    ancien := c.transporteur_id;
    update public.transport_missions set statut = 'retiree', repondu_le = now(), note = 'Transmise à ' || moi_tr.nom
      where commande_id = c.id and statut in ('proposee', 'acceptee');
    insert into public.transport_missions (commande_id, transporteur_id, propose_par, propose_role, statut, repondu_le, note)
    values (c.id, moi_tr.id, k.detenteur_id, coalesce((select m.propose_role from public.transport_missions m where m.commande_id = c.id and m.transporteur_id = ancien order by m.created_at desc limit 1), 'admin'),
            'acceptee', now(), 'Transfert depuis ' || coalesce((select nom from public.transporteurs where id = ancien), 'un autre chauffeur'));
    update public.commandes set transporteur_id = moi_tr.id, etape = 'transbordement' where id = c.id;
    perform public._cmd_journal(c.id, 'transbordement', me, 'chauffeur', pv, k.lieu, p_lat, p_lon, 'Code de transfert · ' || moi_tr.nom || ' prend la marchandise');
    return json_build_object('ok', true, 'etape', 'transbordement');
  end if;
end $$;

-- ——— 6) Mises à jour des fonctions existantes (même signature, même résultat) ———
-- commande_creer : la validation « code » est acceptée
create or replace function public.commande_creer(p_nego uuid, p_mode text, p_lieu text default null, p_validation text default 'declaration') returns uuid
language plpgsql volatile security definer set search_path = public as $$
declare me uuid := auth.uid(); n public.negociations; v uuid; a uuid; dep text; mt numeric; cid uuid := gen_random_uuid(); lieu text; val text := coalesce(p_validation, 'declaration');
begin
  if me is null then raise exception 'Connectez-vous d''abord.'; end if;
  if public.est_banni(me) then raise exception 'COMPTE_BANNI : ce compte a été banni du Marché de Gros.'; end if;
  select * into n from public.negociations where id = p_nego for update;
  if n.id is null or me not in (n.auteur_id, n.proprio_id) then raise exception 'Accord introuvable.'; end if;
  if n.statut <> 'conclue' then raise exception 'La commande se crée après un accord conclu.'; end if;
  if exists (select 1 from public.commandes where negociation_id = p_nego) then raise exception 'Une commande existe déjà pour cet accord.'; end if;
  if p_mode not in ('reseau', 'acheteur', 'vendeur') then raise exception 'Choisissez qui transporte la marchandise.'; end if;
  if val not in ('declaration', 'code') then raise exception 'Mode de validation inconnu.'; end if;
  lieu := public._cmd_texte(p_lieu, 120);
  if n.cible = 'offre' then v := n.proprio_id; a := n.auteur_id; select city into dep from public.offres where id = n.cible_id;
  else v := n.auteur_id; a := n.proprio_id; end if;
  mt := case when n.prix_final is not null and coalesce(n.quantite_finale, n.quantite) is not null then round(n.prix_final * coalesce(n.quantite_finale, n.quantite)) end;
  insert into public.commandes (id, numero, negociation_id, vendeur_id, acheteur_id, cree_par, produit, quantite, unite, prix_unitaire, montant,
    ville_depart, lieu_livraison, commission_montant, mode_transport, validation)
  values (cid, 'MDG-C-' || to_char(now(), 'YYMMDD') || '-' || upper(left(replace(cid::text, '-', ''), 6)), p_nego, v, a, me,
    n.produit, coalesce(n.quantite_finale, n.quantite), n.unite, n.prix_final, mt,
    coalesce(dep, n.ville), lieu, case when mt is not null then round(mt * 0.035) end, p_mode, val);
  perform public._cmd_journal(cid, 'creee', me, case when me = v then 'vendeur' else 'acheteur' end, 'declaration', lieu);
  return cid;
end $$;

-- commande_avancer : en validation « code », chargement et réception passent par le code
create or replace function public.commande_avancer(p_id uuid, p_etape text, p_lieu text default null,
  p_lat double precision default null, p_lon double precision default null, p_note text default null) returns text
language plpgsql volatile security definer set search_path = public as $$
declare me uuid := auth.uid(); c public.commandes; r text; lieu text; nt text; pv text;
begin
  select * into c from public.commandes where id = p_id for update;
  r := public._cmd_role2(c, me);
  if c.id is null or r is null then raise exception 'Commande introuvable.'; end if;
  if public.est_banni(me) then raise exception 'COMPTE_BANNI : ce compte a été banni du Marché de Gros.'; end if;
  if c.etat <> 'en_cours' then raise exception 'Cette commande n''est pas en cours.'; end if;
  if c.validation = 'code' and p_etape = 'chargement' then raise exception 'Commande avec codes : le chauffeur tape le code de prise en charge que lui donne le vendeur.'; end if;
  if c.validation = 'code' and p_etape = 'reception' then raise exception 'Commande avec codes : le chauffeur tape le code de réception que lui donne l''acheteur.'; end if;
  if (p_lat is null) <> (p_lon is null) or (p_lat is not null and (p_lat not between -90 and 90 or p_lon not between -180 and 180)) then
    raise exception 'Position invalide.';
  end if;
  lieu := public._cmd_texte(p_lieu, 120); nt := public._cmd_texte(p_note, 300);
  pv := case when p_lat is not null then 'gps' else 'declaration' end;
  if p_etape = 'preparation' then
    if r <> 'vendeur' then raise exception 'C''est le vendeur qui prépare la marchandise.'; end if;
    if c.etape <> 'confirmee' then raise exception 'Étape déjà passée.'; end if;
  elsif p_etape = 'chargement' then
    if r <> 'vendeur' then raise exception 'C''est le vendeur qui confirme le chargement.'; end if;
    if c.etape not in ('confirmee', 'preparation') then raise exception 'Le chargement est déjà confirmé.'; end if;
  elsif p_etape = 'transbordement' then
    if c.etape not in ('transport', 'transbordement') then raise exception 'Le transbordement se signale pendant le transport.'; end if;
    if lieu is null then raise exception 'Indiquez le lieu du transbordement.'; end if;
  elsif p_etape = 'arrivee' then
    if r not in ('acheteur', 'chauffeur') then raise exception 'C''est l''acheteur ou le chauffeur qui signale l''arrivée.'; end if;
    if c.etape not in ('transport', 'transbordement') then raise exception 'Le chauffeur doit d''abord être en route.'; end if;
  elsif p_etape = 'reception' then
    if r <> 'acheteur' then raise exception 'C''est l''acheteur qui confirme la réception.'; end if;
    if c.etape not in ('transport', 'transbordement', 'arrivee') then raise exception 'La marchandise doit d''abord être chargée.'; end if;
  else
    raise exception 'Étape inconnue.';
  end if;
  update public.commandes set etape = p_etape where id = p_id;
  perform public._cmd_journal(p_id, p_etape, me, r, pv, lieu, p_lat, p_lon, nt);
  if p_etape = 'chargement' then
    update public.commandes set etape = 'transport' where id = p_id;
    perform public._cmd_journal(p_id, 'transport', null, 'systeme', 'auto');
    return 'transport';
  elsif p_etape = 'reception' then
    update public.commandes set etape = 'terminee', etat = 'terminee', termine_le = now() where id = p_id;
    perform public._cmd_journal(p_id, 'terminee', null, 'systeme', 'auto');
    return 'terminee';
  end if;
  return p_etape;
end $$;

-- admin_affecter : pas de chauffeur sans application pour une commande avec codes
create or replace function public.admin_affecter(p_cmd uuid, p_transporteur uuid) returns text
language plpgsql volatile security definer set search_path = public as $$
declare c public.commandes; t public.transporteurs;
begin
  if not public.est_admin() then raise exception 'Réservé à l''administration.'; end if;
  select * into c from public.commandes where id = p_cmd for update;
  select * into t from public.transporteurs where id = p_transporteur;
  if c.id is null or t.id is null then raise exception 'Commande ou transporteur introuvable.'; end if;
  if t.statut <> 'verifie' then raise exception 'Seul un transporteur vérifié peut être affecté par l''équipe.'; end if;
  if c.validation = 'code' and t.user_id is null then raise exception 'Commande avec codes : choisissez un chauffeur qui a l''application.'; end if;
  if c.etat not in ('a_confirmer', 'en_cours') or coalesce(c.etape, 'confirmee') not in ('confirmee', 'preparation') then raise exception 'Le transporteur s''affecte avant le chargement.'; end if;
  update public.transport_missions set statut = 'retiree', repondu_le = now() where commande_id = c.id and statut in ('proposee', 'acceptee');
  insert into public.transport_missions (commande_id, transporteur_id, propose_par, propose_role, statut, repondu_le)
  values (c.id, t.id, auth.uid(), 'admin', case when t.user_id is null then 'acceptee' else 'proposee' end, case when t.user_id is null then now() end);
  update public.commandes set transporteur_id = case when t.user_id is null then t.id end, updated_at = now() where id = c.id;
  return case when t.user_id is null then 'acceptee' else 'proposee' end;
end $$;

-- commande_journal : les codes apparaissent (création, blocage), jamais leur valeur
create or replace function public.commande_journal(p_id uuid) returns table (evenement text, role text, preuve text, lieu text,
  lat double precision, lon double precision, note text, at timestamptz, par_moi boolean)
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
  ) j order by j.at;
$$;

-- chauffeur_missions : indique si la commande se valide avec codes (et la note de la mission, ex. « Transfert depuis … »)
create or replace function public.chauffeur_missions() returns json
language sql stable security definer set search_path = public as $$
  select coalesce(json_agg(json_build_object(
      'mission_id', m.id, 'mission', m.statut, 'propose_role', m.propose_role, 'propose_le', m.created_at, 'note', m.note,
      'commande_id', c.id, 'numero', c.numero, 'etat', c.etat, 'etape', c.etape, 'validation', c.validation, 'produit', c.produit, 'quantite', c.quantite, 'unite', c.unite,
      'ville_depart', c.ville_depart, 'lieu_livraison', c.lieu_livraison,
      'vendeur', coalesce(public.nom_public(c.vendeur_id), 'Membre'), 'acheteur', coalesce(public.nom_public(c.acheteur_id), 'Membre'),
      'maj', c.updated_at) order by (m.statut = 'proposee') desc, c.updated_at desc), '[]'::json)
  from public.transport_missions m
  join public.transporteurs t on t.id = m.transporteur_id and t.user_id = auth.uid()
  join public.commandes c on c.id = m.commande_id
  where m.statut in ('proposee', 'acceptee') or (m.statut = 'refusee' and m.repondu_le > now() - interval '7 days');
$$;

-- ——— 7) Droits ———
revoke execute on function public._code_six(), public._code_creer(uuid, text, uuid, interval, uuid, text) from public, anon, authenticated;
revoke execute on function public.commande_code_obtenir(uuid, text), public.commande_transfert_preparer(uuid, text, text),
  public.chauffeur_transferts(), public.commande_valider_code(uuid, text, double precision, double precision) from public, anon;
grant execute on function public.commande_code_obtenir(uuid, text), public.commande_transfert_preparer(uuid, text, text),
  public.chauffeur_transferts(), public.commande_valider_code(uuid, text, double precision, double precision) to authenticated;
