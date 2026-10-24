-- Tests du schéma 85 (niveaux), projet de test seulement. Chaque bloc finit par raise exception 'TEST …' : tout est annulé.
-- Comptes de simulation du projet de test (aucune donnée réelle). A = administrateur.

-- Bloc A : vendeur. Aucun niveau à 2 commandes, Vendeur fiable à 3, Bon vendeur à 10 sur 3 mois ; une annulation abusive
-- fait entrer en grâce (le niveau reste affiché) ; requalifiée légitime, la grâce est levée ; fin de la grâce : descente ;
-- contestation (une seule ouverte), acceptée par l'équipe : niveau rendu pour 90 jours ; fin du forçage : nouvelle grâce ;
-- commandes trop anciennes + fin de grâce : retrait. Litige en cours et litige partagé : aucun effet.
do $$
declare S uuid := 'ec35879a-1009-4b40-9c66-53a9b2595eb8';
  B uuid[] := array['9bdc3a6d-93b3-41f1-bbbd-984b1094f05f','af343de8-c7f9-4531-899e-624322b72a38','66b186ee-6e92-4a0d-8bc9-d5b5699d652f',
                    'ec705bc9-0a7b-45f8-905d-3458bad00037','9a88ae51-03fb-41e9-8197-485763bf74af','f8e1b009-e7c7-4637-b685-c05155f06be9']::uuid[];
  A uuid := '981961d4-25ba-4e1b-a732-8fd68cd6c922';
  cid uuid; ann uuid; ctid uuid; i int; res text := ''; e text;
  niv text; grace timestamptz;
