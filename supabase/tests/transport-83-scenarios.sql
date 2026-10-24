-- Tests du schéma 83 (chantier 1, commande et transport). À lancer sur le projet de TEST seulement (yowdymdnoiubatxlwhfv).
-- Chaque bloc finit par raise exception 'TEST …' : tout est annulé, rien ne reste dans la base.
-- Les blocs A à F appellent les fonctions comme le ferait un membre (auth.uid() lu dans request.jwt.claims) ;
-- le bloc G vérifie les droits avec les vrais rôles (authenticated, anon).
-- Identifiants : données de simulation du projet de test (offre de Daloa, membres, transporteur vérifié T-LXVM, administrateur).

-- A. Même ville, livreur du vendeur ; retrait par l'acheteur (le vendeur confirme) ; litige avec numéro coupé
do $$
declare S uuid := 'd56f75b3-463d-484d-9e19-4af3fd3eb8d8'; B uuid := 'efec4ce4-7ab1-4b93-9e90-020bd0007a8c'; ADM uuid := '981961d4-25ba-4e1b-a732-8fd68cd6c922';
  o uuid := '94a33186-8a5e-4cf1-a198-d8a7d6c523ab'; n uuid; n2 uuid; g public.negociations; c public.commandes; cid uuid; cid2 uuid; j json; r text := ''; k int; t text;
begin
  perform set_config('request.jwt.claims', json_build_object('sub', B, 'role', 'authenticated')::text, true);
  n := public.nego_ouvrir2('offre', o, 440, 100, null, 'sans', null);
  perform set_config('request.jwt.claims', json_build_object('sub', S, 'role', 'authenticated')::text, true);
  select * into g from public.negociations where id = n;
  perform public.nego_agir2(n, 'accord', null, null, null, g.dernier_msg);
  perform set_config('request.jwt.claims', json_build_object('sub', B, 'role', 'authenticated')::text, true);
  begin perform public.commande_creer2(n, 'vendeur', null, null); r := r || 'A0 KO;'; exception when others then r := r || 'A0 ville exigée;'; end;
  cid := public.commande_creer2(n, 'acheteur', 'Marché de Daloa', 'Daloa');
  select * into c from public.commandes where id = cid;
  r := r || 'A1 ' || c.transport_regle || '/' || c.meme_ville || '/' || c.total_convenu || '/' || c.commission_montant || ';';
  begin perform public.commande_repondre(cid, true, null); r := r || 'A2 KO;'; exception when others then r := r || 'A2 acheteur ne confirme pas seul;'; end;
  begin perform public.commande_choisir_transporteur(cid, 'T-LXVM'); r := r || 'A3 KO;'; exception when others then r := r || 'A3 choix fermé;'; end;
  perform set_config('request.jwt.claims', json_build_object('sub', S, 'role', 'authenticated')::text, true);
  perform public.commande_repondre(cid, true, null);
  j := public.commande_transport(cid);
  r := r || 'A4 hors=' || (j->>'hors_mgci') || ' prix=' || coalesce(j->>'prix_transport', 'null') || ' total=' || coalesce(j->>'total_livraison', 'null') || ';';
  -- litige : numéro coupé en deux messages, numéro en lettres refusé
  perform public.commande_avancer(cid, 'chargement');
  perform set_config('request.jwt.claims', json_build_object('sub', B, 'role', 'authenticated')::text, true);
  perform public.commande_avancer(cid, 'transport');
  perform public.commande_litige(cid, 'Marchandise abîmée');
  begin perform public.litige_ecrire(cid, 'appelez le zéro sept quarante cinq douze trente trois quatre vingt neuf'); r := r || 'A5 KO;'; exception when others then r := r || 'A5 lettres refusées;'; end;
  perform public.litige_ecrire(cid, '07 45');
  perform public.litige_ecrire(cid, '12 33 89');
  select string_agg(texte, ' | ' order by id) into t from public.litige_messages where commande_id = cid;
  r := r || 'A6 ' || t || ';';
  perform set_config('request.jwt.claims', json_build_object('sub', ADM, 'role', 'authenticated')::text, true);
  perform public.admin_litige_trancher(cid, 'terminee', 'Accord trouvé.');
  select * into c from public.commandes where id = cid;
  r := r || 'A7 ' || c.etat || ';';
  select count(*) into k from public.commissions_transport where commande_id = cid;
  r := r || 'A8 commission transport=' || k || ';';
  -- même ville, livreur du vendeur (nouvelle négociation, transport non dit)
  perform set_config('request.jwt.claims', json_build_object('sub', B, 'role', 'authenticated')::text, true);
  n2 := public.nego_ouvrir2('offre', o, 445, 50, null, null, null);
  perform set_config('request.jwt.claims', json_build_object('sub', S, 'role', 'authenticated')::text, true);
  select * into g from public.negociations where id = n2;
  perform public.nego_agir2(n2, 'accord', null, null, null, g.dernier_msg);
  cid2 := public.commande_creer2(n2, 'vendeur', null, 'daloa');
  select * into c from public.commandes where id = cid2;
  r := r || 'A9 ' || c.transport_regle || '/' || c.meme_ville || '/' || c.mode_transport || ';';
  raise exception 'TEST %', r;
end $$;

