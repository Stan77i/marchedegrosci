-- Schéma 102d : la participation devient une négociation à trois (acheteur, vendeur, équipe) (règle du propriétaire,
-- 25/10/2026, validée « Ok »). Projet de TEST d'abord (yowdymdnoiubatxlwhfv) ; production seulement après fusion et accord.
-- À appliquer après 102a, 102b et 102c.
--
-- Règle :
--   - l'acheteur ouvre la négociation (après « arrivé », ou pendant un litige) : payer seulement le transport, garder une partie
--     au prix à l'unité (sans le transport), ou un montant ;
--   - le vendeur accepte, refuse, ou CONTRE-PROPOSE (mêmes trois choix) ; l'acheteur répond de même (accepte, refuse,
--     contre-propose) ; une contre-proposition vaut refus de la proposition précédente ;
--   - l'équipe (administrateur qui n'est pas partie à la commande) voit tout, écrit dans la discussion à trois du litige
--     (litige_ecrire, inchangé) et peut PROPOSER un arrangement : il doit être accepté par l'acheteur ET par le vendeur ;
--   - dès que l'acheteur et le vendeur ont accepté la même proposition, c'est validé : la commande se termine avec ce montant
--     (comme 102a : total initial gardé, commission « calculée » sur la part marchandise seulement, aucun litige perdu, rien
--     rendu au stock, AUCUN ARGENT NE BOUGE) ;
--   - « garder une partie » = quantité gardée × prix à l'unité, sans le transport : le transport est alors à la charge du vendeur ;
--   - chacun a participation_reponse_heures (24 h) pour répondre ; sans réponse : la proposition expire et le litige reste à
--     l'équipe (102b) ; sans accord : l'équipe tranche (litige normal, admin_litige_*), ce qui rend la proposition caduque ;
--   - plus de limite du nombre de propositions (participation_max retiré) : une seule proposition ouverte à la fois, double
--     appui sans effet, on ne répond pas à sa propre proposition.
-- Correction au passage : 102b avait réécrit admin_commandes_regler en entier, ce qui effaçait la « porte » du journal de
-- l'équipe (100c) et les réglages livraison_* / arrivee_litige_heures / mot_bloque_heures sur le projet de test. Ici, le corps
-- va dans _j_admin_commandes_regler et la porte est remise (si 100c est appliqué).
-- Fonctions partagées : aucune des fonctions des schémas 103* (branche claude/commandes-15-propositions) n'est réécrite ici.
-- Rien n'est effacé : add column if not exists, create or replace.

-- 1. colonnes : qui propose, qui a accepté, ce qu'elle remplace, un mot
alter table public.commande_participations add column if not exists role text not null default 'acheteur'
  check (role in ('acheteur', 'vendeur', 'equipe'));
alter table public.commande_participations add column if not exists accord_acheteur timestamptz;
alter table public.commande_participations add column if not exists accord_vendeur timestamptz;
alter table public.commande_participations add column if not exists remplace_id bigint references public.commande_participations(id);
alter table public.commande_participations add column if not exists message text check (message is null or char_length(message) <= 200);
update public.commande_participations set accord_acheteur = cree_le where role = 'acheteur' and accord_acheteur is null;

-- 2. réglage retiré : plus de plafond de propositions
update public.reglages set valeur = valeur - 'participation_max' where cle = 'commandes' and valeur ? 'participation_max';

-- 3. avis : le rôle du destinataire, et qui a proposé
create or replace function public._part_avis(p_user uuid, c public.commandes, p public.commande_participations, p_type text) returns void
language plpgsql security definer set search_path = public as $$
begin
  if p_user is null then return; end if;
  perform public._notif_mettre(p_user, 'commande', p_type, 'cmdpart:' || p.id || ':' || p_type || ':' || p_user, 'cmd:' || c.id, c.id::text, null, c.produit,
    'application.dc.html#/?commande=' || c.id,
    jsonb_build_object('role', case when p_user = c.vendeur_id then 'vendeur' else 'acheteur' end, 'auteur', p.role, 'numero', c.numero,
      'mode', p.mode, 'montant', p.montant, 'quantite', p.quantite_gardee, 'unite', c.unite, 'echeance', p.echeance));
exception when others then null;   -- un avis raté ne bloque jamais la décision
end $$;
revoke all on function public._part_avis(uuid, public.commandes, public.commande_participations, text) from public, anon, authenticated;

