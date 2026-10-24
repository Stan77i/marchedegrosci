-- ═════════ Marché de Gros CI — schéma 92c : l'équipe peut sortir toute commande, et voit les échéances ═════════
-- Audit du 24/10/2026 : P1 n° 2 (issue admin), P2 n° 13 (échéance et partage des litiges), P3 n° 33 (admin_refus_trancher).
--   • admin_commande_issue : décision de l'équipe pour une commande à confirmer ou en cours (annulée avec ou sans faute, ou livrée) ;
--     passe par le litige pour que la faute compte dans la fiabilité (schéma 84) ; journalisée (rôle « admin », note obligatoire) ;
--   • admin_litige_partager : issue « partage » d'un litige (une partie de la marchandise n'est pas due) ;
--   • admin_refus_trancher pose l'étape « terminee » et la date de fin ;
--   • admin_commandes : échéances, retards, mot bloqué, redemandes d'annulation épuisées ; « À traiter » les inclut.
-- Aucun argent ne passe par l'application : « n'est pas dû » plutôt que « remboursé ». Testé sur le projet de test.

create or replace function public.admin_commande_issue(p_cmd uuid, p_issue text, p_note text, p_fautif text default null) returns text
language plpgsql security definer set search_path = public as $$
declare c public.commandes; nt text := nullif(btrim(coalesce(p_note, '')), '');
begin
  if not public.est_admin() then raise exception 'Réservé à l''administration.'; end if;
  if p_issue not in ('terminee', 'annulee') then raise exception 'Issue inconnue : livrée (terminee) ou annulée (annulee).'; end if;
  if nt is null or char_length(nt) > 300 then raise exception 'Expliquez la décision (300 caractères au plus).'; end if;
  if p_fautif is not null and p_fautif not in ('vendeur', 'acheteur') then raise exception 'Partie fautive : vendeur, acheteur ou personne.'; end if;
  if p_issue = 'terminee' and p_fautif is not null then raise exception 'Une commande livrée n''a pas de partie fautive.'; end if;
  select * into c from public.commandes where id = p_cmd for update;
  if c.id is null then raise exception 'Commande introuvable.'; end if;
  if c.etat = 'litige' then raise exception 'Cette commande est en litige : tranchez le litige.'; end if;
  if c.etat not in ('a_confirmer', 'en_cours') then raise exception 'Cette commande n''est plus en cours.'; end if;
  update public.commandes set etat = 'litige', litige_par = null, litige_le = now(), litige_motif = left('Décision de l''équipe : ' || nt, 300),
    litige_echeance = now(), annulation_par = null where id = c.id;
  perform public.admin_litige_clore(p_cmd, p_issue, nt, p_fautif);
  return p_issue;
end $$;
revoke all on function public.admin_commande_issue(uuid, text, text, text) from public, anon;
grant execute on function public.admin_commande_issue(uuid, text, text, text) to authenticated;

create or replace function public.admin_litige_partager(p_cmd uuid, p_quantite numeric, p_note text) returns void
language plpgsql security definer set search_path = public as $$
declare c public.commandes; nt text := nullif(btrim(coalesce(p_note, '')), ''); mr numeric;
begin
  if not public.est_admin() then raise exception 'Réservé à l''administration.'; end if;
  if nt is null or char_length(nt) > 300 then raise exception 'Expliquez la décision (300 caractères au plus).'; end if;
  select * into c from public.commandes where id = p_cmd for update;
  if c.id is null or c.etat <> 'litige' then raise exception 'Cette commande n''est pas en litige.'; end if;
  if c.quantite is null or c.prix_unitaire is null then raise exception 'Commande sans quantité ou sans prix : choisissez livrée ou annulée.'; end if;
  if p_quantite is null or p_quantite <= 0 or p_quantite >= c.quantite then
    raise exception 'Partage : indiquez la quantité qui n''est pas due, entre 0 et % (exclus).', c.quantite;
  end if;
  mr := least(round(p_quantite * c.prix_unitaire, 0), round(c.montant, 0));
  update public.commandes set etat = 'terminee', etape = 'terminee', termine_le = coalesce(termine_le, now()), libere_le = now(),
    liberation = 'admin', montant_refuse = mr where id = c.id;
  perform public._cmd_journal(c.id, 'terminee', auth.uid(), 'admin', 'admin', null, null, null,
    left(format('Partage décidé par l''équipe : %s %s ne sont pas dus (%s F) · ', p_quantite, coalesce(c.unite, ''), mr) || nt, 300));
end $$;
revoke all on function public.admin_litige_partager(uuid, numeric, text) from public, anon;
grant execute on function public.admin_litige_partager(uuid, numeric, text) to authenticated;