-- B. Même ville, transporteur du réseau Marché de Gros : négociation à trois, accord, transbordement ; refus ; expiration ; service fermé
do $$
declare S uuid := 'd56f75b3-463d-484d-9e19-4af3fd3eb8d8'; B uuid := 'efec4ce4-7ab1-4b93-9e90-020bd0007a8c'; ADM uuid := '981961d4-25ba-4e1b-a732-8fd68cd6c922';
  TU uuid := 'f8e1b009-e7c7-4637-b685-c05155f06be9'; TID uuid := 'd9b2a5a8-5949-48b3-a328-e8d642c3db5d';
  o uuid := '94a33186-8a5e-4cf1-a198-d8a7d6c523ab'; n uuid; g public.negociations; c public.commandes; cid uuid; mid uuid; m public.transport_missions; j json; r text := ''; k int; px numeric;
begin
  -- service fermé : la commande en mode réseau est refusée
  perform set_config('request.jwt.claims', json_build_object('sub', B, 'role', 'authenticated')::text, true);
  n := public.nego_ouvrir2('offre', o, 450, 100, null, 'sans', null);
  perform set_config('request.jwt.claims', json_build_object('sub', S, 'role', 'authenticated')::text, true);
  select * into g from public.negociations where id = n;
  perform public.nego_agir2(n, 'accord', null, null, null, g.dernier_msg);
  begin perform public.commande_creer2(n, 'reseau', null, 'Daloa'); r := r || 'B0 KO;'; exception when others then r := r || 'B0 réseau fermé;'; end;
  -- ouverture pour le test seulement (annulée à la fin)
  update public.reglages set valeur = 'true'::jsonb where cle = 'transport_reseau_ouvert';
  cid := public.commande_creer2(n, 'reseau', null, 'Daloa');
  select * into c from public.commandes where id = cid;
  r := r || 'B1 ' || c.transport_regle || '/' || c.validation || '/' || coalesce(c.total_convenu::text, 'null') || ';';
  perform set_config('request.jwt.claims', json_build_object('sub', B, 'role', 'authenticated')::text, true);
  perform public.commande_repondre(cid, true, null);
  perform set_config('request.jwt.claims', json_build_object('sub', ADM, 'role', 'authenticated')::text, true);
  perform public.admin_affecter(cid, TID);
  select id into mid from public.transport_missions where commande_id = cid and statut = 'proposee';
  perform set_config('request.jwt.claims', json_build_object('sub', B, 'role', 'authenticated')::text, true);
  begin perform public.transport_agir(mid, 'prix', 9000); r := r || 'B2 KO;'; exception when others then r := r || 'B2 transporteur en premier;'; end;
  begin perform public.dm_ouvrir(TU); r := r || 'B3 KO;'; exception when others then r := r || 'B3 dm interdit;'; end;
  perform set_config('request.jwt.claims', json_build_object('sub', TU, 'role', 'authenticated')::text, true);
  begin perform public.chauffeur_repondre2(mid, true, 10000, null); r := r || 'B4 KO;'; exception when others then r := r || 'B4 acceptation seule refusée;'; end;
  begin perform public.dm_ouvrir(S); r := r || 'B5 KO;'; exception when others then r := r || 'B5 dm interdit;'; end;
  j := public.transport_agir(mid, 'prix', 15000);
  perform set_config('request.jwt.claims', json_build_object('sub', B, 'role', 'authenticated')::text, true);
  j := public.transport_agir(mid, 'prix', 12000);
  r := r || 'B6 attente=' || (j->'en_attente'->>'prix') || ' ok_a=' || (j->'en_attente'->>'ok_acheteur') || ' ok_t=' || (j->'en_attente'->>'ok_transporteur') || ';';
  perform set_config('request.jwt.claims', json_build_object('sub', S, 'role', 'authenticated')::text, true);
  j := public.transport_agir(mid, 'accord', null, (j->'en_attente'->>'id')::uuid);
  select statut into m.statut from public.transport_missions where id = mid;
  r := r || 'B7 après vendeur: mission=' || m.statut || ';';
  perform set_config('request.jwt.claims', json_build_object('sub', TU, 'role', 'authenticated')::text, true);
  j := public.transport_agir(mid, 'accord');
  select * into m from public.transport_missions where id = mid;
  select * into c from public.commandes where id = cid;
  r := r || 'B8 convenu=' || (j->>'convenu') || ' mission=' || m.statut || '/' || m.prix || ' total=' || c.total_convenu || ' montant=' || c.montant || ';';
  select count(*) into k from public.commissions_transport where mission_id = mid and statut = 'prevue' and commission = round(12000 * 0.069);
  r := r || 'B9 commission 6,9 %=' || k || ';';
  begin perform public.transport_agir(mid, 'prix', 20000); r := r || 'B10 KO;'; exception when others then r := r || 'B10 prix figé;'; end;
  perform set_config('request.jwt.claims', json_build_object('sub', B, 'role', 'authenticated')::text, true);
  j := public.commande_transport(cid);
  r := r || 'B11 prix=' || (j->>'prix_transport') || ' total=' || (j->>'total_livraison') || ';';
  -- transbordement : le nouveau chauffeur garde le prix convenu
  update public.transport_missions set statut = 'retiree', repondu_le = now(), note = 'Transmise à Autre' where id = mid;
  insert into public.transport_missions (commande_id, transporteur_id, propose_par, propose_role, statut, repondu_le, note)
  values (cid, '569bea35-05d6-43d9-ac26-188aed33924b', TU, 'admin', 'acceptee', now(), 'Transfert depuis Test') returning prix into px;
  r := r || 'B12 prix après transbordement=' || px || ';';
  raise exception 'TEST %', r;