-- 4. calcul du montant (jamais repris du téléphone pour « transport » et « partie »)
create or replace function public._part_calcul(c public.commandes, p_mode text, p_quantite numeric, p_montant numeric,
  out mt numeric, out pm numeric, out q numeric, out tot numeric)
language plpgsql stable security definer set search_path = public as $$
begin
  if p_mode is null or p_mode not in ('transport', 'partie', 'montant') then
    raise exception 'Choisissez : payer le transport, garder une partie, ou proposer un montant.';
  end if;
  tot := round(coalesce(c.total_initial, c.total_convenu, c.montant), 0);
  if tot is null or tot <= 0 then raise exception 'Commande sans montant : l''équipe du Marché de Gros tranche.'; end if;
  if p_mode = 'transport' then
    if c.transport_regle is distinct from 'a_part' or coalesce(c.prix_transport, 0) <= 0 then
      raise exception 'Le transport n''a pas de prix à part dans cette commande : proposez plutôt un montant.';
    end if;
    mt := round(c.prix_transport, 0); pm := 0; q := null;
  elsif p_mode = 'partie' then
    if c.quantite is null or c.prix_unitaire is null then raise exception 'Commande sans quantité ou sans prix à l''unité : proposez plutôt un montant.'; end if;
    q := p_quantite;
    if q is null or q <= 0 or q > c.quantite then raise exception 'Quantité gardée : entre 0 et % %.', c.quantite, coalesce(c.unite, ''); end if;
    if q <> trunc(q) and public._unite_entiere(c.unite) then raise exception 'La quantité gardée doit être un nombre entier (unité : %).', c.unite; end if;
    mt := round(q * c.prix_unitaire, 0); pm := mt;
  else
    if p_montant is null or p_montant <> floor(p_montant) or p_montant <= 0 or p_montant > tot then
      raise exception 'Montant : un nombre entier de F CFA, plus de 0 et au plus %.', replace(to_char(tot, 'FM999G999G999G999'), ',', ' ');
    end if;
    mt := round(p_montant, 0); pm := least(mt, round(c.montant, 0)); q := null;
  end if;
  if mt <= 0 then raise exception 'Le montant doit dépasser 0 F.'; end if;
  if mt > tot then raise exception 'Le montant ne peut pas dépasser le total de la commande.'; end if;
end $$;
revoke all on function public._part_calcul(public.commandes, text, numeric, numeric) from public, anon, authenticated;

-- 5. l'état où la négociation est possible
create or replace function public._part_etat_ok(c public.commandes) returns boolean
language sql stable set search_path = public as $$
  select (c.etat = 'en_cours' and c.etape = 'arrivee') or (c.etat = 'terminee' and c.libere_le is null)
      or (c.etat = 'litige' and c.etape in ('arrivee', 'reception', 'terminee'));
$$;
revoke all on function public._part_etat_ok(public.commandes) from public, anon, authenticated;

-- 6. validation : l'acheteur et le vendeur ont accepté la même proposition
create or replace function public._part_valider(c public.commandes, p public.commande_participations, me uuid, r text, nt text) returns json
language plpgsql security definer set search_path = public as $$
begin
  if public._cmd_argent_passe(c.id) then raise exception 'Commande avec un dépôt d''argent : l''équipe du Marché de Gros tranche.'; end if;
  update public.commande_participations set statut = 'acceptee', fin_le = now(), fin_par = me, note = coalesce(nt, note),
    accord_acheteur = coalesce(accord_acheteur, now()), accord_vendeur = coalesce(accord_vendeur, now())
  where id = p.id returning * into p;
  -- clôture d'un commun accord : personne n'est en faute (aucun « litige perdu ») ; aucun argent ne bouge
  perform set_config('mdg.fiab_fautif', '', true);
  update public.commandes set etat = 'terminee', etape = 'terminee', termine_le = coalesce(termine_le, now()), libere_le = now(),
    liberation = 'refus', montant_refuse = greatest(round(montant, 0) - p.part_marchandise, 0),
    total_initial = coalesce(total_initial, p.total_initial), total_convenu = p.montant, participation_montant = p.montant
  where id = c.id;
  perform public._cmd_journal(c.id, 'terminee', me, r, 'declaration', null, null, null,
    left(format('Participation convenue (proposée par %s, acceptée par l''acheteur et le vendeur) : %s F (%s).%s Aucun argent n''a été versé par l''application.',
      case p.role when 'acheteur' then 'l''acheteur' when 'vendeur' then 'le vendeur' else 'l''équipe' end,
      replace(to_char(p.montant, 'FM999G999G999G999'), ',', ' '),
      case p.mode when 'transport' then 'le transport seulement' when 'partie' then 'garde ' || trim_scale(p.quantite_gardee) || ' ' || coalesce(c.unite, '') else 'montant' end,
      case when p.mode = 'partie' and c.transport_regle = 'a_part' then ' Transport à la charge du vendeur.' else '' end)
      || coalesce(' · ' || nt, ''), 300));
  if me is distinct from c.acheteur_id then perform public._part_avis(c.acheteur_id, c, p, 'cmd_participation_acceptee'); end if;
  if me is distinct from c.vendeur_id then perform public._part_avis(c.vendeur_id, c, p, 'cmd_participation_acceptee'); end if;
  return json_build_object('statut', 'acceptee', 'id', p.id, 'montant', p.montant);