begin
  for i in 1..10 loop
    insert into public.commandes (numero, vendeur_id, acheteur_id, cree_par, produit, quantite, unite, prix_unitaire, montant, mode_transport, etat, etape)
    values ('T85A-' || i, S, B[1 + (i % 6)], B[1 + (i % 6)], 'mais', 1, 'sac', 100000, 100000, 'vendeur', 'en_cours', 'confirmee') returning id into cid;
    update public.commandes set etat = 'terminee', etape = 'terminee', termine_le = now() - make_interval(days => case when i <= 3 then 0 when i <= 6 then 40 else 75 end),
      libere_le = now(), liberation = 'auto' where id = cid;
    if i = 2 then res := res || ' | 2 cmd : ' || coalesce((select niveau from public.niveaux_membres where user_id = S and role = 'vendeur'), 'aucun'); end if;
    if i = 3 then res := res || ' | 3 cmd : ' || coalesce((select niveau from public.niveaux_membres where user_id = S and role = 'vendeur'), 'aucun'); end if;
  end loop;
  -- les dates ont été posées après le déclencheur : on recalcule (comme la tâche de nuit)
  perform public._niv_appliquer(S, 'vendeur');
  res := res || ' | 10 cmd sur 3 mois : ' || (select niveau from public.niveaux_membres where user_id = S and role = 'vendeur')
    || ' public=' || coalesce((select vendeur_libelle from public.niveaux_publics(array[S])), 'rien');

  -- litige en cours : ne compte pas
  insert into public.commandes (numero, vendeur_id, acheteur_id, cree_par, produit, quantite, unite, prix_unitaire, montant, mode_transport, etat, etape, litige_par, litige_le)
  values ('T85A-L', S, B[1], B[1], 'mais', 1, 'sac', 100000, 100000, 'vendeur', 'litige', 'arrivee', B[1], now());
  -- litige partagé (personne n'est fautif) : ne compte pas
  insert into public.annulations (commande_id, vendeur_id, acheteur_id, imputable_id, chemin, categorie, categorie_auto)
  values (gen_random_uuid(), S, B[2], null, 'litige', 'litige', 'litige');
  perform public._niv_appliquer(S, 'vendeur');
  res := res || ' | litige en cours + partagé : ' || (select niveau || ' sans grâce' from public.niveaux_membres where user_id = S and role = 'vendeur' and grace_jusqua is null);

  -- une annulation abusive : 1 / 11 = 9,1 % > 7 % → grâce, le niveau reste
  insert into public.annulations (commande_id, vendeur_id, acheteur_id, demandeur_id, imputable_id, role_imputable, chemin, categorie, categorie_auto)
  values (gen_random_uuid(), S, B[3], S, S, 'vendeur', 'accord', 'abusive', 'abusive') returning id into ann;
  select niveau, grace_jusqua into niv, grace from public.niveaux_membres where user_id = S and role = 'vendeur';
  res := res || ' | abusive : niveau=' || niv || ' grâce=' || round(extract(epoch from grace - now()) / 86400) || ' j, vers='
    || coalesce((select grace_vers from public.niveaux_membres where user_id = S and role = 'vendeur'), 'aucun')
    || ' public=' || (select vendeur_libelle from public.niveaux_publics(array[S]))
    || ' journal=' || (select string_agg(evenement, ',' order by at) from public.niveaux_journal where user_id = S);

  -- l'équipe la requalifie légitime : grâce levée
  perform set_config('request.jwt.claims', json_build_object('sub', A, 'role', 'authenticated')::text, true);
  perform public.admin_annulation_classer(ann, 'legitime', null, 'test');
  res := res || ' | requalifiée : grâce=' || coalesce((select grace_jusqua::text from public.niveaux_membres where user_id = S and role = 'vendeur'), 'levée')
    || ' dernier=' || (select evenement from public.niveaux_journal where user_id = S order by at desc limit 1);
  perform public.admin_annulation_classer(ann, 'abusive', S, 'test');
  res := res || ' | re-abusive : ' || (select evenement from public.niveaux_journal where user_id = S order by at desc limit 1);

  -- fin de la grâce (simulée) : descente vers Vendeur fiable
  update public.niveaux_membres set grace_jusqua = now() - interval '1 minute' where user_id = S and role = 'vendeur';
  perform public._niv_appliquer(S, 'vendeur');
  res := res || ' | fin de grâce : ' || (select niveau from public.niveaux_membres where user_id = S and role = 'vendeur')
    || ' (' || (select evenement || ' ' || ancien || '→' || nouveau from public.niveaux_journal where user_id = S order by at desc limit 1) || ')';

  -- contestation par le membre
  perform set_config('request.jwt.claims', json_build_object('sub', S, 'role', 'authenticated')::text, true);
  begin perform public.niveaux_contester('vendeur', 'ok'); res := res || ' | texte court ACCEPTÉ (erreur)'; exception when others then res := res || ' | texte court refusé'; end;
  begin perform public.niveaux_contester('acheteur', 'Je conteste ce niveau'); res := res || ' | rôle sans baisse ACCEPTÉ (erreur)'; exception when others then res := res || ' | rôle sans baisse refusé'; end;
  ctid := public.niveaux_contester('vendeur', 'Cette annulation venait d''une panne de camion.');
  begin perform public.niveaux_contester('vendeur', 'Encore une fois je conteste'); res := res || ' | 2e ACCEPTÉE (erreur)'; exception when others then res := res || ' | 2e refusée'; end;
  res := res || ' | moi : contestation=' || (public.niveaux_moi() -> 'contestation' ->> 'statut') || ' non_vus=' || (public.niveaux_moi() ->> 'non_vus');
  begin perform public.admin_niveaux_decider(ctid, true, 'Je me l''accorde'); res := res || ' | membre décide ACCEPTÉ (erreur)'; exception when others then res := res || ' | membre ne décide pas'; end;
  perform set_config('request.jwt.claims', json_build_object('sub', A, 'role', 'authenticated')::text, true);
  perform public.admin_niveaux_decider(ctid, true, 'Panne vérifiée, niveau rendu.');
  res := res || ' | acceptée : ' || (select niveau || ' forcé ' || round(extract(epoch from force_jusqua - now()) / 86400) || ' j' from public.niveaux_membres where user_id = S and role = 'vendeur')
    || ' public=' || (select vendeur_libelle from public.niveaux_publics(array[S]));
  perform public._niv_appliquer(S, 'vendeur');
  res := res || ' | recalcul pendant le forçage : ' || public._niv_effectif(S, 'vendeur');
  begin perform public.admin_niveaux_decider(ctid, false, 'non'); res := res || ' | 2e décision ACCEPTÉE (erreur)'; exception when others then res := res || ' | 2e décision refusée'; end;

  -- fin du forçage : retour au calcul, avec une nouvelle grâce
  update public.niveaux_membres set force_jusqua = now() - interval '1 minute' where user_id = S and role = 'vendeur';
  perform public._niv_appliquer(S, 'vendeur');
  res := res || ' | fin du forçage : ' || (select niveau || coalesce(' en grâce vers ' || coalesce(grace_vers, 'aucun'), '') from public.niveaux_membres where user_id = S and role = 'vendeur');

  -- plus aucune commande dans la fenêtre + fin de grâce : retrait
  update public.commandes set termine_le = now() - interval '400 days' where vendeur_id = S and numero like 'T85A-%';
  perform public._niv_appliquer(S, 'vendeur');
  update public.niveaux_membres set grace_jusqua = now() - interval '1 minute' where user_id = S and role = 'vendeur';
  perform public._niv_appliquer(S, 'vendeur');
  res := res || ' | retrait : ' || coalesce((select niveau from public.niveaux_membres where user_id = S and role = 'vendeur'), 'aucun')
    || ' public=' || coalesce((select vendeur_libelle from public.niveaux_publics(array[S])), 'rien')
    || ' journal=' || (select string_agg(evenement, ',' order by at) from public.niveaux_journal where user_id = S);
  raise exception 'TEST A%', res;
end $$;
-- Résultat obtenu (24/10/2026) :
-- TEST A | 2 cmd : aucun | 3 cmd : fiable | 10 cmd sur 3 mois : bon public=Bon vendeur | litige en cours + partagé : bon sans grâce
-- | abusive : niveau=bon grâce=30 j, vers=fiable public=Bon vendeur journal=monte,monte,grace | requalifiée : grâce=levée dernier=grace_levee
-- | re-abusive : grace | fin de grâce : fiable (descend bon→fiable) | texte court refusé | rôle sans baisse refusé | 2e refusée
-- | moi : contestation=ouverte non_vus=5 | membre ne décide pas | acceptée : bon forcé 90 j public=Bon vendeur | recalcul pendant le forçage : bon
-- | 2e décision refusée | fin du forçage : bon en grâce vers fiable
-- | retrait : aucun public=rien journal=monte,monte,grace,grace_levee,grace,descend,force,force_fin,grace,retire

-- Bloc B : acheteur. Excellent demande des commandes validées par code (au plus 5 par partenaire), une note d'au moins 4,5
-- et l'identité vérifiée ; badge « Acheteur en gros » (5 commandes de 500 000 F CFA ou plus) ; grâce si des commandes
-- ne comptent plus ; réglages par l'administrateur (refusés au membre, bornes, ordre des paliers), grâce et retrait du badge en gros.
do $$
declare X uuid := '2e332234-6183-459a-999b-ff6233d95181';
  V uuid[] := array['7162e623-e8cc-43ba-ba3d-73cc08ffe052','b5d74423-02f8-4535-b99e-452c4ad6ac34','072428f6-50e3-471c-9256-1439e5b62484',
                    'e0b19df7-ca40-4760-a03b-53dc4109348f','ec35879a-1009-4b40-9c66-53a9b2595eb8','9bdc3a6d-93b3-41f1-bbbd-984b1094f05f']::uuid[];
  A uuid := '981961d4-25ba-4e1b-a732-8fd68cd6c922';
  cid uuid; cids uuid[] := '{}'; i int; res text := ''; d jsonb;
begin
  for i in 1..31 loop
    insert into public.commandes (numero, vendeur_id, acheteur_id, cree_par, produit, quantite, unite, prix_unitaire, montant, mode_transport, etat, etape, validation)
    values ('T85B-' || i, V[1 + (i % 6)], X, X, 'igname', 1, 'sac', 100000, case when i <= 5 then 600000 else 100000 end, 'vendeur', 'en_cours', 'confirmee', 'code') returning id into cid;
    cids := cids || cid;
    update public.commandes set etat = 'terminee', etape = 'terminee', termine_le = now() - make_interval(days => (i % 6) * 30 + 1),
      libere_le = now(), liberation = 'auto' where id = cid;
  end loop;
  for i in 1..3 loop
    insert into public.avis_commandes (commande_id, auteur_id, cible_id, role_cible, note) values (cids[i], V[1 + (i % 6)], X, 'acheteur', 5);
  end loop;
  perform public._niv_appliquer(X, 'acheteur');
  d := (select chiffres from public.niveaux_membres where user_id = X and role = 'acheteur');
  res := res || ' | sans identité : ' || (select niveau || ' gros=' || gros from public.niveaux_membres where user_id = X and role = 'acheteur')
    || ' commandes=' || (d ->> 'commandes') || ' mois=' || (d ->> 'mois') || ' note=' || (d ->> 'note') || ' excellent comptées (code, 5 par partenaire)=' || (d -> 'detail' -> 2 ->> 'commandes')
    || ' ok=' || (d -> 'detail' -> 2 ->> 'ok');
  insert into public.verifications (user_id, statut, piece, defi, decide_le, expire_le) values (X, 'verifie', 'cni', '1234', now(), current_date + 365);
  perform public._niv_appliquer(X, 'acheteur');
  res := res || ' | identité vérifiée : ' || (select niveau from public.niveaux_membres where user_id = X and role = 'acheteur')
    || ' public=' || (select acheteur_libelle || ' gros=' || gros from public.niveaux_publics(array[X]));
  update public.commandes set validation = 'declaration' where id in (cids[2], cids[8]);
  perform public._niv_appliquer(X, 'acheteur');
  res := res || ' | 2 sans code : ' || (select niveau || ' grâce vers ' || coalesce(grace_vers, 'aucun') from public.niveaux_membres where user_id = X and role = 'acheteur');
  perform set_config('request.jwt.claims', json_build_object('sub', X, 'role', 'authenticated')::text, true);
  begin perform public.admin_niveaux_regle_modifier('acheteur', 'excellent', '{"commandes": 1}'); res := res || ' | membre modifie ACCEPTÉ (erreur)'; exception when others then res := res || ' | membre refusé'; end;
  begin perform public.admin_niveaux_regler('{"grace_jours": 0}'); res := res || ' | membre règle ACCEPTÉ (erreur)'; exception when others then res := res || ' | membre refusé (réglages)'; end;
  begin perform public.admin_niveaux(); res := res || ' | membre lit admin ACCEPTÉ (erreur)'; exception when others then res := res || ' | membre ne lit pas l''admin'; end;
  perform set_config('request.jwt.claims', json_build_object('sub', A, 'role', 'authenticated')::text, true);
  perform public.admin_niveaux_regle_modifier('acheteur', 'excellent', '{"commandes": 25}');
  res := res || ' | admin excellent=25 : ' || (select niveau || ' sans grâce' from public.niveaux_membres where user_id = X and role = 'acheteur' and grace_jusqua is null);
  begin perform public.admin_niveaux_regle_modifier('acheteur', 'bon', '{"commandes": 50}'); res := res || ' | ordre cassé ACCEPTÉ (erreur)'; exception when others then res := res || ' | ordre cassé refusé'; end;
  begin perform public.admin_niveaux_regle_modifier('acheteur', 'bon', '{"abus_max": 150}'); res := res || ' | 150 % ACCEPTÉ (erreur)'; exception when others then res := res || ' | 150 % refusé'; end;
  begin perform public.admin_niveaux_regle_modifier('acheteur', 'bon', '{"pirate": 1}'); res := res || ' | clé inconnue ACCEPTÉE (erreur)'; exception when others then res := res || ' | clé inconnue refusée'; end;
  perform public.admin_niveaux_regle_modifier('acheteur', 'grand', '{"commandes": 25, "mois": 6, "volume_min": 3000000}');
  res := res || ' | admin grand=25 et 3 M : ' || (select niveau from public.niveaux_membres where user_id = X and role = 'acheteur')
    || ' volume=' || (select chiffres ->> 'volume' from public.niveaux_membres where user_id = X and role = 'acheteur');
  begin perform public.admin_niveaux_regler('{"fenetre_jours": 5}'); res := res || ' | fenêtre 5 j ACCEPTÉE (erreur)'; exception when others then res := res || ' | fenêtre 5 j refusée'; end;
  begin perform public.admin_niveaux_regler('{"pirate": 5}'); res := res || ' | réglage inconnu ACCEPTÉ (erreur)'; exception when others then res := res || ' | réglage inconnu refusé'; end;
  perform public.admin_niveaux_regler('{"gros_montant": 700000}');
  res := res || ' | gros à 700 000 : gros=' || (select gros || coalesce(' en grâce', '') from public.niveaux_membres where user_id = X and role = 'acheteur' and gros_grace_jusqua is not null)
    || ' public gros=' || (select gros from public.niveaux_publics(array[X]));
  update public.niveaux_membres set gros_grace_jusqua = now() - interval '1 minute' where user_id = X and role = 'acheteur';
  perform public._niv_appliquer(X, 'acheteur');
  res := res || ' | fin de grâce gros : ' || (select gros from public.niveaux_membres where user_id = X and role = 'acheteur');
  res := res || ' | admin_niveaux : contestations=' || json_array_length(public.admin_niveaux() -> 'contestations') || ' répartition=' || (public.admin_niveaux() -> 'repartition')::text;
  res := res || ' | journal=' || (select string_agg(evenement || coalesce(':' || nouveau, ''), ',' order by at) from public.niveaux_journal where user_id = X);
  raise exception 'TEST B%', res;
end $$;
-- Résultat obtenu (24/10/2026) :
-- TEST B | sans identité : bon gros=true commandes=31 mois=6 note=5.0 excellent comptées (code, 5 par partenaire)=30 ok=false
-- | identité vérifiée : excellent public=Excellent acheteur gros=true | 2 sans code : excellent grâce vers bon
-- | membre refusé | membre refusé (réglages) | membre ne lit pas l'admin | admin excellent=25 : excellent sans grâce
-- | ordre cassé refusé | 150 % refusé | clé inconnue refusée | admin grand=25 et 3 M : grand volume=5600000
-- | fenêtre 5 j refusée | réglage inconnu refusé | gros à 700 000 : gros=true en grâce public gros=true | fin de grâce gros : false
-- | admin_niveaux : contestations=0 répartition=[vendeur fiable 6, acheteur fiable 1, acheteur grand 1]
-- | journal=monte:fiable,gros:gros,monte:bon,monte:excellent,grace:bon,grace_levee:excellent,monte:grand,gros_grace,gros_retire

-- Bloc C : ce qui ne compte pas (refus total, partenaire banni), comptes exclus (banni, officiel), historique figé,
-- droits réels d'un membre connecté et d'un visiteur.
do $$
declare S uuid := 'ec35879a-1009-4b40-9c66-53a9b2595eb8'; X uuid := '2e332234-6183-459a-999b-ff6233d95181';
  B uuid[] := array['9bdc3a6d-93b3-41f1-bbbd-984b1094f05f','af343de8-c7f9-4531-899e-624322b72a38','66b186ee-6e92-4a0d-8bc9-d5b5699d652f']::uuid[];
  A uuid := '981961d4-25ba-4e1b-a732-8fd68cd6c922'; cid uuid; i int; res text := ''; n int;
begin
  for i in 1..3 loop
    insert into public.commandes (numero, vendeur_id, acheteur_id, cree_par, produit, quantite, unite, prix_unitaire, montant, mode_transport, etat, etape)
    values ('T85C-' || i, S, B[i], B[i], 'mais', 1, 'sac', 100000, 100000, 'vendeur', 'en_cours', 'confirmee') returning id into cid;
    update public.commandes set etat = 'terminee', etape = 'terminee', termine_le = now(), libere_le = now(), liberation = case when i = 1 then 'admin' else 'auto' end,
      montant_refuse = case when i = 1 then 100000 else 0 end where id = cid;
  end loop;
  insert into public.bannis (user_id, motif) values (B[2], 'autre');
  perform public._niv_appliquer(S, 'vendeur');
  res := res || ' | refus total + acheteur banni : ' || coalesce((select niveau from public.niveaux_membres where user_id = S and role = 'vendeur'), 'aucun')
    || ' comptées=' || (select chiffres ->> 'commandes' from public.niveaux_membres where user_id = S and role = 'vendeur');
  update public.niveaux_membres set niveau = 'bon' where user_id = S and role = 'vendeur';
  insert into public.niveaux_membres (user_id, role, niveau) values (A, 'vendeur', 'grand') on conflict (user_id, role) do update set niveau = 'grand';
  insert into public.bannis (user_id, motif) values (S, 'autre');
  res := res || ' | publics(banni, admin)=' || (select count(*) from public.niveaux_publics(array[S, A]));
  insert into public.niveaux_journal (user_id, role, evenement) values (X, 'vendeur', 'monte');
  begin update public.niveaux_journal set nouveau = 'grand' where user_id = X; res := res || ' | journal modifié (erreur)'; exception when others then res := res || ' | journal figé'; end;
  perform set_config('request.jwt.claims', json_build_object('sub', X, 'role', 'authenticated')::text, true);
  set local role authenticated;
  begin perform 1 from public.niveaux_membres limit 1; res := res || ' | lit niveaux_membres (erreur)'; exception when others then res := res || ' | niveaux_membres fermé'; end;
  begin insert into public.niveaux_membres (user_id, role, niveau) values (X, 'vendeur', 'grand'); res := res || ' | s''attribue un niveau (erreur)'; exception when others then res := res || ' | auto-attribution refusée'; end;
  begin insert into public.niveaux_journal (user_id, role, evenement) values (X, 'vendeur', 'monte'); res := res || ' | écrit le journal (erreur)'; exception when others then res := res || ' | journal fermé'; end;
  begin update public.niveaux_regles set commandes = 1; res := res || ' | change les seuils (erreur)'; exception when others then res := res || ' | seuils fermés'; end;
  begin perform 1 from public.niveaux_contestations limit 1; res := res || ' | lit les contestations (erreur)'; exception when others then res := res || ' | contestations fermées'; end;
  begin perform public._niv_appliquer(X, 'vendeur'); res := res || ' | recalcule lui-même (erreur)'; exception when others then res := res || ' | _niv_appliquer fermé'; end;
  begin perform public.niveaux_recalculer(); res := res || ' | lance le recalcul (erreur)'; exception when others then res := res || ' | niveaux_recalculer fermé'; end;
  begin perform public._niv_calculer(S, 'vendeur'); res := res || ' | lit les chiffres d''un autre (erreur)'; exception when others then res := res || ' | _niv_calculer fermé'; end;
  perform public.niveaux_vu();
  res := res || ' | niveaux_moi ok=' || (public.niveaux_moi() -> 'roles' -> 'acheteur' ->> 'niveau' is null)::text || ' publics ok=' || (select count(*) from public.niveaux_publics(array[X]))::text
    || ' criteres=' || json_array_length(public.niveaux_criteres() -> 'niveaux');
  reset role;
  perform set_config('request.jwt.claims', '', true);
  set local role anon;
  res := res || ' | anon publics=' || (select count(*) from public.niveaux_publics(array[X, S]))::text || ' criteres=' || json_array_length(public.niveaux_criteres() -> 'niveaux');
  begin perform public.niveaux_moi(); res := res || ' | anon niveaux_moi (erreur)'; exception when others then res := res || ' | anon niveaux_moi refusé'; end;
  begin perform public.niveaux_contester('vendeur', 'bonjour à tous'); res := res || ' | anon conteste (erreur)'; exception when others then res := res || ' | anon conteste refusé'; end;
  begin perform public.admin_niveaux(); res := res || ' | anon admin (erreur)'; exception when others then res := res || ' | anon admin refusé'; end;
  begin perform 1 from public.niveaux_membres; res := res || ' | anon lit la table (erreur)'; exception when others then res := res || ' | anon table fermée'; end;
  reset role;
  raise exception 'TEST C%', res;
end $$;
-- Résultat obtenu (24/10/2026) :
-- TEST C | refus total + acheteur banni : aucun comptées=1 | publics(banni, admin)=0 | journal figé | niveaux_membres fermé
-- | auto-attribution refusée | journal fermé | seuils fermés | contestations fermées | _niv_appliquer fermé | niveaux_recalculer fermé
-- | _niv_calculer fermé | niveaux_moi ok=true publics ok=0 criteres=8 | anon publics=0 criteres=8 | anon niveaux_moi refusé
-- | anon conteste refusé | anon admin refusé | anon table fermée