end $$;

-- B'. Réseau : refus du prix par le vendeur → livreur du vendeur ; expiration à 48 h ; retrait
do $$
declare S uuid := 'd56f75b3-463d-484d-9e19-4af3fd3eb8d8'; B uuid := 'efec4ce4-7ab1-4b93-9e90-020bd0007a8c'; ADM uuid := '981961d4-25ba-4e1b-a732-8fd68cd6c922';
  TU uuid := 'f8e1b009-e7c7-4637-b685-c05155f06be9'; TID uuid := 'd9b2a5a8-5949-48b3-a328-e8d642c3db5d';
  o uuid := '94a33186-8a5e-4cf1-a198-d8a7d6c523ab'; n uuid; g public.negociations; c public.commandes; cid uuid; mid uuid; m public.transport_missions; j json; r text := ''; k int;
begin
  update public.reglages set valeur = 'true'::jsonb where cle = 'transport_reseau_ouvert';
  perform set_config('request.jwt.claims', json_build_object('sub', B, 'role', 'authenticated')::text, true);
  n := public.nego_ouvrir2('offre', o, 450, 100, null, null, null);
  perform set_config('request.jwt.claims', json_build_object('sub', S, 'role', 'authenticated')::text, true);
  select * into g from public.negociations where id = n;
  perform public.nego_agir2(n, 'accord', null, null, null, g.dernier_msg);
  cid := public.commande_creer2(n, 'reseau', null, 'Daloa');
  perform set_config('request.jwt.claims', json_build_object('sub', ADM, 'role', 'authenticated')::text, true);
  perform public.admin_affecter(cid, TID);
  select id into mid from public.transport_missions where commande_id = cid and statut = 'proposee';
  perform set_config('request.jwt.claims', json_build_object('sub', TU, 'role', 'authenticated')::text, true);
  j := public.transport_agir(mid, 'prix', 15000);
  -- retrait puis nouvelle proposition
  j := public.transport_agir(mid, 'retrait');
  r := r || 'R1 retrait attente=' || coalesce(j->>'en_attente', 'null') || ';';
  begin j := public.transport_agir(mid, 'accord'); r := r || 'R2 KO;'; exception when others then r := r || 'R2 rien à accepter;'; end;
  j := public.transport_agir(mid, 'prix', 16000);
  -- expiration (date reculée pour le test)
  update public.transport_propositions set expire_le = now() - interval '1 minute' where mission_id = mid and issue = 'en_attente';
  perform set_config('request.jwt.claims', json_build_object('sub', B, 'role', 'authenticated')::text, true);
  begin j := public.transport_agir(mid, 'accord'); r := r || 'R3 KO;'; exception when others then r := r || 'R3 expiré (' || sqlerrm || ');'; end;
  perform set_config('request.jwt.claims', json_build_object('sub', TU, 'role', 'authenticated')::text, true);
  j := public.transport_agir(mid, 'prix', 14000);
  perform set_config('request.jwt.claims', json_build_object('sub', S, 'role', 'authenticated')::text, true);
  begin j := public.transport_agir(mid, 'retrait'); r := r || 'R4 KO;'; exception when others then r := r || 'R4 pas son prix;'; end;
  j := public.transport_agir(mid, 'refus');
  select * into m from public.transport_missions where id = mid;
  select * into c from public.commandes where id = cid;
  r := r || 'R5 mission=' || m.statut || ' mode=' || c.mode_transport || ' regle=' || c.transport_regle || ' validation=' || c.validation || ' état=' || c.etat || ';';
  select count(*) into k from public.commissions_transport where commande_id = cid and statut <> 'annulee';
  r := r || 'R6 commission transport=' || k || ';';
  perform set_config('request.jwt.claims', json_build_object('sub', B, 'role', 'authenticated')::text, true);
  begin perform public.dm_ouvrir(TU); r := r || 'R7 dm de nouveau possible;'; exception when others then r := r || 'R7 KO ' || sqlerrm || ';'; end;
  raise exception 'TEST %', r;
end $$;

-- C. Villes différentes, transport inclus
do $$
declare S uuid := 'd56f75b3-463d-484d-9e19-4af3fd3eb8d8'; B uuid := 'efec4ce4-7ab1-4b93-9e90-020bd0007a8c';
  o uuid := '94a33186-8a5e-4cf1-a198-d8a7d6c523ab'; n uuid; g public.negociations; c public.commandes; cid uuid; j json; r text := '';