end $$;
revoke all on function public._part_valider(public.commandes, public.commande_participations, uuid, text, text) from public, anon, authenticated;

-- 7. l'acheteur ou le vendeur propose (ou contre-propose)
create or replace function public.commande_participation_proposer(p_id uuid, p_mode text, p_quantite_gardee numeric default null,
  p_montant numeric default null, p_motif text default null) returns json
language plpgsql security definer set search_path = public as $$
declare me uuid := auth.uid(); c public.commandes; o public.commande_participations; p public.commande_participations; k record;
  r text; h integer := public._cmd_regle('participation_reponse_heures', 24); msg text; rid bigint;
begin
  if me is null then raise exception 'Connectez-vous.'; end if;
  select * into c from public.commandes where id = p_id for update;
  r := case when c.id is null then null when me = c.acheteur_id then 'acheteur' when me = c.vendeur_id then 'vendeur' end;
  if r is null then raise exception 'Commande introuvable.'; end if;
  if public.est_banni(me) then raise exception 'COMPTE_BANNI : ce compte a été banni du Marché de Gros.'; end if;
  if not public._part_etat_ok(c) then
    raise exception 'PARTICIPATION_ETAT : une participation se propose après l''arrivée de la marchandise, ou pendant un litige.';
  end if;
  -- le vendeur répond à une négociation ouverte par l'acheteur (ou par une proposition de l'équipe), pendant le litige
  if r = 'vendeur' and (c.etat <> 'litige' or not exists (select 1 from public.commande_participations x
       where x.commande_id = c.id and x.role in ('acheteur', 'equipe'))) then
    raise exception 'PARTICIPATION_VENDEUR : le vendeur répond à une proposition de l''acheteur ou de l''équipe.';
  end if;
  if public._cmd_argent_passe(c.id) then raise exception 'Commande avec un dépôt d''argent : l''équipe du Marché de Gros tranche.'; end if;
  select * into k from public._part_calcul(c, p_mode, p_quantite_gardee, p_montant);
  -- une seule proposition ouverte à la fois
  select * into o from public.commande_participations where commande_id = c.id and statut = 'ouverte' for update;
  if o.id is not null then
    if o.mode = p_mode and o.montant = k.mt and o.quantite_gardee is not distinct from k.q then
      if o.par = me then return json_build_object('statut', 'deja_proposee', 'id', o.id, 'montant', o.montant, 'echeance', o.echeance); end if;
      raise exception 'PARTICIPATION_IDENTIQUE : c''est la proposition en attente : acceptez-la.';
    end if;
    if o.par = me then
      raise exception 'PARTICIPATION_OUVERTE : votre proposition attend une réponse. Retirez-la pour en faire une autre.';
    end if;
    -- contre-proposition : la proposition en attente est refusée
    update public.commande_participations set statut = 'refusee', fin_le = now(), fin_par = me, note = 'Contre-proposition'
    where id = o.id;
    rid := o.id;
  end if;
  -- pas encore de litige : le signalement l'ouvre (motif obligatoire), comme « Signaler un problème »
  if c.etat <> 'litige' then
    if public._cmd_texte(p_motif, 300) is null then raise exception 'Expliquez le problème en quelques mots.'; end if;
    perform public.commande_litige(c.id, p_motif);
    select * into c from public.commandes where id = p_id;
    msg := left(btrim(p_motif), 200);
  else
    msg := public._cmd_texte(p_motif, 200);
  end if;
  insert into public.commande_participations (commande_id, par, role, mode, quantite_gardee, montant, part_marchandise, total_initial, echeance,
    accord_acheteur, accord_vendeur, remplace_id, message)
  values (c.id, me, r, p_mode, k.q, k.mt, k.pm, k.tot, now() + make_interval(hours => h),
    case when r = 'acheteur' then now() end, case when r = 'vendeur' then now() end, rid, msg) returning * into p;
  update public.commandes set updated_at = now() where id = c.id;
  perform public._part_avis(case when r = 'acheteur' then c.vendeur_id else c.acheteur_id end, c, p,
    case when rid is null then 'cmd_participation' else 'cmd_participation_contre' end);
  return json_build_object('statut', 'proposee', 'id', p.id, 'montant', p.montant, 'echeance', p.echeance, 'remplace', rid);
