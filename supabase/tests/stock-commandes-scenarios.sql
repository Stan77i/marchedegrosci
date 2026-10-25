-- Scénarios du schéma 92 (stock rendu, commandes bloquées, réception, mot secret, issues admin).
-- Projet de TEST seulement. Chaque bloc finit par raise exception 'TEST: …' : rien ne reste.
-- V = vendeur, A = acheteur, ADM = administrateur (comptes du projet de test).

-- ══ Bloc A : le stock revient dans tous les passages à « annulée » sans marchandise partie ══
do $$
declare V uuid := 'ca27004f-17de-494a-8db8-8c85a7cbd65c'; A uuid := '657e5590-29cb-42dc-a512-ae0baa98c968'; ADM uuid := '981961d4-25ba-4e1b-a732-8fd68cd6c922';
  oid uuid := gen_random_uuid(); n uuid[] := array[]::uuid[]; i int; cid uuid; c1 uuid; c2 uuid; c3 uuid; c4 uuid; c5 uuid; c6 uuid; res text := ''; q numeric; st text; x text;
  o2 uuid := gen_random_uuid(); n8 uuid := gen_random_uuid();
begin
  insert into public.offres (id, user_id, client_id, product_slug, region_slug, city, quantity, unit, status)
    values (oid, V, 'test92-o-1', 'igname', 'bouake', 'Bouaké', 1000, 'kg', 'active');
  -- une seule négociation ouverte à la fois par acheteur et par annonce : on les ouvre l'une après l'autre
  for i in 1..7 loop n := n || gen_random_uuid(); end loop;
  for i in 1..5 loop
    insert into public.negociations (id, cible, cible_id, auteur_id, proprio_id, produit, ville, unite, quantite, statut)
      values (n[i], 'offre', oid, A, V, 'Igname', 'Bouaké', 'kg', 100, 'ouverte');
    update public.negociations set statut = 'conclue', prix_final = 300, quantite_finale = 100, transport_final = false, conclu_le = now() where id = n[i];
  end loop;
  select quantity into q from public.offres where id = oid; res := res || 'apres 5 accords=' || q;
  execute 'set local role authenticated';
  perform set_config('request.jwt.claims', json_build_object('sub', A, 'role', 'authenticated')::text, true);
  c1 := public.commande_creer2(n[1], 'vendeur', 'Adjamé', 'Abidjan', null);
  c2 := public.commande_creer2(n[2], 'vendeur', 'Adjamé', 'Abidjan', null);
  c3 := public.commande_creer2(n[3], 'vendeur', 'Adjamé', 'Abidjan', null);
  c4 := public.commande_creer2(n[4], 'vendeur', 'Adjamé', 'Abidjan', null);
  c5 := public.commande_creer2(n[5], 'vendeur', 'Adjamé', 'Abidjan', null);
  -- refus par le vendeur : ancienne fonction sans motif refusée, puis avec motif
  perform set_config('request.jwt.claims', json_build_object('sub', V, 'role', 'authenticated')::text, true);
  begin perform public.commande_repondre(c1, false, null); res := res || ' | refus sans motif ACCEPTE?!'; exception when others then res := res || ' | refus sans motif: ' || sqlerrm; end;
  perform public.commande_repondre_motif(c1, false, null, 'stock_epuise', null);
  execute 'reset role'; select quantity into q from public.offres where id = oid; res := res || ' | refus c1 -> ' || q; execute 'set local role authenticated';
  -- retrait par l'acheteur avant confirmation
  perform set_config('request.jwt.claims', json_build_object('sub', A, 'role', 'authenticated')::text, true);
  begin perform public.commande_annuler(c2, true, null); res := res || ' | retrait sans motif ACCEPTE?!'; exception when others then res := res || ' | retrait sans motif: ' || sqlerrm; end;
  perform public.commande_annuler_motif(c2, true, null, 'erreur_saisie', null, null);
  execute 'reset role'; select quantity into q from public.offres where id = oid; res := res || ' | retrait c2 -> ' || q;
  -- expiration 48 h
  update public.commandes set created_at = now() - interval '49 hours' where id = c3;
  perform public.commandes_expirer();
  select quantity into q from public.offres where id = oid; res := res || ' | expiration c3 (' || (select etat from public.commandes where id = c3) || ') -> ' || q;
  -- annulation acceptée après confirmation
  execute 'set local role authenticated';
  perform set_config('request.jwt.claims', json_build_object('sub', V, 'role', 'authenticated')::text, true);
  perform public.commande_repondre(c4, true, null); perform public.commande_repondre(c5, true, null);
  perform public.commande_annuler_motif(c4, true, null, 'panne_meteo', null, null);
  perform set_config('request.jwt.claims', json_build_object('sub', A, 'role', 'authenticated')::text, true);
  perform public.commande_annuler_motif(c4, true, null, null, null, true);
  execute 'reset role'; select quantity into q from public.offres where id = oid; res := res || ' | annulation acceptee c4 -> ' || q;
  -- double rendu impossible
  perform public._cmd_rendre_stock((select c from public.commandes c where id = c4));
  update public.commandes set etat = 'en_cours' where id = c4; update public.commandes set etat = 'annulee' where id = c4;
  select quantity into q from public.offres where id = oid; res := res || ' | 2e rendu c4 -> ' || q;
  -- litige dès la confirmation, tranché « annulée » par l'équipe
  execute 'set local role authenticated';
  perform set_config('request.jwt.claims', json_build_object('sub', A, 'role', 'authenticated')::text, true);
  perform public.commande_litige(c5, 'Le vendeur ne répond plus');
  perform set_config('request.jwt.claims', json_build_object('sub', ADM, 'role', 'authenticated')::text, true);
  perform public.admin_litige_clore(c5, 'annulee', 'Vendeur injoignable', 'vendeur');
  execute 'reset role'; select quantity into q from public.offres where id = oid; res := res || ' | litige annule c5 -> ' || q;
  -- accord sur tout le stock : annonce retirée, puis commande refusée → stock et annonce reviennent
  insert into public.negociations (id, cible, cible_id, auteur_id, proprio_id, produit, ville, unite, quantite, statut)
    values (n[6], 'offre', oid, A, V, 'Igname', 'Bouaké', 'kg', 1000, 'ouverte');
  update public.negociations set statut = 'conclue', prix_final = 300, quantite_finale = 1000, transport_final = false, conclu_le = now() where id = n[6];
  select quantity, status into q, st from public.offres where id = oid; res := res || ' | tout vendu -> ' || q || '/' || st;
  -- le vendeur remet du stock sur l'annonce épuisée : message clair
  execute 'set local role authenticated';
  perform set_config('request.jwt.claims', json_build_object('sub', V, 'role', 'authenticated')::text, true);
  -- quantite_vue = 0 : le téléphone a bien vu l'annonce vide (sinon la garde de l'équipe annonces garde l'ancienne quantité, sans message)
  begin update public.offres set quantity = 30, quantite_vue = 0 where id = oid; res := res || ' | remise a la main ACCEPTEE?!'; exception when others then res := res || ' | remise a la main: ' || sqlerrm; end;
  perform set_config('request.jwt.claims', json_build_object('sub', A, 'role', 'authenticated')::text, true);
  c6 := public.commande_creer2(n[6], 'vendeur', 'Adjamé', 'Abidjan', null);
  perform set_config('request.jwt.claims', json_build_object('sub', V, 'role', 'authenticated')::text, true);
  perform public.commande_repondre_motif(c6, false, null, 'prix_change', null);
  execute 'reset role'; select quantity, status into q, st from public.offres where id = oid; res := res || ' | refus c6 -> ' || q || '/' || st;
  -- accord sans commande depuis 73 h : sans suite, stock rendu, commande refusée ensuite
  insert into public.negociations (id, cible, cible_id, auteur_id, proprio_id, produit, ville, unite, quantite, statut, conclu_le)
    values (n[7], 'offre', oid, A, V, 'Igname', 'Bouaké', 'kg', 100, 'ouverte', now() - interval '73 hours');
  update public.negociations set statut = 'conclue', prix_final = 300, quantite_finale = 100, transport_final = false where id = n[7];
  select quantity into q from public.offres where id = oid; res := res || ' | accord n7 -> ' || q;
  res := res || ' | sans_suite=' || public.accords_sans_suite();
  select quantity into q from public.offres where id = oid; res := res || ' -> ' || q;
  execute 'set local role authenticated';
  perform set_config('request.jwt.claims', json_build_object('sub', A, 'role', 'authenticated')::text, true);
  begin perform public.commande_creer2(n[7], 'vendeur', 'Adjamé', 'Abidjan', null); res := res || ' | commande sur accord sans suite ACCEPTEE?!'; exception when others then res := res || ' | commande n7: ' || left(sqlerrm, 70); end;
  execute 'reset role';
  -- jamais plus que pris : annonce de 50, accord de 100 (vendeur ADM : V a atteint ses 3 annonces sans vérification)
  insert into public.offres (id, user_id, client_id, product_slug, region_slug, city, quantity, unit, status)
    values (o2, ADM, 'test92-o-2', 'igname', 'bouake', 'Bouaké', 50, 'kg', 'active');
  insert into public.negociations (id, cible, cible_id, auteur_id, proprio_id, produit, ville, unite, quantite, statut)
    values (n8, 'offre', o2, A, ADM, 'Igname', 'Bouaké', 'kg', 100, 'ouverte');
  begin
    update public.negociations set statut = 'conclue', prix_final = 300, quantite_finale = 100, transport_final = false, conclu_le = now() where id = n8;
    select pris::text into x from public.stock_mouvements where negociation_id = n8; res := res || ' | accord 100 sur 50: pris=' || x;
    execute 'set local role authenticated';
    perform set_config('request.jwt.claims', json_build_object('sub', A, 'role', 'authenticated')::text, true);
    cid := public.commande_creer2(n8, 'vendeur', 'Adjamé', 'Abidjan', null);
    perform set_config('request.jwt.claims', json_build_object('sub', ADM, 'role', 'authenticated')::text, true);
    perform public.commande_repondre_motif(cid, false, null, 'stock_epuise', null);
    execute 'reset role'; select quantity into q from public.offres where id = o2; res := res || ' -> apres refus=' || q;
  exception when others then res := res || ' | accord 100 sur 50 refuse en amont: ' || left(sqlerrm, 60);
  end;
  execute 'reset role';
  begin update public.stock_mouvements set rendu = pris + 1 where negociation_id = n[1]; res := res || ' | rendu>pris ACCEPTE?!'; exception when others then res := res || ' | rendu>pris refuse (contrainte)'; end;
  raise exception 'TEST: %', res;