begin
  perform set_config('request.jwt.claims', json_build_object('sub', B, 'role', 'authenticated')::text, true);
  n := public.nego_ouvrir2('offre', o, 400, 100, null, 'apart', 20000);
  perform set_config('request.jwt.claims', json_build_object('sub', S, 'role', 'authenticated')::text, true);
  perform public.nego_agir2(n, 'prix', 480, 100, null, null, 'inclus', null);
  perform set_config('request.jwt.claims', json_build_object('sub', B, 'role', 'authenticated')::text, true);
  select * into g from public.negociations where id = n;
  perform public.nego_agir2(n, 'accord', null, null, null, g.dernier_msg);
  select * into g from public.negociations where id = n;
  r := r || 'C1 ' || g.transport_final || '/' || coalesce(g.prix_transport_final::text, 'null') || ';';
  begin perform public.commande_creer2(n, 'acheteur', null, 'Abidjan'); r := r || 'C2 KO;'; exception when others then r := r || 'C2 vendeur obligatoire;'; end;
  cid := public.commande_creer2(n, 'vendeur', null, 'Abidjan');
  select * into c from public.commandes where id = cid;
  r := r || 'C3 ' || c.transport_regle || '/' || c.meme_ville || '/' || c.ville_depart || '→' || c.ville_arrivee || ' total=' || c.total_convenu || ' montant=' || c.montant || ' com=' || c.commission_montant || ';';
  j := public.commande_transport(cid);
  r := r || 'C4 prix=' || coalesce(j->>'prix_transport', 'null') || ' total=' || coalesce(j->>'total_livraison', 'null') || ';';
  raise exception 'TEST %', r;
end $$;

-- D. Villes différentes, transport à part : propositions, contre-propositions, refus, accord
do $$
declare S uuid := 'd56f75b3-463d-484d-9e19-4af3fd3eb8d8'; B uuid := 'efec4ce4-7ab1-4b93-9e90-020bd0007a8c'; ADM uuid := '981961d4-25ba-4e1b-a732-8fd68cd6c922';
  TU uuid := 'f8e1b009-e7c7-4637-b685-c05155f06be9'; TID uuid := 'd9b2a5a8-5949-48b3-a328-e8d642c3db5d';
  o uuid := '94a33186-8a5e-4cf1-a198-d8a7d6c523ab'; n uuid; g public.negociations; c public.commandes; cid uuid; j json; r text := ''; k int;
begin
  perform set_config('request.jwt.claims', json_build_object('sub', B, 'role', 'authenticated')::text, true);
  n := public.nego_ouvrir2('offre', o, 420, 100, null, 'apart', 30000);
  perform set_config('request.jwt.claims', json_build_object('sub', S, 'role', 'authenticated')::text, true);
  select * into g from public.negociations where id = n;
  perform public.nego_agir2(n, 'refus', null, null, null, g.dernier_msg);
  perform public.nego_agir2(n, 'prix', 440, 100, null, null, 'apart', 40000);
  perform set_config('request.jwt.claims', json_build_object('sub', B, 'role', 'authenticated')::text, true);
  perform public.nego_agir2(n, 'prix', 430, 100, null, null, 'apart', 35000);
  perform set_config('request.jwt.claims', json_build_object('sub', S, 'role', 'authenticated')::text, true);
  select * into g from public.negociations where id = n;
  perform public.nego_agir2(n, 'accord', null, null, null, g.dernier_msg);
  select * into g from public.negociations where id = n;
  r := r || 'D1 ' || g.prix_final || '/' || g.transport_final || '/' || g.prix_transport_final || ';';
  perform set_config('request.jwt.claims', json_build_object('sub', B, 'role', 'authenticated')::text, true);
  begin perform public.commande_creer2(n, 'acheteur', null, 'Abidjan'); r := r || 'D2 KO;'; exception when others then r := r || 'D2 acheteur refusé;'; end;
  cid := public.commande_creer2(n, 'vendeur', 'Adjamé, marché', 'Abidjan');
  select * into c from public.commandes where id = cid;
  r := r || 'D3 ' || c.transport_regle || '/' || c.prix_transport || ' total=' || c.total_convenu || ' montant=' || c.montant || ' com=' || c.commission_montant || ';';
  j := public.commande_transport(cid);
  r := r || 'D4 prix=' || (j->>'prix_transport') || ' total=' || (j->>'total_livraison') || ' hors=' || (j->>'hors_mgci') || ';';
  select count(*) into k from public.commissions_transport where commande_id = cid;
  r := r || 'D5 commission transport=' || k || ';';
  raise exception 'TEST %', r;
end $$;

-- E. Villes différentes, transport à part dans l'accord, puis transporteur du réseau : contre-proposition du vendeur, refus du transporteur
do $$
declare S uuid := 'd56f75b3-463d-484d-9e19-4af3fd3eb8d8'; B uuid := 'efec4ce4-7ab1-4b93-9e90-020bd0007a8c'; ADM uuid := '981961d4-25ba-4e1b-a732-8fd68cd6c922';
  TU uuid := 'f8e1b009-e7c7-4637-b685-c05155f06be9'; TID uuid := 'd9b2a5a8-5949-48b3-a328-e8d642c3db5d';
  o uuid := '94a33186-8a5e-4cf1-a198-d8a7d6c523ab'; n uuid; g public.negociations; c public.commandes; cid uuid; mid uuid; m public.transport_missions; j json; r text := ''; k int;