end $$;

-- 8. l'équipe propose un arrangement (à accepter par les deux)
create or replace function public.commande_participation_equipe(p_id uuid, p_mode text, p_quantite_gardee numeric default null,
  p_montant numeric default null, p_note text default null) returns json
language plpgsql security definer set search_path = public as $$
declare me uuid := auth.uid(); c public.commandes; o public.commande_participations; p public.commande_participations; k record;
  h integer := public._cmd_regle('participation_reponse_heures', 24); nt text; rid bigint;
begin
  if me is null or not public.est_admin() then raise exception 'Réservé à l''administration.'; end if;
  select * into c from public.commandes where id = p_id for update;
  if c.id is null then raise exception 'Commande introuvable.'; end if;
  if me in (c.vendeur_id, c.acheteur_id) then
    raise exception 'CONFLIT_INTERETS : vous êtes partie à cette commande. Un autre membre de l''équipe doit proposer.';
  end if;
  if not (c.etat = 'litige' and c.etape in ('arrivee', 'reception', 'terminee')) then
    raise exception 'PARTICIPATION_ETAT : l''équipe propose un arrangement pendant un litige, après l''arrivée.';
  end if;
  if public._cmd_argent_passe(c.id) then raise exception 'Commande avec un dépôt d''argent : l''équipe tranche (aucun arrangement).'; end if;
  nt := public._cmd_texte(p_note, 200);
  select * into k from public._part_calcul(c, p_mode, p_quantite_gardee, p_montant);
  select * into o from public.commande_participations where commande_id = c.id and statut = 'ouverte' for update;
  if o.id is not null then
    if o.role = 'equipe' and o.mode = p_mode and o.montant = k.mt and o.quantite_gardee is not distinct from k.q then
      return json_build_object('statut', 'deja_proposee', 'id', o.id, 'montant', o.montant, 'echeance', o.echeance);
    end if;
    update public.commande_participations set statut = 'caduque', fin_le = now(), fin_par = me, note = 'Remplacée par une proposition de l''équipe'
    where id = o.id;
    rid := o.id;
  end if;
  insert into public.commande_participations (commande_id, par, role, mode, quantite_gardee, montant, part_marchandise, total_initial, echeance,
    remplace_id, message)
  values (c.id, me, 'equipe', p_mode, k.q, k.mt, k.pm, k.tot, now() + make_interval(hours => h), rid, nt) returning * into p;
  update public.commandes set updated_at = now() where id = c.id;
  insert into public.admin_journal (admin_id, action, cible_id, motif, detail)
  values (me, 'commande_participation_equipe', c.id, nt, jsonb_build_object('participation', p.id, 'mode', p.mode, 'montant', p.montant,
    'quantite_gardee', p.quantite_gardee, 'remplace', rid));
  perform public._part_avis(c.acheteur_id, c, p, 'cmd_participation_equipe');
  perform public._part_avis(c.vendeur_id, c, p, 'cmd_participation_equipe');
  return json_build_object('statut', 'proposee', 'id', p.id, 'montant', p.montant, 'echeance', p.echeance, 'remplace', rid);
end $$;

