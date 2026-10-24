-- Schéma 96b : scénarios (projet de TEST seulement ; tout est annulé par l'exception finale).
-- La catégorie transactionnelle « reponses » est utilisée pour ne pas dépendre des heures calmes (21 h - 7 h) ni du plafond ;
-- la vérification de l'objet dépend du type (« offre »), pas de la catégorie.
-- T1 (test de l'audit rejoué) : message en attente pour une offre, offre retirée → aucun lot, message « perime ».
-- T2 : lot pris, offre retirée juste avant l'envoi → notif_preparer refuse (objet_perime).
-- T3 : envoi raté (2 téléphones, 0 envoi) → le lot repart ; 3 échecs → « perime » ; le journal garde les 3 essais.
-- T4 : notif_besoins_ouverts ne compte pas un besoin dont la date de fin est passée.
do $$
declare o uuid; b1 uuid; l json; p json; t1 text; t2 text; t3 text := ''; n int; e text; k int; nb0 int; nb1 int;
begin
  set local session_replication_role = replica;   -- déclencheurs mis de côté dans ce bloc annulé (offres de simulation)
  select id into o from public.offres where status = 'active' and pause_le is null limit 1;
  select user_id into b1 from public.profils where user_id <> (select user_id from public.offres where id = o) limit 1;
  -- T1
  insert into public.notif_file (user_id, cat, type, cle, regroupe, objet_id) values (b1, 'reponses', 'offre', 'test96:t1', 'test96:t1', o::text);
  update public.offres set status = 'retiree' where id = o;
  l := public.notif_lots_prendre(300);
  select etat into e from public.notif_file where cle = 'test96:t1';
  t1 := format('T1 lots_test=%s etat=%s', (select count(*) from json_array_elements(l) x where x->>'regroupe' like 'test96%'), e);
  -- T2
  update public.offres set status = 'active' where id = o;
  insert into public.notif_file (user_id, cat, type, cle, regroupe, objet_id) values (b1, 'reponses', 'offre', 'test96:t2', 'test96:t2', o::text);
  l := public.notif_lots_prendre(300);
  select (x->>'premier_id')::int into k from json_array_elements(l) x where x->>'regroupe' = 'test96:t2';
  update public.offres set status = 'retiree' where id = o;
  p := public.notif_preparer(b1, 'reponses', 'lot:' || k, 'offre', o::text, null, 'x', 'Titre', 'Texte');
  t2 := format('T2 lot=%s preparer=%s', k is not null, p::text);
  -- T3
  update public.offres set status = 'active' where id = o;
  insert into public.notif_file (user_id, cat, type, cle, regroupe, objet_id) values (b1, 'reponses', 'offre', 'test96:t3', 'test96:t3', o::text);
  for n in 1..3 loop
    l := public.notif_lots_prendre(300);
    select (x->>'premier_id')::int into k from json_array_elements(l) x where x->>'regroupe' = 'test96:t3';
    if k is null then t3 := t3 || format(' essai%s:pas_de_lot', n); exit; end if;
    p := public.notif_preparer(b1, 'reponses', 'lot:' || k, 'offre', o::text, null, 'x', 'Titre', 'Texte');
    perform public.notif_resultat((p->>'nid')::uuid, 2, 0);
    select etat || '/' || essais into e from public.notif_file where cle = 'test96:t3';
    t3 := t3 || format(' essai%s:envoyer=%s→%s', n, p->>'envoyer', e);
  end loop;
  t3 := t3 || format(' | journal=%s', (select string_agg(resultat || ' ' || cle, ', ' order by cree_le) from public.notif_journal where user_id = b1 and cle like 'lot:' || k || '%'));
  -- T4
  nb0 := public.notif_besoins_ouverts();
  update public.besoins set livraison_debut = current_date - 10, livraison_fin = current_date - 1 where id = (select id from public.besoins where statut = 'ouvert' limit 1);
  nb1 := public.notif_besoins_ouverts();
  raise exception 'TEST: % || % || T3% || T4 besoins avant=% après une date de fin passée=% (statut ouvert=%)', t1, t2, t3, nb0, nb1,
    (select count(*) from public.besoins where statut = 'ouvert');
end $$;