begin
  update public.reglages set valeur = 'true'::jsonb where cle = 'transport_reseau_ouvert';
  perform set_config('request.jwt.claims', json_build_object('sub', B, 'role', 'authenticated')::text, true);
  n := public.nego_ouvrir2('offre', o, 430, 100, null, 'apart', 35000);
  perform set_config('request.jwt.claims', json_build_object('sub', S, 'role', 'authenticated')::text, true);
  select * into g from public.negociations where id = n;
  perform public.nego_agir2(n, 'accord', null, null, null, g.dernier_msg);
  perform set_config('request.jwt.claims', json_build_object('sub', B, 'role', 'authenticated')::text, true);
  cid := public.commande_creer2(n, 'reseau', null, 'Abidjan');
  select * into c from public.commandes where id = cid;
  r := r || 'E1 ' || c.transport_regle || '/' || coalesce(c.prix_transport::text, 'null') || ';';
  perform set_config('request.jwt.claims', json_build_object('sub', S, 'role', 'authenticated')::text, true);
  perform public.commande_repondre(cid, true, null);
  perform set_config('request.jwt.claims', json_build_object('sub', ADM, 'role', 'authenticated')::text, true);
  perform public.admin_affecter(cid, TID);
  select id into mid from public.transport_missions where commande_id = cid and statut = 'proposee';
  perform set_config('request.jwt.claims', json_build_object('sub', TU, 'role', 'authenticated')::text, true);
  j := public.transport_agir(mid, 'prix', 45000);
  perform set_config('request.jwt.claims', json_build_object('sub', B, 'role', 'authenticated')::text, true);
  j := public.transport_agir(mid, 'accord');
  perform set_config('request.jwt.claims', json_build_object('sub', S, 'role', 'authenticated')::text, true);
  j := public.transport_agir(mid, 'prix', 38000);
  r := r || 'E2 contre-proposition vendeur ok_a=' || (j->'en_attente'->>'ok_acheteur') || ' ok_v=' || (j->'en_attente'->>'ok_vendeur') || ';';
  perform set_config('request.jwt.claims', json_build_object('sub', TU, 'role', 'authenticated')::text, true);
  j := public.transport_agir(mid, 'refus');
  select * into m from public.transport_missions where id = mid;
  select * into c from public.commandes where id = cid;
  r := r || 'E3 mission=' || m.statut || ' mode=' || c.mode_transport || ' regle=' || c.transport_regle || ' prix=' || c.prix_transport || ' total=' || c.total_convenu || ';';
  select count(*) into k from public.commissions_transport where commande_id = cid and statut <> 'annulee';
  r := r || 'E4 commission transport=' || k || ';';
  raise exception 'TEST %', r;
end $$;

-- F. Commission marchandise : 0 pour un vendeur administrateur (comme _seq_repartition) ; 3,5 % sinon
do $$
declare ADM uuid := '981961d4-25ba-4e1b-a732-8fd68cd6c922'; B uuid := 'efec4ce4-7ab1-4b93-9e90-020bd0007a8c';
  o uuid := '2f7d4c38-b28b-4bfa-b2b2-5d6ea35196ca'; n uuid; g public.negociations; c public.commandes; cid uuid; r text := ''; s json;
begin
  update public.offres set user_id = ADM where id = o;
  perform set_config('request.jwt.claims', json_build_object('sub', B, 'role', 'authenticated')::text, true);
  n := public.nego_ouvrir2('offre', o, 120, 1000, null, null, null);
  perform set_config('request.jwt.claims', json_build_object('sub', ADM, 'role', 'authenticated')::text, true);
  select * into g from public.negociations where id = n;
  perform public.nego_agir2(n, 'accord', null, null, null, g.dernier_msg);
  cid := public.commande_creer2(n, 'vendeur', null, 'Bouaké');
  select * into c from public.commandes where id = cid;
  s := public._seq_repartition(cid);
  r := r || 'F1 commande=' || c.commission_montant || ' repartition=' || (s->>'vendeur_commission') || ' regle=' || c.transport_regle || ';';
  raise exception 'TEST %', r;
end $$;

-- G. Droits : les membres passent par les fonctions, jamais par les tables ; les visiteurs n'ont rien
do $$
declare B uuid := 'efec4ce4-7ab1-4b93-9e90-020bd0007a8c'; S uuid := 'd56f75b3-463d-484d-9e19-4af3fd3eb8d8';
  o uuid := '94a33186-8a5e-4cf1-a198-d8a7d6c523ab'; n uuid; r text := ''; k int;
begin
  perform set_config('request.jwt.claims', json_build_object('sub', B, 'role', 'authenticated')::text, true);
  set local role authenticated;
  n := public.nego_ouvrir2('offre', o, 440, 100, null, 'apart', 12000);
  r := r || 'G1 membre: nego_ouvrir2 ok;';
  begin select count(*) into k from public.transport_propositions; r := r || 'G2 KO;'; exception when insufficient_privilege then r := r || 'G2 table propositions fermée;'; end;
  begin select count(*) into k from public.reglages; r := r || 'G3 KO;'; exception when insufficient_privilege then r := r || 'G3 table réglages fermée;'; end;
  begin perform public.admin_transport_reseau(true); r := r || 'G4 KO;'; exception when others then r := r || 'G4 réglage réservé à l''admin;'; end;
  begin perform public._tr_tri_etat(n); r := r || 'G5 KO;'; exception when insufficient_privilege then r := r || 'G5 fonction interne fermée;'; end;
  select count(*) into k from public.messages where negociation_id = n and prix_transport = 12000;
  r := r || 'G6 son message lisible=' || k || ';';
  reset role;
  set local role anon;
  begin perform public.nego_agir2(n, 'texte', null, null, 'x'); r := r || 'G7 KO;'; exception when insufficient_privilege then r := r || 'G7 visiteur refusé;'; end;
  begin perform public.transport_agir(gen_random_uuid(), 'prix', 1000); r := r || 'G8 KO;'; exception when insufficient_privilege then r := r || 'G8 visiteur refusé;'; end;
  raise exception 'TEST %', r;