-- 9. l'acheteur ou le vendeur répond (accepte ou refuse) ; une proposition de l'équipe attend les deux accords
create or replace function public.commande_participation_repondre(p_id uuid, p_accepte boolean, p_note text default null) returns json
language plpgsql security definer set search_path = public as $$
declare me uuid := auth.uid(); c public.commandes; p public.commande_participations; r text; nt text; deja timestamptz;
begin
  if me is null then raise exception 'Connectez-vous.'; end if;
  if p_accepte is null then raise exception 'Acceptez ou refusez la proposition.'; end if;
  select * into c from public.commandes where id = p_id for update;
  r := case when c.id is null then null when me = c.acheteur_id then 'acheteur' when me = c.vendeur_id then 'vendeur' end;
  if r is null then raise exception 'Commande introuvable.'; end if;
  if public.est_banni(me) then raise exception 'COMPTE_BANNI : ce compte a été banni du Marché de Gros.'; end if;
  select * into p from public.commande_participations where commande_id = c.id and statut = 'ouverte' for update;
  if p.id is null then
    -- double appui : la même réponse revient sans erreur
    select * into p from public.commande_participations where commande_id = c.id and statut in ('acceptee', 'refusee')
      and fin_le > now() - interval '10 minutes'
      and (fin_par = me or (r = 'acheteur' and accord_acheteur is not null) or (r = 'vendeur' and accord_vendeur is not null))
    order by fin_le desc, id desc limit 1;
    if p.id is not null and (p.statut = 'acceptee') = p_accepte then return json_build_object('statut', p.statut, 'id', p.id, 'montant', p.montant); end if;
    raise exception 'PARTICIPATION_AUCUNE : aucune proposition n''attend votre réponse.';
  end if;
  if p.par = me then raise exception 'PARTICIPATION_PROPRE : vous ne pouvez pas répondre à votre propre proposition.'; end if;
  if c.etat <> 'litige' then raise exception 'Cette commande n''est plus en litige.'; end if;
  nt := public._cmd_texte(p_note, 200);
  deja := case when r = 'acheteur' then p.accord_acheteur else p.accord_vendeur end;
  if not p_accepte then
    update public.commande_participations set statut = 'refusee', fin_le = now(), fin_par = me, note = nt where id = p.id returning * into p;
    update public.commandes set updated_at = now() where id = c.id;
    if p.role = 'equipe' then
      perform public._part_avis(case when r = 'acheteur' then c.vendeur_id else c.acheteur_id end, c, p, 'cmd_participation_refusee');
    else
      perform public._part_avis(p.par, c, p, 'cmd_participation_refusee');
    end if;
    return json_build_object('statut', 'refusee', 'id', p.id);
  end if;
  if deja is not null then
    -- déjà accepté par moi (proposition de l'équipe) : on attend l'autre
    return json_build_object('statut', 'ouverte', 'id', p.id, 'attend', case when r = 'acheteur' then 'vendeur' else 'acheteur' end);
  end if;
  if r = 'acheteur' then update public.commande_participations set accord_acheteur = now() where id = p.id returning * into p;
  else update public.commande_participations set accord_vendeur = now() where id = p.id returning * into p; end if;
  if p.accord_acheteur is not null and p.accord_vendeur is not null then
    return public._part_valider(c, p, me, r, nt);
  end if;
  update public.commandes set updated_at = now() where id = c.id;
  perform public._part_avis(case when r = 'acheteur' then c.vendeur_id else c.acheteur_id end, c, p, 'cmd_participation_un_accord');
  return json_build_object('statut', 'ouverte', 'id', p.id, 'attend', case when r = 'acheteur' then 'vendeur' else 'acheteur' end);
end $$;

-- 10. l'auteur retire sa proposition avant la réponse (l'équipe retire la sienne)
create or replace function public.commande_participation_retirer(p_id uuid) returns json
language plpgsql security definer set search_path = public as $$
declare me uuid := auth.uid(); c public.commandes; p public.commande_participations; r text;
begin
  if me is null then raise exception 'Connectez-vous.'; end if;
  select * into c from public.commandes where id = p_id for update;
  r := case when c.id is null then null when me = c.acheteur_id then 'acheteur' when me = c.vendeur_id then 'vendeur'
            when public.est_admin() then 'equipe' end;
  if r is null then raise exception 'Commande introuvable.'; end if;
  select * into p from public.commande_participations where commande_id = c.id and statut = 'ouverte' for update;
  if p.id is null then
    select * into p from public.commande_participations where commande_id = c.id order by id desc limit 1;
    if p.statut = 'retiree' and (p.fin_par = me or (r = 'equipe' and p.role = 'equipe')) then return json_build_object('statut', 'retiree', 'id', p.id); end if;
    if p.statut in ('acceptee', 'refusee') then raise exception 'PARTICIPATION_REPONDUE : la proposition a déjà reçu une réponse.'; end if;
    raise exception 'PARTICIPATION_AUCUNE : aucune proposition à retirer.';
  end if;
  if not (p.par = me or (r = 'equipe' and p.role = 'equipe')) then
    raise exception 'PARTICIPATION_AUCUNE : aucune proposition à retirer (seul son auteur la retire).';
  end if;
  update public.commande_participations set statut = 'retiree', fin_le = now(), fin_par = me where id = p.id returning * into p;
  update public.commandes set updated_at = now() where id = c.id;
  if r <> 'acheteur' then perform public._part_avis(c.acheteur_id, c, p, 'cmd_participation_retiree'); end if;
  if r <> 'vendeur' then perform public._part_avis(c.vendeur_id, c, p, 'cmd_participation_retiree'); end if;
  if r = 'equipe' then
    insert into public.admin_journal (admin_id, action, cible_id, motif, detail)
    values (me, 'commande_participation_retirer', c.id, null, jsonb_build_object('participation', p.id));
  end if;
  return json_build_object('statut', 'retiree', 'id', p.id);
