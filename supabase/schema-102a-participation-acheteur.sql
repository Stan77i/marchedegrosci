-- Schéma 102a : « Voulez-vous quand même participer ? » (règle du propriétaire, 25/10/2026, validée « Ok »).
-- Projet de TEST d'abord (yowdymdnoiubatxlwhfv) ; production seulement après fusion et accord du propriétaire.
--
-- Règle : le risque de la marchandise reste au vendeur jusqu'à la réception conforme. Marchandise cassée, gâtée, manquante ou
-- non conforme : l'acheteur ne paie rien, ni marchandise ni transport. Quand il signale un problème, l'application lui demande
-- « Voulez-vous quand même participer ? » (jamais « Oui » par défaut). Non : litige normal, il ne paie rien. Oui : il choisit
--   - « transport » : payer seulement le transport (prix du transport à part convenu dans la commande) ;
--   - « partie »    : garder la partie en bon état au prix normal (quantité gardée × prix unitaire) ;
--   - « montant »   : proposer un montant qu'il tape (0 < montant ≤ total initial).
-- Le vendeur accepte ou refuse. Accepté : la commande se termine avec ce montant (nouveau total convenu). Refusé : le litige
-- continue, l'équipe tranche. L'acheteur peut aussi proposer plus tard, pendant un litige : une proposition ouverte à la fois,
-- qu'il peut retirer avant la réponse. AUCUN ARGENT NE BOUGE : le montant est seulement noté.
--
-- Choix faits ici (à valider par le propriétaire, voir docs/regles/SCENARIOS-COMMANDE.md, partie K) :
--   - commission 3,5 % « calculée » sur la part marchandise du montant convenu : 0 pour « transport » (jamais de commission sur
--     le transport à part), quantité gardée × prix pour « partie », le montant tapé (plafonné à la valeur de la marchandise)
--     pour « montant ». Statut « calculée », jamais « due », jamais encaissée (_commission_sync, schéma 95b, inchangé) ;
--   - stock : rien n'est rendu à l'annonce. La marchandise est partie (règle 92a : après le chargement, plus de retour
--     automatique) ; la partie non gardée est cassée, gâtée, ou chez l'acheteur : si le vendeur la reprend en bon état,
--     il remet lui-même la quantité sur son annonce ;
--   - fiabilité : participation acceptée = commande terminée ; aucun « litige perdu » pour personne (mdg.fiab_fautif vide) ;
--   - « partie » ne compte pas le transport : l'acheteur qui veut aussi payer le transport tape un montant ;
--   - « transport » seulement quand la commande a un prix de transport à part ; sinon, taper un montant ;
--   - 3 propositions au plus par commande (réglage participation_max) ; réponse du vendeur en 24 h (participation_reponse_heures),
--     sinon la proposition expire et le litige reste à l'équipe (schéma 102b) ;
--   - commande avec un dépôt d'argent (séquestre) : pas de participation, l'équipe tranche (aucun paiement n'est branché).
-- Trace : la liste fermée de commande_suivi (99a) ne s'élargit pas sans retirer sa contrainte (mot bloqué par le garde-fou) :
-- les propositions vont dans commande_participations (une ligne par proposition, statut qui avance une seule fois) et
-- commande_suivi_lire les rend avec le suivi (genre « participation », schéma 102b).

-- 1. colonnes de la commande : total d'avant la participation (le total convenu devient le montant accepté)
alter table public.commandes add column if not exists total_initial numeric;
alter table public.commandes add column if not exists participation_montant numeric;

-- 2. les propositions
create table if not exists public.commande_participations (
  id bigint generated always as identity primary key,
  commande_id uuid not null references public.commandes(id),
  par uuid not null,
  mode text not null check (mode in ('transport', 'partie', 'montant')),
  quantite_gardee numeric check (quantite_gardee is null or quantite_gardee > 0),
  montant numeric not null check (montant > 0),
  part_marchandise numeric not null check (part_marchandise >= 0),
  total_initial numeric not null check (total_initial > 0),
  statut text not null default 'ouverte' check (statut in ('ouverte', 'acceptee', 'refusee', 'retiree', 'expiree', 'caduque')),
  cree_le timestamptz not null default now(),
  echeance timestamptz not null,
  fin_le timestamptz,
  fin_par uuid,
  note text check (note is null or char_length(note) <= 200)
);
create unique index if not exists commande_participations_une_ouverte on public.commande_participations (commande_id) where statut = 'ouverte';
create index if not exists commande_participations_echeance on public.commande_participations (echeance) where statut = 'ouverte';
alter table public.commande_participations enable row level security;
revoke all on public.commande_participations from anon, authenticated;

-- 3. avis (catégorie « commande », transactionnelle ; textes dans « pousser » v27)
create or replace function public._part_avis(p_user uuid, c public.commandes, p public.commande_participations, p_type text) returns void
language plpgsql security definer set search_path = public as $$
begin
  perform public._notif_mettre(p_user, 'commande', p_type, 'cmdpart:' || p.id || ':' || p_type || ':' || p_user, 'cmd:' || c.id, c.id::text, null, c.produit,
    'application.dc.html#/?commande=' || c.id,
    jsonb_build_object('role', case when p_user = c.vendeur_id then 'vendeur' else 'acheteur' end, 'numero', c.numero, 'mode', p.mode,
      'montant', p.montant, 'quantite', p.quantite_gardee, 'unite', c.unite, 'echeance', p.echeance));
exception when others then null;   -- un avis raté ne bloque jamais la décision
end $$;
revoke all on function public._part_avis(uuid, public.commandes, public.commande_participations, text) from public, anon, authenticated;

-- 4. l'acheteur propose (après « arrivé », ou pendant un litige)
create or replace function public.commande_participation_proposer(p_id uuid, p_mode text, p_quantite_gardee numeric default null,
  p_montant numeric default null, p_motif text default null) returns json
language plpgsql security definer set search_path = public as $$
declare me uuid := auth.uid(); c public.commandes; o public.commande_participations; p public.commande_participations;
  tot numeric; mt numeric; pm numeric; q numeric; h integer := public._cmd_regle('participation_reponse_heures', 24);
  mx integer := public._cmd_regle('participation_max', 3); n integer;
begin
  if me is null then raise exception 'Connectez-vous.'; end if;
  select * into c from public.commandes where id = p_id for update;
  if c.id is null or me is distinct from c.acheteur_id then raise exception 'Commande introuvable.'; end if;
  if public.est_banni(me) then raise exception 'COMPTE_BANNI : ce compte a été banni du Marché de Gros.'; end if;
  if p_mode is null or p_mode not in ('transport', 'partie', 'montant') then
    raise exception 'Choisissez : payer le transport, garder une partie, ou proposer un montant.';
  end if;
  -- état : après « arrivé » (commande en cours à l'arrivée, ou terminée pas encore close) ou en litige après l'arrivée
  if not ((c.etat = 'en_cours' and c.etape = 'arrivee') or (c.etat = 'terminee' and c.libere_le is null)
          or (c.etat = 'litige' and c.etape in ('arrivee', 'reception', 'terminee'))) then
    raise exception 'PARTICIPATION_ETAT : une participation se propose après l''arrivée de la marchandise, ou pendant un litige.';
  end if;
  if public._cmd_argent_passe(c.id) then raise exception 'Commande avec un dépôt d''argent : l''équipe du Marché de Gros tranche.'; end if;
  tot := round(coalesce(c.total_initial, c.total_convenu, c.montant), 0);
  if tot is null or tot <= 0 then raise exception 'Commande sans montant : l''équipe du Marché de Gros tranche.'; end if;
  -- calcul du montant (jamais repris du téléphone pour « transport » et « partie »)
  if p_mode = 'transport' then
    if c.transport_regle is distinct from 'a_part' or coalesce(c.prix_transport, 0) <= 0 then
      raise exception 'Le transport n''a pas de prix à part dans cette commande : proposez plutôt un montant.';
    end if;
    mt := round(c.prix_transport, 0); pm := 0; q := null;
  elsif p_mode = 'partie' then
    if c.quantite is null or c.prix_unitaire is null then raise exception 'Commande sans quantité ou sans prix : proposez plutôt un montant.'; end if;
    q := p_quantite_gardee;
    if q is null or q <= 0 or q > c.quantite then
      raise exception 'Quantité gardée : entre 0 et % %.', c.quantite, coalesce(c.unite, '');
    end if;
    mt := round(q * c.prix_unitaire, 0); pm := mt;
  else
    if p_montant is null or p_montant <> floor(p_montant) or p_montant <= 0 or p_montant > tot then
      raise exception 'Montant : un nombre entier de F CFA, plus de 0 et au plus %.', replace(to_char(tot, 'FM999G999G999G999'), ',', ' ');
    end if;
    mt := round(p_montant, 0); pm := least(mt, round(c.montant, 0)); q := null;
  end if;
  if mt <= 0 then raise exception 'Le montant doit dépasser 0 F.'; end if;
  if mt > tot then raise exception 'Le montant ne peut pas dépasser le total de la commande.'; end if;
  -- une proposition ouverte à la fois ; même proposition renvoyée (double appui, coupure) : même réponse
  select * into o from public.commande_participations where commande_id = c.id and statut = 'ouverte';
  if o.id is not null then
    if o.mode = p_mode and o.montant = mt and o.quantite_gardee is not distinct from q then
      return json_build_object('statut', 'deja_proposee', 'id', o.id, 'montant', o.montant, 'echeance', o.echeance);
    end if;
    raise exception 'PARTICIPATION_OUVERTE : une proposition attend déjà la réponse du vendeur. Retirez-la pour en faire une autre.';
  end if;
  select count(*) into n from public.commande_participations where commande_id = c.id;
  if n >= mx then raise exception 'PARTICIPATION_MAX : % propositions au plus par commande. L''équipe du Marché de Gros tranche.', mx; end if;
  -- pas encore de litige : le signalement l'ouvre (motif obligatoire), comme « Signaler un problème »
  if c.etat <> 'litige' then
    if public._cmd_texte(p_motif, 300) is null then raise exception 'Expliquez le problème en quelques mots.'; end if;
    perform public.commande_litige(c.id, p_motif);
    select * into c from public.commandes where id = p_id;
  end if;
  insert into public.commande_participations (commande_id, par, mode, quantite_gardee, montant, part_marchandise, total_initial, echeance)
  values (c.id, me, p_mode, q, mt, pm, tot, now() + make_interval(hours => h)) returning * into p;
  update public.commandes set updated_at = now() where id = c.id;
  perform public._part_avis(c.vendeur_id, c, p, 'cmd_participation');
  return json_build_object('statut', 'proposee', 'id', p.id, 'montant', p.montant, 'echeance', p.echeance);
end $$;

-- 5. le vendeur répond
create or replace function public.commande_participation_repondre(p_id uuid, p_accepte boolean, p_note text default null) returns json
language plpgsql security definer set search_path = public as $$
declare me uuid := auth.uid(); c public.commandes; p public.commande_participations; nt text;
begin
  if me is null then raise exception 'Connectez-vous.'; end if;
  if p_accepte is null then raise exception 'Acceptez ou refusez la proposition.'; end if;
  select * into c from public.commandes where id = p_id for update;
  if c.id is null or me is distinct from c.vendeur_id then raise exception 'Commande introuvable.'; end if;
  if public.est_banni(me) then raise exception 'COMPTE_BANNI : ce compte a été banni du Marché de Gros.'; end if;
  select * into p from public.commande_participations where commande_id = c.id and statut = 'ouverte' for update;
  if p.id is null then
    -- double appui : la même réponse revient sans erreur
    select * into p from public.commande_participations where commande_id = c.id and statut in ('acceptee', 'refusee')
      and fin_par = me and fin_le > now() - interval '10 minutes' order by fin_le desc limit 1;
    if p.id is not null and (p.statut = 'acceptee') = p_accepte then return json_build_object('statut', p.statut, 'id', p.id, 'montant', p.montant); end if;
    raise exception 'PARTICIPATION_AUCUNE : aucune proposition n''attend votre réponse.';
  end if;
  if c.etat <> 'litige' then raise exception 'Cette commande n''est plus en litige.'; end if;
  nt := public._cmd_texte(p_note, 200);
  if not p_accepte then
    update public.commande_participations set statut = 'refusee', fin_le = now(), fin_par = me, note = nt where id = p.id returning * into p;
    update public.commandes set updated_at = now() where id = c.id;
    perform public._part_avis(c.acheteur_id, c, p, 'cmd_participation_refusee');
    return json_build_object('statut', 'refusee', 'id', p.id);
  end if;
  if public._cmd_argent_passe(c.id) then raise exception 'Commande avec un dépôt d''argent : l''équipe du Marché de Gros tranche.'; end if;
  update public.commande_participations set statut = 'acceptee', fin_le = now(), fin_par = me, note = nt where id = p.id returning * into p;
  -- clôture d'un commun accord : personne n'est en faute (aucun « litige perdu ») ; aucun argent ne bouge
  perform set_config('mdg.fiab_fautif', '', true);
  update public.commandes set etat = 'terminee', etape = 'terminee', termine_le = coalesce(termine_le, now()), libere_le = now(),
    liberation = 'refus', montant_refuse = greatest(round(montant, 0) - p.part_marchandise, 0),
    total_initial = coalesce(total_initial, p.total_initial), total_convenu = p.montant, participation_montant = p.montant
  where id = c.id;
  perform public._cmd_journal(c.id, 'terminee', me, 'vendeur', 'declaration', null, null, null,
    left(format('Participation de l''acheteur acceptée par le vendeur : %s F (%s). Aucun argent n''a été versé par l''application.',
      replace(to_char(p.montant, 'FM999G999G999G999'), ',', ' '),
      case p.mode when 'transport' then 'le transport seulement' when 'partie' then 'garde ' || p.quantite_gardee || ' ' || coalesce(c.unite, '') else 'montant proposé' end)
      || coalesce(' · ' || nt, ''), 300));
  perform public._part_avis(c.acheteur_id, c, p, 'cmd_participation_acceptee');
  return json_build_object('statut', 'acceptee', 'id', p.id, 'montant', p.montant);
end $$;

-- 6. l'acheteur retire sa proposition avant la réponse
create or replace function public.commande_participation_retirer(p_id uuid) returns json
language plpgsql security definer set search_path = public as $$
declare me uuid := auth.uid(); c public.commandes; p public.commande_participations;
begin
  if me is null then raise exception 'Connectez-vous.'; end if;
  select * into c from public.commandes where id = p_id for update;
  if c.id is null or me is distinct from c.acheteur_id then raise exception 'Commande introuvable.'; end if;
  select * into p from public.commande_participations where commande_id = c.id and statut = 'ouverte' for update;
  if p.id is null then
    select * into p from public.commande_participations where commande_id = c.id order by id desc limit 1;
    if p.statut = 'retiree' then return json_build_object('statut', 'retiree', 'id', p.id); end if;
    if p.statut in ('acceptee', 'refusee') then raise exception 'PARTICIPATION_REPONDUE : le vendeur a déjà répondu.'; end if;
    raise exception 'PARTICIPATION_AUCUNE : aucune proposition à retirer.';
  end if;
  update public.commande_participations set statut = 'retiree', fin_le = now(), fin_par = me where id = p.id returning * into p;
  update public.commandes set updated_at = now() where id = c.id;
  perform public._part_avis(c.vendeur_id, c, p, 'cmd_participation_retiree');
  return json_build_object('statut', 'retiree', 'id', p.id);
end $$;

-- 7. ce que l'écran lit : propositions, droits du moment, montants de départ
create or replace function public.commande_participation_lire(p_id uuid) returns json
language plpgsql stable security definer set search_path = public as $$
declare me uuid := auth.uid(); c public.commandes; r text; o public.commande_participations; n integer;
  mx integer := public._cmd_regle('participation_max', 3); etat_ok boolean;
begin
  if me is null then raise exception 'Connectez-vous.'; end if;
  select * into c from public.commandes where id = p_id;
  r := case when c.id is null then null when me = c.acheteur_id then 'acheteur' when me = c.vendeur_id then 'vendeur' end;
  if c.id is null or (r is null and not public.est_admin()) then raise exception 'Commande introuvable.'; end if;
  select * into o from public.commande_participations where commande_id = c.id and statut = 'ouverte';
  select count(*) into n from public.commande_participations where commande_id = c.id;
  etat_ok := (c.etat = 'en_cours' and c.etape = 'arrivee') or (c.etat = 'terminee' and c.libere_le is null)
          or (c.etat = 'litige' and c.etape in ('arrivee', 'reception', 'terminee'));
  return json_build_object(
    'peut_proposer', r = 'acheteur' and etat_ok and o.id is null and n < mx and not public._cmd_argent_passe(c.id),
    'peut_repondre', r = 'vendeur' and o.id is not null and c.etat = 'litige',
    'peut_retirer', r = 'acheteur' and o.id is not null,
    'transport_possible', c.transport_regle = 'a_part' and coalesce(c.prix_transport, 0) > 0,
    'prix_transport', case when c.transport_regle = 'a_part' then c.prix_transport end,
    'quantite', c.quantite, 'unite', c.unite, 'prix_unitaire', c.prix_unitaire,
    'total_initial', coalesce(c.total_initial, c.total_convenu, c.montant),
    'participation_montant', c.participation_montant,
    'restantes', greatest(mx - n, 0),
    'ouverte', case when o.id is null then null else json_build_object('id', o.id, 'mode', o.mode, 'quantite_gardee', o.quantite_gardee,
      'montant', o.montant, 'cree_le', o.cree_le, 'echeance', o.echeance) end,
    'propositions', (select coalesce(json_agg(json_build_object('id', x.id, 'mode', x.mode, 'quantite_gardee', x.quantite_gardee, 'montant', x.montant,
       'statut', x.statut, 'cree_le', x.cree_le, 'echeance', x.echeance, 'fin_le', x.fin_le, 'note', x.note) order by x.id), '[]'::json)
       from public.commande_participations x where x.commande_id = c.id));
end $$;

revoke all on function public.commande_participation_proposer(uuid, text, numeric, numeric, text) from public, anon;
grant execute on function public.commande_participation_proposer(uuid, text, numeric, numeric, text) to authenticated;
revoke all on function public.commande_participation_repondre(uuid, boolean, text) from public, anon;
grant execute on function public.commande_participation_repondre(uuid, boolean, text) to authenticated;
revoke all on function public.commande_participation_retirer(uuid) from public, anon;
grant execute on function public.commande_participation_retirer(uuid) to authenticated;
revoke all on function public.commande_participation_lire(uuid) from public, anon;
grant execute on function public.commande_participation_lire(uuid) to authenticated;

-- 8. la commande sort du litige autrement (l'équipe tranche, mot secret, annulation) : la proposition ouverte devient caduque
create or replace function public._part_caduque() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.etat is distinct from old.etat and new.etat <> 'litige' then
    update public.commande_participations set statut = 'caduque', fin_le = now()
    where commande_id = new.id and statut = 'ouverte';
  end if;
  return new;
end $$;
revoke all on function public._part_caduque() from public, anon, authenticated;
create or replace trigger commandes_participation_caduque after update of etat on public.commandes
  for each row execute function public._part_caduque();