end $$;

-- H. Compatibilité avec l'application en ligne (nego_ouvrir + nego_transport, commande_creer) ; filtre des numéros (lettres, morceaux, séparateurs, +225 sans 0)
do $$
declare S uuid := 'd56f75b3-463d-484d-9e19-4af3fd3eb8d8'; B uuid := 'efec4ce4-7ab1-4b93-9e90-020bd0007a8c';
  o uuid := '94a33186-8a5e-4cf1-a198-d8a7d6c523ab'; n uuid; g public.negociations; c public.commandes; cid uuid; r text := ''; t text; d uuid; k0 int; k1 int;
begin
  perform set_config('request.jwt.claims', json_build_object('sub', B, 'role', 'authenticated')::text, true);
  n := public.nego_ouvrir('offre', o, 440, 100, null);
  perform public.nego_transport(n, true);
  perform set_config('request.jwt.claims', json_build_object('sub', S, 'role', 'authenticated')::text, true);
  select * into g from public.negociations where id = n;
  perform public.nego_agir(n, 'accord', null, null, null, g.dernier_msg);
  select * into g from public.negociations where id = n;
  cid := public.commande_creer(n, 'vendeur', null, 'declaration');
  select * into c from public.commandes where id = cid;
  r := r || 'H1 ancien: transport_final=' || g.transport_final || ' commande=' || c.mode_transport || ' regle=' || coalesce(c.transport_regle, 'null') || ';';
  select count(*) into k0 from public.alertes;
  perform set_config('request.jwt.claims', json_build_object('sub', B, 'role', 'authenticated')::text, true);
  n := public.nego_ouvrir2('offre', o, 441, 100, 'appelez zero sept quarante cinq douze trente trois quatre vingt neuf', null, null);
  select texte into t from public.messages where negociation_id = n and genre = 'prix';
  r := r || 'H2 ' || t || ';';
  perform public.nego_agir(n, 'texte', null, null, '0745');
  perform public.nego_agir(n, 'texte', null, null, '12 33 89');
  select string_agg(texte, ' | ' order by created_at) into t from public.messages where negociation_id = n and genre = 'texte';
  r := r || 'H3 ' || t || ';';
  d := public.dm_ouvrir(S);
  perform public.dm_envoyer(d, 'mon num : +225 7 45 12 33 89');
  perform public.dm_envoyer(d, 'ou 07 // 45 -- 12 33 89');
  select string_agg(texte, ' | ' order by created_at) into t from (select texte, created_at from public.dm where discussion_id = d order by created_at desc limit 2) x;
  select count(*) into k1 from public.alertes;
  r := r || 'H4 ' || t || ' alertes+' || (k1 - k0) || ';';
  raise exception 'TEST %', r;
end $$;

-- I. Relecture : autre membre, valeurs limites, double appel, négociation à trois (refus, contre-propositions, droits)
do $$
declare S uuid := 'd56f75b3-463d-484d-9e19-4af3fd3eb8d8'; B uuid := 'efec4ce4-7ab1-4b93-9e90-020bd0007a8c'; ADM uuid := '981961d4-25ba-4e1b-a732-8fd68cd6c922';
  TU uuid := 'f8e1b009-e7c7-4637-b685-c05155f06be9'; TID uuid := 'd9b2a5a8-5949-48b3-a328-e8d642c3db5d'; X uuid := '035fc2ed-de23-47da-99c6-0cd60fae7d37';
  o uuid := '94a33186-8a5e-4cf1-a198-d8a7d6c523ab'; n uuid; g public.negociations; c public.commandes; cid uuid; mid uuid; j json; r text := ''; k int; pid uuid; mm public.messages;