end $$;

-- 11. ce que l'écran lit (acheteur, vendeur, équipe)
create or replace function public.commande_participation_lire(p_id uuid) returns json
language plpgsql stable security definer set search_path = public as $$
declare me uuid := auth.uid(); c public.commandes; r text; o public.commande_participations; ouverte_pour_moi boolean;
  argent boolean; deja timestamptz; demarre boolean;
begin
  if me is null then raise exception 'Connectez-vous.'; end if;
  select * into c from public.commandes where id = p_id;
  r := case when c.id is null then null when me = c.acheteur_id then 'acheteur' when me = c.vendeur_id then 'vendeur'
            when public.est_admin() then 'equipe' end;
  if r is null then raise exception 'Commande introuvable.'; end if;
  select * into o from public.commande_participations where commande_id = c.id and statut = 'ouverte';
  argent := public._cmd_argent_passe(c.id);
  demarre := exists (select 1 from public.commande_participations x where x.commande_id = c.id and x.role in ('acheteur', 'equipe'));
  deja := case r when 'acheteur' then o.accord_acheteur when 'vendeur' then o.accord_vendeur end;
  ouverte_pour_moi := o.id is not null and r <> 'equipe' and o.par <> me and deja is null and c.etat = 'litige';
  return json_build_object(
    'role', r,
    'peut_proposer', not argent and case r
       when 'acheteur' then public._part_etat_ok(c) and (o.id is null or o.par <> me)
       when 'vendeur' then c.etat = 'litige' and public._part_etat_ok(c) and demarre and (o.id is null or o.par <> me)
       else c.etat = 'litige' and c.etape in ('arrivee', 'reception', 'terminee') and me not in (c.vendeur_id, c.acheteur_id) end,
    'contre', o.id is not null and r <> 'equipe' and o.par <> me,
    'peut_repondre', ouverte_pour_moi,
    'peut_retirer', o.id is not null and (o.par = me or (r = 'equipe' and o.role = 'equipe')),
    'transport_possible', c.transport_regle = 'a_part' and coalesce(c.prix_transport, 0) > 0,
    'prix_transport', case when c.transport_regle = 'a_part' then c.prix_transport end,
    'quantite', c.quantite, 'unite', c.unite, 'prix_unitaire', c.prix_unitaire,
    'total_initial', coalesce(c.total_initial, c.total_convenu, c.montant),
    'participation_montant', c.participation_montant,
    'reponse_heures', public._cmd_regle('participation_reponse_heures', 24),
    'ouverte', case when o.id is null then null else json_build_object('id', o.id, 'role', o.role, 'mode', o.mode, 'quantite_gardee', o.quantite_gardee,
      'montant', o.montant, 'message', o.message, 'cree_le', o.cree_le, 'echeance', o.echeance,
      'accord_acheteur', o.accord_acheteur is not null, 'accord_vendeur', o.accord_vendeur is not null, 'remplace_id', o.remplace_id) end,
    'propositions', (select coalesce(json_agg(json_build_object('id', x.id, 'role', x.role, 'mode', x.mode, 'quantite_gardee', x.quantite_gardee,
       'montant', x.montant, 'statut', x.statut, 'message', x.message, 'note', x.note, 'cree_le', x.cree_le, 'echeance', x.echeance,
       'fin_le', x.fin_le, 'remplace_id', x.remplace_id, 'accord_acheteur', x.accord_acheteur is not null,
       'accord_vendeur', x.accord_vendeur is not null) order by x.id), '[]'::json)
       from public.commande_participations x where x.commande_id = c.id));