end $$;
-- Rejoué le 25/10/2026 après les schémas 97b et 97c : inchangé (500 → 600 → 700 → 800 → 900 → 1000, épuisée puis rendue, sans suite, STOCK_INSUFFISANT, contrainte).

-- ══ Bloc B : commande confirmée jamais chargée, redemandes d'annulation, litige dès la confirmation, issue admin ══
do $$
declare V uuid := 'ca27004f-17de-494a-8db8-8c85a7cbd65c'; A uuid := '657e5590-29cb-42dc-a512-ae0baa98c968'; ADM uuid := '981961d4-25ba-4e1b-a732-8fd68cd6c922';
  oid uuid; n uuid[] := array[]::uuid[]; c uuid[] := array[]::uuid[]; i int; res text := ''; q numeric; x text; j json; r record;
begin
  oid := gen_random_uuid();
  insert into public.offres (id, user_id, client_id, product_slug, region_slug, city, quantity, unit, status)
    values (oid, V, 'test92-o-b', 'igname', 'bouake', 'Bouaké', 1000, 'kg', 'active');
  for i in 1..4 loop
    n := n || gen_random_uuid();
    insert into public.negociations (id, cible, cible_id, auteur_id, proprio_id, produit, ville, unite, quantite, statut)
      values (n[i], 'offre', oid, A, V, 'Igname', 'Bouaké', 'kg', 100, 'ouverte');
    update public.negociations set statut = 'conclue', prix_final = 300, quantite_finale = 100, transport_final = false, conclu_le = now() where id = n[i];
  end loop;
  execute 'set local role authenticated';
  for i in 1..4 loop
    perform set_config('request.jwt.claims', json_build_object('sub', A, 'role', 'authenticated')::text, true);
    c := c || public.commande_creer2(n[i], 'vendeur', 'Adjamé', 'Abidjan', null);
    perform set_config('request.jwt.claims', json_build_object('sub', V, 'role', 'authenticated')::text, true);
    perform public.commande_repondre(c[i], true, null);
  end loop;
  execute 'reset role';
  select quantity into q from public.offres where id = oid; res := res || 'stock apres 4 commandes confirmees=' || q;
  res := res || ' | confirme_le pose=' || ((select confirme_le from public.commandes where id = c[1]) is not null);
  -- 1. l'acheteur ne peut pas annuler avant l'échéance
  execute 'set local role authenticated';
  perform set_config('request.jwt.claims', json_build_object('sub', A, 'role', 'authenticated')::text, true);
  begin perform public.commande_annuler(c[1], true, null); exception when others then res := res || ' | A annule: ' || left(sqlerrm, 90); end;
  begin perform public.commande_annuler_retard(c[1], null); res := res || ' | retard trop tot ACCEPTE?!'; exception when others then res := res || ' | A retard trop tot: ' || left(sqlerrm, 60); end;
  -- 2. le temps passe : rappel à 61 h, retard à 73 h
  execute 'reset role';
  update public.commandes set confirme_le = now() - interval '61 hours' where id = c[2];
  update public.commandes set confirme_le = now() - interval '73 hours' where id = c[1];
  j := public.commandes_delais(); res := res || ' | delais=' || j::text;
  res := res || ' | journal c2=' || (select string_agg(evenement, ',' order by at) from (select evenement, at from public.commande_etapes where commande_id = c[2] union all select evenement, at from public.commande_alertes where commande_id = c[2]) z);
  res := res || ' | journal c1=' || (select string_agg(evenement, ',' order by at) from (select evenement, at from public.commande_etapes where commande_id = c[1] union all select evenement, at from public.commande_alertes where commande_id = c[1]) z);
  execute 'set local role authenticated';
  perform set_config('request.jwt.claims', json_build_object('sub', A, 'role', 'authenticated')::text, true);
  j := public.commande_delais(c[1]); res := res || ' | peut_annuler_retard=' || (j->>'peut_annuler_retard');
  perform set_config('request.jwt.claims', json_build_object('sub', V, 'role', 'authenticated')::text, true);
  begin perform public.commande_annuler_retard(c[1], null); res := res || ' | V annule_retard ACCEPTE?!'; exception when others then res := res || ' | V annule_retard: ' || left(sqlerrm, 30); end;
  perform set_config('request.jwt.claims', json_build_object('sub', A, 'role', 'authenticated')::text, true);
  x := public.commande_annuler_retard(c[1], 'Pas de nouvelles');
  execute 'reset role';
  select an.categorie || '/' || an.chemin || '/imputable=' || case when an.imputable_id = V then 'vendeur' when an.imputable_id = A then 'acheteur' else 'personne' end || '/motif=' || coalesce(an.motif_code, '-')
    into x from public.annulations an where an.commande_id = c[1];
  select quantity into q from public.offres where id = oid; res := res || ' | annule retard: ' || x || ' stock=' || q;
  -- 3. une seule redemande d'annulation, puis l'équipe
  execute 'set local role authenticated';
  for i in 1..2 loop
    perform set_config('request.jwt.claims', json_build_object('sub', V, 'role', 'authenticated')::text, true);
    perform public.commande_annuler_motif(c[3], true, null, 'stock_epuise', null, null);
    perform set_config('request.jwt.claims', json_build_object('sub', A, 'role', 'authenticated')::text, true);
    perform public.commande_annuler_motif(c[3], false, null, null, null, null);
  end loop;
  perform set_config('request.jwt.claims', json_build_object('sub', V, 'role', 'authenticated')::text, true);
  begin perform public.commande_annuler_motif(c[3], true, null, 'stock_epuise', null, null); res := res || ' | 3e demande ACCEPTEE?!'; exception when others then res := res || ' | 3e demande: ' || left(sqlerrm, 70); end;
  begin perform public.commande_annuler(c[3], true, null); res := res || ' | demande sans motif ACCEPTEE?!'; exception when others then res := res || ' | ancienne annuler sans motif: ' || left(sqlerrm, 40); end;
  -- 4. litige dès la confirmation
  perform set_config('request.jwt.claims', json_build_object('sub', A, 'role', 'authenticated')::text, true);
  perform public.commande_litige(c[3], 'Le vendeur veut annuler, je ne suis pas d''accord');
  execute 'reset role';
  select etat || ' echeance=' || round(extract(epoch from litige_echeance - litige_le) / 3600) || ' h' into x from public.commandes where id = c[3]; res := res || ' | litige confirmee: ' || x;
  -- 5. issue admin pour une commande en cours
  execute 'set local role authenticated';
  perform set_config('request.jwt.claims', json_build_object('sub', A, 'role', 'authenticated')::text, true);
  begin perform public.admin_commande_issue(c[4], 'annulee', 'test', 'vendeur'); res := res || ' | membre issue ACCEPTEE?!'; exception when others then res := res || ' | membre issue: ' || sqlerrm; end;
  perform set_config('request.jwt.claims', json_build_object('sub', ADM, 'role', 'authenticated')::text, true);
  begin perform public.admin_commande_issue(c[4], 'annulee', '', null); exception when others then res := res || ' | issue sans note: ' || left(sqlerrm, 30); end;
  x := public.admin_commande_issue(c[4], 'annulee', 'Vendeur injoignable depuis 5 jours', 'vendeur');
  execute 'reset role';
  select an.categorie || '/imputable=' || case when an.imputable_id = V then 'vendeur' else 'autre' end into x from public.annulations an where an.commande_id = c[4];
  res := res || ' | issue admin: ' || (select etat from public.commandes where id = c[4]) || ' ' || x
    || ' journal=' || (select string_agg(evenement || ':' || role, ',' order by at) from public.commande_etapes where commande_id = c[4] and evenement in ('annulee', 'litige'));
  select quantity into q from public.offres where id = oid; res := res || ' stock=' || q;
  raise exception 'TEST: %', res;