begin
  perform set_config('request.jwt.claims', json_build_object('sub', B, 'role', 'authenticated')::text, true);
  -- valeurs limites du prix du transport
  begin perform public.nego_ouvrir2('offre', o, 440, 100, null, 'apart', 0); r := r || 'I1 KO;'; exception when others then r := r || 'I1 0 refusé;'; end;
  begin perform public.nego_ouvrir2('offre', o, 440, 100, null, 'apart', -5); r := r || 'I2 KO;'; exception when others then r := r || 'I2 négatif refusé;'; end;
  begin perform public.nego_ouvrir2('offre', o, 440, 100, null, 'apart', 100000000); r := r || 'I3 KO;'; exception when others then r := r || 'I3 trop grand refusé;'; end;
  begin perform public.nego_ouvrir2('offre', o, 440, 100, null, 'APART', 1000); r := r || 'I4 KO;'; exception when others then r := r || 'I4 inconnu refusé;'; end;
  begin perform public.nego_ouvrir2('offre', o, 440, 100, null, 'sans', 1000); r := r || 'I5 KO;'; exception when others then r := r || 'I5 prix avec sans refusé;'; end;
  n := public.nego_ouvrir2('offre', o, 440, 100, null, 'apart', 24999.6);
  select * into g from public.negociations where id = n;
  r := r || 'I6 arrondi=' || g.dernier_prix_transport || ';';
  -- un autre membre ne touche à rien
  perform set_config('request.jwt.claims', json_build_object('sub', X, 'role', 'authenticated')::text, true);
  begin perform public.nego_agir2(n, 'accord', null, null, null, g.dernier_msg); r := r || 'I7 KO;'; exception when others then r := r || 'I7 autre membre refusé;'; end;
  begin perform public.nego_agir2(n, 'prix', 400, 100, null, null, 'inclus', null); r := r || 'I8 KO;'; exception when others then r := r || 'I8 autre membre refusé;'; end;
  -- l'acheteur ne peut pas accepter sa propre proposition ; le vendeur contre-propose « inclus » puis l'acheteur accepte
  perform set_config('request.jwt.claims', json_build_object('sub', B, 'role', 'authenticated')::text, true);
  begin perform public.nego_agir2(n, 'accord', null, null, null, g.dernier_msg); r := r || 'I9 KO;'; exception when others then r := r || 'I9 pas sa propre proposition;'; end;
  perform set_config('request.jwt.claims', json_build_object('sub', S, 'role', 'authenticated')::text, true);
  begin perform public.nego_agir2(n, 'refus', null, null, null, g.dernier_msg, 'inclus', null); r := r || 'I10 KO;'; exception when others then r := r || 'I10 transport sur un refus refusé;'; end;
  perform public.nego_agir2(n, 'prix', 450, 100, null, null, 'apart', 20000);
  select * into g from public.negociations where id = n;
  select * into mm from public.messages where id = g.dernier_msg;
  r := r || 'I11 contre=' || g.dernier_prix || '/' || g.dernier_prix_transport || ' msg=' || mm.prix_transport || '/vendeur=' || (mm.auteur_id = S)::text || ';';
  perform set_config('request.jwt.claims', json_build_object('sub', B, 'role', 'authenticated')::text, true);
  perform public.nego_agir2(n, 'accord', null, null, null, g.dernier_msg);
  begin perform public.nego_agir2(n, 'accord', null, null, null, g.dernier_msg); r := r || 'I12 KO double;'; exception when others then r := r || 'I12 double accord refusé;'; end;
  select * into g from public.negociations where id = n;
  r := r || 'I13 accord ' || g.prix_final || '/' || g.transport_final || '/' || g.prix_transport_final || ';';
  -- commande : autre membre refusé ; ville arrivée Abidjan ; mode acheteur refusé (transport à part)
  perform set_config('request.jwt.claims', json_build_object('sub', X, 'role', 'authenticated')::text, true);
  begin perform public.commande_creer2(n, 'vendeur', null, 'Abidjan'); r := r || 'I14 KO;'; exception when others then r := r || 'I14 autre membre refusé;'; end;
  perform set_config('request.jwt.claims', json_build_object('sub', B, 'role', 'authenticated')::text, true);
  begin perform public.commande_creer2(n, 'acheteur', null, 'Abidjan'); r := r || 'I15 KO;'; exception when others then r := r || 'I15 acheteur refusé;'; end;
  begin perform public.commande_creer2(n, 'camion', null, 'Abidjan'); r := r || 'I16 KO;'; exception when others then r := r || 'I16 mode inconnu refusé;'; end;
  update public.reglages set valeur = 'true'::jsonb where cle = 'transport_reseau_ouvert';
  cid := public.commande_creer2(n, 'reseau', null, 'Abidjan');
  select * into c from public.commandes where id = cid;
  r := r || 'I17 ' || c.transport_regle || '/' || coalesce(c.prix_transport::text, 'null') || '/' || coalesce(c.total_convenu::text, 'null') || ';';
  perform set_config('request.jwt.claims', json_build_object('sub', S, 'role', 'authenticated')::text, true);
  perform public.commande_repondre(cid, true, null);
  perform set_config('request.jwt.claims', json_build_object('sub', ADM, 'role', 'authenticated')::text, true);
  perform public.admin_affecter(cid, TID);
  select id into mid from public.transport_missions where commande_id = cid and statut = 'proposee';
  -- autre membre : rien
  perform set_config('request.jwt.claims', json_build_object('sub', X, 'role', 'authenticated')::text, true);
  begin perform public.transport_agir(mid, 'prix', 9000); r := r || 'I18 KO;'; exception when others then r := r || 'I18 autre membre refusé;'; end;
  j := public.commande_transport(cid);
  r := r || 'I19 transport autre=' || coalesce(j::text, 'null') || ';';
  begin perform public.dm_ouvrir(TU); r := r || 'I20 dm tiers-transporteur permis;'; exception when others then r := r || 'I20 KO ' || sqlerrm || ';'; end;
  -- transporteur : prix 0 refusé, action inconnue refusée, prix 30000 ; vendeur contre 22000 ; acheteur contre 21000 ; transporteur accepte 21000 ; vendeur accepte (double) → convenu
  perform set_config('request.jwt.claims', json_build_object('sub', TU, 'role', 'authenticated')::text, true);
  begin perform public.transport_agir(mid, 'prix', 0); r := r || 'I21 KO;'; exception when others then r := r || 'I21 prix 0 refusé;'; end;
  begin perform public.transport_agir(mid, 'payer', 1000); r := r || 'I22 KO;'; exception when others then r := r || 'I22 action inconnue refusée;'; end;
  begin perform public.chauffeur_prix(mid, 5000); r := r || 'I23 KO;'; exception when others then r := r || 'I23 chauffeur_prix refusé;'; end;
  j := public.transport_agir(mid, 'prix', 30000);
  begin perform public.transport_agir(mid, 'refus'); r := r || 'I24 KO;'; exception when others then r := r || 'I24 refus de son propre prix refusé;'; end;
  perform set_config('request.jwt.claims', json_build_object('sub', S, 'role', 'authenticated')::text, true);
  j := public.transport_agir(mid, 'prix', 22000);
  pid := (j->'en_attente'->>'id')::uuid;
  perform set_config('request.jwt.claims', json_build_object('sub', B, 'role', 'authenticated')::text, true);
  begin perform public.transport_agir(mid, 'accord', null, gen_random_uuid()); r := r || 'I25 KO;'; exception when others then r := r || 'I25 ancienne référence refusée;'; end;
  j := public.transport_agir(mid, 'prix', 21000);
  r := r || 'I26 attente=' || (j->'en_attente'->>'prix') || ' ok_v=' || (j->'en_attente'->>'ok_vendeur') || ' ok_a=' || (j->'en_attente'->>'ok_acheteur') || ';';
  perform set_config('request.jwt.claims', json_build_object('sub', TU, 'role', 'authenticated')::text, true);
  j := public.transport_agir(mid, 'accord');
  perform set_config('request.jwt.claims', json_build_object('sub', S, 'role', 'authenticated')::text, true);
  j := public.transport_agir(mid, 'accord');
  r := r || 'I27 convenu=' || coalesce(j->>'convenu', 'null') || ';';
  begin perform public.transport_agir(mid, 'accord'); r := r || 'I28 KO;'; exception when others then r := r || 'I28 double accord refusé;'; end;
  begin perform public.transport_agir(mid, 'refus'); r := r || 'I29 KO;'; exception when others then r := r || 'I29 refus après accord refusé;'; end;
  select * into c from public.commandes where id = cid;
  r := r || 'I30 total=' || c.total_convenu || ' montant=' || c.montant || ' commission marchandise=' || c.commission_montant || ';';
  select count(*) into k from public.commissions_transport where commande_id = cid and statut = 'prevue' and commission = round(21000 * 0.069);
  r := r || 'I31 commission transport 6,9 %=' || k || ';';
  -- messages privés interdits pendant la mission
  perform set_config('request.jwt.claims', json_build_object('sub', B, 'role', 'authenticated')::text, true);
  begin perform public.dm_ouvrir(TU); r := r || 'I32 KO;'; exception when others then r := r || 'I32 dm acheteur-transporteur refusé;'; end;
  -- admin : réglage
  perform set_config('request.jwt.claims', json_build_object('sub', B, 'role', 'authenticated')::text, true);
  begin perform public.admin_transport_reseau(true); r := r || 'I33 KO;'; exception when others then r := r || 'I33 réglage réservé admin;'; end;
  raise exception 'TEST %', r;