end $$;

revoke all on function public.commande_participation_proposer(uuid, text, numeric, numeric, text) from public, anon;
grant execute on function public.commande_participation_proposer(uuid, text, numeric, numeric, text) to authenticated;
revoke all on function public.commande_participation_equipe(uuid, text, numeric, numeric, text) from public, anon;
grant execute on function public.commande_participation_equipe(uuid, text, numeric, numeric, text) to authenticated;
revoke all on function public.commande_participation_repondre(uuid, boolean, text) from public, anon;
grant execute on function public.commande_participation_repondre(uuid, boolean, text) to authenticated;
revoke all on function public.commande_participation_retirer(uuid) from public, anon;
grant execute on function public.commande_participation_retirer(uuid) to authenticated;
revoke all on function public.commande_participation_lire(uuid) from public, anon;
grant execute on function public.commande_participation_lire(uuid) to authenticated;

-- 12. l'acheteur a réagi pendant le litige automatique : il propose, ou il accepte une proposition (102b + accords)
create or replace function public._cmd_acheteur_a_reagi(c public.commandes) returns boolean
language sql stable security definer set search_path = public as $$
  select c.litige_par is not null
      or (c.refus_le is not null and c.refus_le >= c.litige_auto_le)
      or exists (select 1 from public.litige_messages m where m.commande_id = c.id and m.auteur_id = c.acheteur_id and m.at >= c.litige_auto_le)
      or exists (select 1 from public.commande_participations p where p.commande_id = c.id
                 and ((p.par = c.acheteur_id and p.cree_le >= c.litige_auto_le) or p.accord_acheteur >= c.litige_auto_le
                      or (p.fin_par = c.acheteur_id and p.fin_le >= c.litige_auto_le)));
$$;
revoke all on function public._cmd_acheteur_a_reagi(public.commandes) from public, anon, authenticated;

-- 13. le suivi : qui a proposé
create or replace function public.commande_suivi_lire(p_id uuid) returns json
language plpgsql stable security definer set search_path = public as $$
declare me uuid := auth.uid(); c public.commandes;
begin
  if me is null then raise exception 'Connectez-vous.'; end if;
  select * into c from public.commandes where id = p_id;
  if c.id is null or (public._cmd_role2(c, me) is null and not public.est_admin()) then raise exception 'Commande introuvable.'; end if;
  return (select coalesce(json_agg(x.j order by x.at), '[]'::json) from (
    select s.at, json_build_object('genre', s.genre, 'role', s.role, 'motif', s.motif, 'texte', s.texte,
      'date_estimee', s.date_estimee, 'heures', s.heures, 'at', s.at) j
    from public.commande_suivi s where s.commande_id = c.id
    union all
    select p.cree_le, json_build_object('genre', 'participation', 'role', p.role, 'mode', p.mode, 'quantite_gardee', p.quantite_gardee,
      'montant', p.montant, 'statut', p.statut, 'echeance', p.echeance, 'fin_le', p.fin_le, 'texte', coalesce(p.message, p.note),
      'remplace_id', p.remplace_id, 'at', p.cree_le)
    from public.commande_participations p where p.commande_id = c.id) x);
end $$;
revoke all on function public.commande_suivi_lire(uuid) from public, anon;
grant execute on function public.commande_suivi_lire(uuid) to authenticated;