create or replace function public.admin_refus_trancher(p_cmd uuid, p_quantite numeric, p_note text) returns void
language plpgsql security definer set search_path = public as $$
declare c public.commandes; nt text := nullif(btrim(coalesce(p_note, '')), ''); mr numeric;
begin
  if not public.est_admin() then raise exception 'Réservé à l''administration.'; end if;
  if nt is null or char_length(nt) > 300 then raise exception 'Expliquez la décision (300 caractères au plus).'; end if;
  select * into c from public.commandes where id = p_cmd for update;
  if c.id is null or c.etat <> 'litige' or c.refus_le is null then raise exception 'Cette commande n''a pas de refus en cours.'; end if;
  if p_quantite is null or p_quantite < 0 then raise exception 'Indiquez la quantité refusée retenue (0 si le refus est rejeté).'; end if;
  mr := case when c.quantite is null or p_quantite >= c.quantite then round(c.montant, 0) else least(round(p_quantite * c.prix_unitaire, 0), round(c.montant, 0)) end;
  update public.commandes set etat = 'terminee', etape = 'terminee', termine_le = coalesce(termine_le, now()),
    libere_le = now(), liberation = 'admin', montant_refuse = mr where id = c.id;
  perform public._seq_journal(c.id, 'refus_admin', auth.uid(), 'admin', mr || ' F pour l''acheteur · ' || nt);
  perform public._cmd_journal(c.id, 'terminee', auth.uid(), 'admin', 'admin', null, null, null, nt);
end $$;

create or replace function public.admin_commandes(p_vue text default 'a_traiter') returns json
language plpgsql stable security definer set search_path = public as $$
declare hc integer := public._cmd_regle('chargement_heures', 72); mx integer := public._cmd_regle('mot_essais', 5);
begin
  if not public.est_admin() then raise exception 'Réservé à l''administration.'; end if;
  return (select coalesce(json_agg(x order by x.urgent desc, x.maj desc), '[]'::json) from (
    select c.id, c.numero, c.etat, c.etape, c.produit, c.quantite, c.unite, c.montant, c.commission_montant, c.mode_transport,
      c.ville_depart, c.lieu_livraison, c.litige_motif, c.litige_le, c.updated_at maj,
      coalesce(public.nom_public(c.vendeur_id), 'Membre') vendeur, coalesce(public.nom_public(c.acheteur_id), 'Membre') acheteur,
      (select json_build_object('id', m.id, 'statut', m.statut, 'nom', t.nom, 'prix', m.prix, 'avec_application', t.user_id is not null) from public.transport_missions m join public.transporteurs t on t.id = m.transporteur_id
        where m.commande_id = c.id order by m.created_at desc limit 1) mission,
      case when c.refus_le is null then null else json_build_object('le', c.refus_le, 'quantite', c.refus_quantite, 'motif', c.refus_motif, 'photos', c.refus_photos, 'mot', c.refus_mot,
        'chauffeur', c.refus_chauffeur, 'vendeur', c.refus_vendeur, 'chauffeur_suffit', public._cmd_chauffeur_independant(c)) end refus,
      c.libere_le, c.liberation, c.montant_refuse, c.mot_secret,
      (c.etat = 'terminee' and c.libere_le is null and c.termine_le < now() - interval '48 hours') sans_reponse,
      c.confirme_le, c.livre_le, c.litige_echeance, c.annulation_demandes,
      case when c.etat = 'en_cours' and c.etape in ('confirmee', 'preparation') then coalesce(c.confirme_le, c.created_at) + make_interval(hours => hc) end chargement_echeance,
      (c.etat = 'en_cours' and c.etape in ('confirmee', 'preparation') and coalesce(c.confirme_le, c.created_at) + make_interval(hours => hc) < now()) chargement_retard,
      (c.etat = 'litige' and c.litige_echeance is not null and c.litige_echeance < now()) litige_retard,
      (c.mot_essais >= mx) mot_bloque,
      (c.etat = 'en_cours' and c.annulation_demandes >= 2 and c.annulation_par is null) annulation_bloquee,
      ((c.etat = 'litige' and c.litige_echeance is not null and c.litige_echeance < now())
        or (c.etat = 'en_cours' and c.etape in ('confirmee', 'preparation') and coalesce(c.confirme_le, c.created_at) + make_interval(hours => hc) < now())) urgent
    from public.commandes c
    where case p_vue
      when 'a_traiter' then c.etat = 'litige'
        or (c.etat = 'terminee' and c.libere_le is null and c.termine_le < now() - interval '48 hours')
        or (c.mode_transport = 'reseau' and c.etat in ('a_confirmer', 'en_cours') and coalesce(c.etape, 'confirmee') in ('confirmee', 'preparation')
            and not exists (select 1 from public.transport_missions m where m.commande_id = c.id and m.statut in ('proposee', 'acceptee')))
        or (c.etat in ('a_confirmer', 'en_cours') and coalesce(c.etape, 'confirmee') in ('confirmee', 'preparation')
            and exists (select 1 from public.transport_missions m join public.transporteurs t on t.id = m.transporteur_id
                        where m.commande_id = c.id and m.statut = 'acceptee' and m.prix is null and t.user_id is null))
        or (c.etat = 'en_cours' and c.etape in ('confirmee', 'preparation') and coalesce(c.confirme_le, c.created_at) + make_interval(hours => hc) < now())
        or (c.mot_essais >= mx and (c.etat = 'en_cours' or (c.etat = 'terminee' and c.libere_le is null)))
        or (c.etat = 'en_cours' and c.annulation_demandes >= 2 and c.annulation_par is null)
      when 'en_cours' then c.etat in ('a_confirmer', 'en_cours')
      else true end
    order by c.updated_at desc limit 300) x);
end $$;