end $$;

-- J. Relecture (schéma 83e) : faux positifs du filtre des numéros (prix, dates, numéro de commande, prix envoyés seuls)
do $$
declare S uuid := 'd56f75b3-463d-484d-9e19-4af3fd3eb8d8'; B uuid := 'efec4ce4-7ab1-4b93-9e90-020bd0007a8c'; d uuid; t text; r text := '';
begin
  r := r || 'J1 ' || coalesce(public.sortie_motif('Prix : 3 000 / 4 500 / 6 000 / 8 000'), 'rien') || ' / ' || coalesce(public.sortie_motif('livraison 15/10/2026 - 20/10/2026'), 'rien')
    || ' / ' || coalesce(public.sortie_motif('commande MDG-C-260105-123456'), 'rien') || ' / ' || coalesce(public.texte_refus('Sacs de 3 000 / 4 500 / 6 000 / 8 000 F'), 'accepté') || ';';
  r := r || 'J2 ' || public.sortie_masquer('appelle 0745123389') || ' / ' || public.sortie_masquer('+2250745123389') || ' / ' || public.sortie_masquer('07.45.12.33.89') || ';';
  perform set_config('request.jwt.claims', json_build_object('sub', B, 'role', 'authenticated')::text, true);
  d := public.dm_ouvrir(S);
  perform public.dm_envoyer(d, '15000');
  perform public.dm_envoyer(d, '25000');
  perform public.dm_envoyer(d, '30000');
  select string_agg(texte, ' | ' order by texte) into t from public.dm where discussion_id = d and created_at = now();
  r := r || 'J3 ' || t || ';';
  raise exception 'TEST %', r;
end $$;