-- 14. les règles (sans participation_max)
create or replace function public.commandes_regles() returns json
language sql stable security definer set search_path = public as $$
  select json_build_object('accord_sans_suite_heures', public._cmd_regle('accord_sans_suite_heures', 72),
    'chargement_heures', public._cmd_regle('chargement_heures', 72), 'rappel_chargement_heures', public._cmd_regle('rappel_chargement_heures', 12),
    'reception_minutes', public._cmd_regle('reception_minutes', 60), 'litige_sans_reponse_minutes', public._cmd_regle('litige_sans_reponse_minutes', 60),
    'litige_heures', public._cmd_regle('litige_heures', 72), 'mot_essais', public._cmd_regle('mot_essais', 5),
    'montant_max', public._cmd_montant_max(),
    'participation_reponse_heures', public._cmd_regle('participation_reponse_heures', 24));
$$;

-- 15. réglage par l'équipe : le corps dans _j_admin_commandes_regler, la porte du journal (100c) devant
create or replace function public._j_admin_commandes_regler(p_valeurs jsonb) returns json
language plpgsql security definer set search_path = public as $$
declare k text; v jsonb; cur jsonb; x numeric;
begin
  if not public.est_admin() then raise exception 'Réservé à l''administration.'; end if;
  select valeur into cur from public.reglages where cle = 'commandes' for update;
  for k, v in select * from jsonb_each(coalesce(p_valeurs, '{}'::jsonb)) loop
    if k not in ('accord_sans_suite_heures', 'chargement_heures', 'rappel_chargement_heures', 'reception_heures', 'litige_heures', 'mot_essais',
                 'reception_minutes', 'litige_sans_reponse_minutes', 'montant_max', 'participation_reponse_heures') then
      raise exception 'Réglage inconnu : %', k;
    end if;
    if jsonb_typeof(v) <> 'number' then raise exception 'Valeur incorrecte pour %.', k; end if;
    x := (v #>> '{}')::numeric;
    if x <> floor(x) then raise exception 'Valeur incorrecte pour % (nombre entier).', k; end if;
    if k = 'montant_max' then
      if x < 1000000 or x > 100000000000 then raise exception 'Valeur incorrecte pour montant_max (de 1 000 000 à 100 000 000 000 F CFA).'; end if;
    elsif k like '%_minutes' then
      if x < 15 or x > 2880 then raise exception 'Valeur incorrecte pour % (de 15 à 2880 minutes).', k; end if;
    elsif x < 1 or x > 720 then
      raise exception 'Valeur incorrecte pour % (de 1 à 720).', k;
    end if;
    cur := jsonb_set(cur, array[k], v);
  end loop;
  if (cur ->> 'rappel_chargement_heures')::int >= (cur ->> 'chargement_heures')::int then
    raise exception 'Le rappel doit partir avant la fin du délai de chargement.';
  end if;
  if (cur ->> 'mot_essais')::int > 20 then raise exception 'Mot secret : 20 essais au plus.'; end if;
  update public.reglages set valeur = cur, maj_le = now(), maj_par = auth.uid() where cle = 'commandes';
  return cur::json;
end $$;
revoke all on function public._j_admin_commandes_regler(jsonb) from public, anon, authenticated;

do $porte$
begin
  if to_regprocedure('public._adm_noter(text, jsonb, jsonb, jsonb)') is not null then
    execute $f$
create or replace function public.admin_commandes_regler(p_valeurs jsonb) returns json
language plpgsql security definer set search_path = public as $c$
declare a jsonb := jsonb_build_object('p_valeurs', p_valeurs); av jsonb; r json;
begin
  perform public._adm_conflit('admin_commandes_regler', a);
  if coalesce(current_setting('mdg.adm_dans', true), '') = '1' then
    return public._j_admin_commandes_regler(p_valeurs);
  end if;
  av := public._adm_avant('admin_commandes_regler', a);
  perform set_config('mdg.adm_dans', '1', true);
  r := public._j_admin_commandes_regler(p_valeurs);
  perform set_config('mdg.adm_dans', '', true);
  perform public._adm_noter('admin_commandes_regler', a, av, to_jsonb(r));
  return r;
end $c$ $f$;
  else
    execute $f$
create or replace function public.admin_commandes_regler(p_valeurs jsonb) returns json
language sql security definer set search_path = public as $c$ select public._j_admin_commandes_regler(p_valeurs) $c$ $f$;
  end if;
end $porte$;
revoke all on function public.admin_commandes_regler(jsonb) from public, anon;
grant execute on function public.admin_commandes_regler(jsonb) to authenticated;