end $$;
-- Rejoué le 25/10/2026 après les schémas 97b et 97c : inchangé (stock 600 puis 700 et 800, rappel et retard de chargement, annulation abusive
-- imputée au vendeur, 3e demande d'annulation refusée, litige 72 h, issue admin).

-- ══ Bloc C : livraison déclarée par celui qui transporte, mot secret limité, réception sans réponse, litiges (échéance, partage), journal ══
do $$
declare V uuid := 'ca27004f-17de-494a-8db8-8c85a7cbd65c'; A uuid := '657e5590-29cb-42dc-a512-ae0baa98c968'; ADM uuid := '981961d4-25ba-4e1b-a732-8fd68cd6c922';
  oid uuid := gen_random_uuid(); n uuid[] := array[]::uuid[]; c uuid[] := array[]::uuid[]; i int; k int; res text := ''; x text; j json; mot text;
begin
  insert into public.offres (id, user_id, client_id, product_slug, region_slug, city, quantity, unit, status)
    values (oid, V, 'test92-o-c', 'igname', 'bouake', 'Bouaké', 1000, 'kg', 'active');
  insert into storage.objects (bucket_id, name, owner) values ('preuves', A::text || '/t92-refus-1.webp', A);
  for i in 1..3 loop
    n := n || gen_random_uuid();
    insert into public.negociations (id, cible, cible_id, auteur_id, proprio_id, produit, ville, unite, quantite, statut)
      values (n[i], 'offre', oid, A, V, 'Igname', 'Bouaké', 'kg', 100, 'ouverte');
    update public.negociations set statut = 'conclue', prix_final = 300, quantite_finale = 100, transport_final = false, conclu_le = now() where id = n[i];
  end loop;
  execute 'set local role authenticated';
  for i in 1..3 loop
    perform set_config('request.jwt.claims', json_build_object('sub', A, 'role', 'authenticated')::text, true);
    c := c || public.commande_creer2(n[i], 'vendeur', 'Adjamé', 'Abidjan', null);
    perform set_config('request.jwt.claims', json_build_object('sub', V, 'role', 'authenticated')::text, true);
    perform public.commande_repondre(c[i], true, null);
  end loop;
  -- les preuves de départ (photos prises après la confirmation, schéma 90 et suivants) ne se simulent pas dans une seule transaction :
  -- on pose directement l'étape « transport », comme si le chargement avait eu lieu
  execute 'reset role';
  update public.commandes set etape = 'transport' where id = any(c);
  execute 'set local role authenticated';
  -- 1. « Arrivée » par l'acheteur, puis « livré » par le vendeur
  perform set_config('request.jwt.claims', json_build_object('sub', A, 'role', 'authenticated')::text, true);
  -- l'acheteur peut dire « arrivée » (demande du propriétaire) ; le vendeur déclare ensuite « livré » pour lancer le délai
  begin perform public.commande_avancer(c[1], 'arrivee'); res := res || 'acheteur arrivee=ok'; exception when others then res := res || 'acheteur arrivee REFUSEE?!: ' || left(sqlerrm, 70); end;
  perform set_config('request.jwt.claims', json_build_object('sub', V, 'role', 'authenticated')::text, true);
  for i in 1..3 loop perform public.commande_avancer(c[i], 'arrivee'); end loop;
  execute 'reset role';
  res := res || ' | vendeur livre: livre_le=' || ((select livre_le from public.commandes where id = c[1]) is not null);
  -- 2. mot secret : 6 essais faux à la réception
  execute 'set local role authenticated';
  perform set_config('request.jwt.claims', json_build_object('sub', A, 'role', 'authenticated')::text, true);
  for i in 1..6 loop x := public.commande_reception_mot(c[1], 'MANGUE 00', false); res := res || ' | essai' || i || '=' || x; end loop;
  j := public.commande_delais(c[1]); res := res || ' | restants=' || (j->>'mot_essais_restants') || ' bloque=' || (j->>'mot_bloque');
  execute 'reset role';
  res := res || ' | mot_essais=' || (select mot_essais from public.commandes where id = c[1]) || ' alerte=' || (select count(*) from public.commande_alertes where commande_id = c[1] and evenement = 'mot_bloque');
  -- le bon mot, avec des accents et en minuscules, sur une autre commande
  select mot_secret into mot from public.commandes where id = c[2];
  execute 'set local role authenticated';
  perform set_config('request.jwt.claims', json_build_object('sub', A, 'role', 'authenticated')::text, true);
  x := public.commande_reception_mot(c[2], lower(mot), false); res := res || ' | bon mot en minuscules=' || x;
  execute 'reset role';
  -- 3. livrée sans réception : rappel à mi-délai, puis litige automatique après 1 h (schéma 97b ; avant : 12 h et 24 h)
  update public.commandes set livre_le = now() - interval '31 minutes' where id = c[3];
  j := public.commandes_delais(); res := res || ' | 31 min: rappels_reception=' || (j->>'rappels_reception');
  update public.commandes set livre_le = now() - interval '61 minutes' where id = c[3];
  j := public.commandes_delais(); res := res || ' | 61 min: litiges_reception=' || (j->>'litiges_reception');
  select etat || ' par=' || coalesce(litige_par::text, 'systeme') into x from public.commandes where id = c[3]; res := res || ' -> ' || x;
  -- 4. litige en retard pour l'équipe
  update public.commandes set litige_echeance = now() - interval '1 minute' where id = c[3];
  j := public.commandes_delais(); res := res || ' | litiges_en_retard=' || (j->>'litiges_en_retard');
  execute 'set local role authenticated';
  perform set_config('request.jwt.claims', json_build_object('sub', ADM, 'role', 'authenticated')::text, true);
  select (e->>'litige_retard') into x from json_array_elements(public.admin_commandes('a_traiter')) e where e->>'id' = c[3]::text; res := res || ' admin voit retard=' || coalesce(x, 'absent');
  select (e->>'mot_bloque') into x from json_array_elements(public.admin_commandes('a_traiter')) e where e->>'id' = c[1]::text; res := res || ' | admin voit mot_bloque c1=' || coalesce(x, 'absent');
  -- 5. issue « partage »
  begin perform public.admin_litige_partager(c[3], 100, 'tout'); exception when others then res := res || ' | partage 100/100: ' || left(sqlerrm, 40); end;
  perform public.admin_litige_partager(c[3], 30, '30 kg abîmés, constat des deux parties');
  execute 'reset role';
  select etat || '/' || etape || ' refuse=' || montant_refuse || ' termine_le=' || (termine_le is not null) into x from public.commandes where id = c[3]; res := res || ' | partage: ' || x;
  -- 6. refus de la marchandise avec le bon mot, puis admin_refus_trancher pose l'étape et la date de fin
  select mot_secret into mot from public.commandes where id = c[1];
  update public.commandes set mot_essais = 0, mot_bloque_le = null where id = c[1];
  execute 'set local role authenticated';
  perform set_config('request.jwt.claims', json_build_object('sub', A, 'role', 'authenticated')::text, true);
  x := public.commande_refuser2(c[1], 20, 'Sacs mouillés', array[A::text || '/t92-refus-1.webp'], mot, false); res := res || ' | refus=' || x;
  perform set_config('request.jwt.claims', json_build_object('sub', ADM, 'role', 'authenticated')::text, true);
  perform public.admin_refus_trancher(c[1], 20, 'Photos claires');
  execute 'reset role';
  select etat || '/' || etape || ' termine_le=' || (termine_le is not null) into x from public.commandes where id = c[1]; res := res || ' | refus tranche: ' || x;
  -- 7. litige après la clôture : message « 1 h »
  execute 'set local role authenticated';
  perform set_config('request.jwt.claims', json_build_object('sub', A, 'role', 'authenticated')::text, true);
  begin perform public.commande_litige(c[1], 'encore'); exception when others then res := res || ' | litige apres cloture: ' || sqlerrm; end;
  -- 8. journal dans l'ordre (horodatage clock_timestamp)
  select string_agg(evenement, ',') into x from public.commande_journal(c[2]) where evenement not like 'sq_%';
  res := res || ' | journal c2=' || x;
  raise exception 'TEST: %', res;
end $$;
-- Rejoué le 25/10/2026 après le schéma 97b : 5 essais puis mot bloqué (alerte 1), bon mot en minuscules : terminee ;
-- 31 min : rappels_reception=1 ; 61 min : litiges_reception=1, litige par le système ; retard vu par l'équipe ; partage 30 : terminee ;
-- refus avec le bon mot puis tranché : terminee ; litige après clôture refusé ; journal c2 creee,confirmee,arrivee,reception,terminee.

-- ══ Bloc D : l'acheteur dit « arrivée » ; le vendeur peut déclarer « livré » pour faire partir le délai ; avis → file des notifications ══
do $$
declare V uuid := 'ca27004f-17de-494a-8db8-8c85a7cbd65c'; A uuid := '657e5590-29cb-42dc-a512-ae0baa98c968';
  oid uuid := gen_random_uuid(); n uuid[] := array[]::uuid[]; c uuid[] := array[]::uuid[]; i int; res text := ''; x text; j json;
begin
  -- abonnements fictifs (dans le bloc annulé) : sans abonnement, _notif_mettre ne met rien en file
  insert into public.push_abonnements (endpoint, user_id, p256dh, auth) values ('https://test92.invalid/abonnement-v', V, repeat('k', 20), repeat('a', 8)), ('https://test92.invalid/abonnement-a', A, repeat('k', 20), repeat('a', 8));
  insert into public.offres (id, user_id, client_id, product_slug, region_slug, city, quantity, unit, status)
    values (oid, V, 'test92-o-d', 'igname', 'bouake', 'Bouaké', 1000, 'kg', 'active');
  for i in 1..3 loop
    n := n || gen_random_uuid();
    insert into public.negociations (id, cible, cible_id, auteur_id, proprio_id, produit, ville, unite, quantite, statut)
      values (n[i], 'offre', oid, A, V, 'Igname', 'Bouaké', 'kg', 100, 'ouverte');
    update public.negociations set statut = 'conclue', prix_final = 300, quantite_finale = 100, transport_final = false, conclu_le = now() where id = n[i];
  end loop;
  execute 'set local role authenticated';
  for i in 1..3 loop
    perform set_config('request.jwt.claims', json_build_object('sub', A, 'role', 'authenticated')::text, true);
    c := c || public.commande_creer2(n[i], 'vendeur', 'Adjamé', 'Abidjan', null);
    perform set_config('request.jwt.claims', json_build_object('sub', V, 'role', 'authenticated')::text, true);
    perform public.commande_repondre(c[i], true, null);
  end loop;
  execute 'reset role';
  update public.commandes set etape = 'transport' where id = any(c[1:2]);
  -- 1. l'acheteur déclare l'arrivée : pas de délai lancé ; le vendeur peut ensuite déclarer « livré » une fois
  execute 'set local role authenticated';
  perform set_config('request.jwt.claims', json_build_object('sub', A, 'role', 'authenticated')::text, true);
  x := public.commande_avancer(c[1], 'arrivee'); res := res || 'acheteur arrivee=' || x;
  begin perform public.commande_avancer(c[1], 'arrivee'); res := res || ' | 2e arrivee acheteur ACCEPTEE?!'; exception when others then res := res || ' | 2e arrivee acheteur: ' || sqlerrm; end;
  execute 'reset role'; res := res || ' livre_le=' || coalesce((select livre_le::text from public.commandes where id = c[1]), 'null'); execute 'set local role authenticated';
  perform set_config('request.jwt.claims', json_build_object('sub', V, 'role', 'authenticated')::text, true);
  j := public.commande_delais(c[1]); res := res || ' | vendeur peut_declarer=' || (j->>'peut_declarer_arrivee');
  perform public.commande_avancer(c[1], 'arrivee');
  begin perform public.commande_avancer(c[1], 'arrivee'); res := res || ' | 2e livre ACCEPTE?!'; exception when others then res := res || ' | 2e livre vendeur: ' || sqlerrm; end;
  -- 2. le vendeur déclare « livré » sur la 2e : délai lancé ; l'acheteur peut encore refuser (étape arrivée)
  perform public.commande_avancer(c[2], 'arrivee');
  execute 'reset role';
  res := res || ' | c2 apres livre vendeur=' || (select etape || ' livre_le=' || (livre_le is not null) from public.commandes where id = c[2]);
  -- 3. avis du système → file des notifications (catégorie commande)
  update public.commandes set confirme_le = now() - interval '61 hours' where id = c[3];
  update public.commandes set livre_le = now() - interval '31 minutes' where id = c[2];   -- schéma 97b : rappel à mi-délai (30 min sur 60)
  j := public.commandes_delais(); res := res || ' | delais=' || j::text;
  perform public._cmd_alerte(c[1], 'mot_bloque', 'test');
  select string_agg(f.type || '>' || case when f.user_id = V then 'V' else 'A' end || ' ' || f.url, ' ; ' order by f.id) into x
    from public.notif_file f where f.objet_id in (c[1]::text, c[2]::text, c[3]::text);
  res := res || ' | file=' || coalesce(x, 'vide');
  res := res || ' | échéance rappel=' || coalesce((select round(extract(epoch from ((f.donnees ->> 'echeance')::timestamptz - now())) / 60)::text from public.notif_file f where f.objet_id = c[2]::text and f.type = 'cmd_rappel_reception'), '?') || ' min';
  raise exception 'TEST: %', res;
end $$;
-- Rejoué le 25/10/2026 après le schéma 97b : arrivée acheteur ok, 2e refusée (« Étape déjà passée. »), vendeur peut déclarer, 2e « livré » refusé ;
-- délais : rappels_chargement 1, rappels_reception 1 (à 31 min) ; file : rappel de chargement → V, rappel de réception → A, mot bloqué → A et V ;
-- échéance du rappel de réception = 29 min (livré + 60 min).
