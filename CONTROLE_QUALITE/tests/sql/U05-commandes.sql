-- U05 Commandes et négociations : exercices joués sur le projet de TEST (yowdymdnoiubatxlwhfv). Rien ne reste : chaque bloc finit par raise exception.
-- Coller d'abord le contenu de _outils.sql (même dossier) dans la même requête. Résultats du 25/10/2026 : CONTROLE_QUALITE/rapports/annexes/2026-10-25-metier.md.

-- ══ Bloc CMD-A : négociation (expiration, arrêt 24 h, tiers, propre proposition, deux contre-propositions, appels répétés) ══
do $$
declare S uuid := '1bfd5713-2525-44a6-8403-084ebb9ddad3'; B uuid := '68345d7a-9d64-410a-a4c7-92a750d9888d'; Cm uuid := 'e0191bd5-e039-4948-9143-6a30cfdeaf6c';
  o uuid; n uuid; n2 uuid; nb uuid; c uuid; p1 uuid; p2 uuid; res text := '';
begin
  perform pg_temp.verif(S);
  o := pg_temp.offre(S, 100, 20000, 'cmda');
  -- CMD-01 : contre-proposition après expiration (48 h)
  perform pg_temp.qui(B); n := public.nego_ouvrir('offre', o, 18000, 10, null);
  execute 'reset role';
  update public.messages set expire_le = now() - interval '1 minute' where id = (select dernier_msg from public.negociations where id = n);
  update public.negociations set expire_le = now() - interval '1 minute' where id = n;
  perform pg_temp.qui(S);
  res := 'CMD-01a accord après 48 h: ' || pg_temp.e(format('select public.nego_agir(%L, %L, null, null, null, null)', n, 'accord'));
  res := res || ' | CMD-01b contre-proposition après expiration: ' || pg_temp.e(format('select public.nego_agir(%L, %L, 19500, 10, null, null)', n, 'prix'));
  -- CMD-02 : proposition par un tiers et sur sa propre proposition
  perform pg_temp.qui(Cm);
  res := res || ' | CMD-02a tiers propose: ' || pg_temp.e(format('select public.nego_agir(%L, %L, 1, 10, null, null)', n, 'prix'))
     || ' tiers accepte: ' || pg_temp.e(format('select public.nego_agir(%L, %L, null, null, null, null)', n, 'accord'))
     || ' tiers écrit: ' || pg_temp.e(format('select public.nego_agir(%L, %L, null, null, %L, null)', n, 'texte', 'coucou'));
  perform pg_temp.qui(S);
  res := res || ' | CMD-02b vendeur accepte sa propre proposition: ' || pg_temp.e(format('select public.nego_agir(%L, %L, null, null, null, null)', n, 'accord'));
  -- CMD-03 : deux contre-propositions croisées, l'acheteur répond à l'ancienne
  p1 := pg_temp.lire(format('select dernier_msg::text from public.negociations where id = %L', n))::uuid;   -- 19 500 du vendeur
  perform pg_temp.qui(B); perform public.nego_agir(n, 'prix', 19000, 10, null, null);
  p2 := pg_temp.lire(format('select dernier_msg::text from public.negociations where id = %L', n))::uuid;
  res := res || ' | CMD-03a acheteur accepte l''ancienne (19 500) après sa contre-proposition: ' || pg_temp.e(format('select public.nego_agir(%L, %L, null, null, null, %L)', n, 'accord', p1));
  perform pg_temp.qui(S);
  res := res || ' | CMD-03b vendeur accepte avec la vieille référence: ' || pg_temp.e(format('select public.nego_agir(%L, %L, null, null, null, %L)', n, 'accord', p1));
  res := res || ' | CMD-03c vendeur accepte la dernière: ' || pg_temp.e(format('select public.nego_agir(%L, %L, null, null, null, %L)', n, 'accord', p2))
     || ' prix_final=' || pg_temp.lire(format('select prix_final::text from public.negociations where id = %L', n));
  res := res || ' | CMD-03d 2e accord (coupure réseau, même appel): ' || pg_temp.e(format('select public.nego_agir(%L, %L, null, null, null, %L)', n, 'accord', p2));
  perform pg_temp.qui(B);
  res := res || ' | CMD-03e acheteur repropose après accord: ' || pg_temp.e(format('select public.nego_agir(%L, %L, 1000, 10, null, null)', n, 'prix'));
  -- CMD-04 : commande créée deux fois (coupure réseau), par un tiers
  c := public.commande_creer2(n, 'vendeur', null, 'Daloa', null);
  res := res || ' | CMD-04a 2e création: ' || pg_temp.e(format('select public.commande_creer2(%L, %L, null, %L, null)', n, 'vendeur', 'Daloa'));
  perform pg_temp.qui(Cm);
  res := res || ' | CMD-04b tiers crée la commande: ' || pg_temp.e(format('select public.commande_creer2(%L, %L, null, %L, null)', n, 'vendeur', 'Daloa'))
     || ' tiers lit la commande: ' || pg_temp.lire(format('select count(*)::text from public.commandes where id = %L', c)) || ' (lecture service)';
  perform pg_temp.qui(S);
  perform public.commande_repondre(c, true, null);
  res := res || ' | CMD-04c 2e confirmation: ' || pg_temp.e(format('select public.commande_repondre(%L, true, null)', c));
  res := res || ' | CMD-04d refus après confirmation: ' || pg_temp.e(format('select public.commande_repondre_motif(%L, false, null, %L, null)', c, 'stock_epuise'));
  -- CMD-05 : arrêt de la négociation, nouvelle proposition dans les 24 h, puis après
  perform pg_temp.qui(B); nb := public.nego_ouvrir('offre', o, 15000, 5, null);
  perform pg_temp.qui(S); perform public.nego_agir(nb, 'fin', null, null, 'Prix trop bas', null);
  perform pg_temp.qui(B);
  res := res || ' | CMD-05a acheteur repropose dans la même négociation arrêtée: ' || pg_temp.e(format('select public.nego_agir(%L, %L, 16000, 5, null, null)', nb, 'prix'));
  res := res || ' | CMD-05b acheteur ouvre une nouvelle négociation: ' || pg_temp.e(format('select public.nego_ouvrir(%L, %L, 16000, 5, null)', 'offre', o));
  perform pg_temp.qui(S);
  res := res || ' | CMD-05c le vendeur (qui a arrêté) repropose: ' || pg_temp.e(format('select public.nego_agir(%L, %L, 19000, 5, null, null)', nb, 'prix'));
  perform public.nego_agir(nb, 'fin', null, null, null, null);
  execute 'reset role';
  update public.messages set created_at = now() - interval '25 hours' where negociation_id = nb and genre = 'fin';
  perform pg_temp.qui(B);
  res := res || ' | CMD-05d après 25 h: ' || pg_temp.e(format('select public.nego_agir(%L, %L, 16000, 5, null, null)', nb, 'prix'));
  -- CMD-06 : nego_ouvrir appelé deux fois (double appui) : une seule négociation, une seule proposition en attente
  n2 := public.nego_ouvrir('offre', o, 17000, 3, null);
  perform public.nego_ouvrir('offre', o, 17000, 3, null);
  res := res || ' | CMD-06 double appui: négociations ouvertes=' || pg_temp.lire(format('select count(*)::text from public.negociations where cible_id = %L and auteur_id = %L and statut = %L', o, B, 'ouverte'))
     || ' propositions en attente=' || pg_temp.lire(format('select count(*)::text from public.messages where negociation_id = %L and issue = %L', n2, 'en_attente'))
     || ' remplacées=' || pg_temp.lire(format('select count(*)::text from public.messages where negociation_id = %L and issue = %L', n2, 'remplacee'));
  raise exception 'TEST OK: %', res;
end $$;
-- Résultat (25/10/2026) : CMD-01a expirée refusée | 01b nouvelle proposition ok | CMD-02a tiers : « Négociation introuvable » ×3 | 02b propre proposition refusée
-- | CMD-03a refusé | 03b vieille référence « La proposition a changé » | 03c dernière acceptée, prix 19 000 | 03d/03e après accord : « conclue »
-- | CMD-04a 2e création « existe déjà » | 04b tiers « Accord introuvable » | 04c/04d « déjà reçu une réponse »
-- | CMD-05a/b NEGO_ARRETEE 24 h | 05c celui qui a arrêté peut reproposer | 05d après 25 h ok | CMD-06 1 négociation, 1 proposition en attente.

-- ══ Bloc CMD-B : étapes sautées, actions contradictoires, coupure au milieu ══
do $$
declare S uuid := '1bfd5713-2525-44a6-8403-084ebb9ddad3'; B uuid := '68345d7a-9d64-410a-a4c7-92a750d9888d';
  o uuid; n uuid; c uuid; c2 uuid; res text := ''; nb0 int; p text[];
begin
  perform pg_temp.verif(S);
  o := pg_temp.offre(S, 100, 20000, 'cmdb');
  n := pg_temp.accord(S, B, o, 20000, 10);
  c := pg_temp.cmd(S, B, n, false);
  -- CMD-07 : étapes interdites quand la commande attend la réponse du vendeur
  perform pg_temp.qui(S);
  res := 'CMD-07a chargement avant confirmation: ' || pg_temp.e(format('select public.commande_avancer(%L, %L, null, null, null, null)', c, 'chargement'));
  perform pg_temp.qui(B);
  res := res || ' | CMD-07b acheteur confirme sa propre commande: ' || pg_temp.e(format('select public.commande_repondre(%L, true, null)', c));
  res := res || ' | CMD-07c réception avant confirmation: ' || pg_temp.e(format('select public.commande_reception_mot(%L, %L, true, null, null, null)', c, 'x'));
  perform pg_temp.qui(S); perform public.commande_repondre(c, true, null);
  -- CMD-08 : étapes sautées après confirmation
  res := res || ' | CMD-08a départ avant chargement: ' || pg_temp.e(format('select public.commande_avancer(%L, %L, null, null, null, null)', c, 'transport'));
  res := res || ' | CMD-08b livraison déclarée avant chargement: ' || pg_temp.e(format('select public.commande_avancer(%L, %L, null, null, null, null)', c, 'arrivee'));
  res := res || ' | CMD-08c chargement sans preuves: ' || pg_temp.e(format('select public.commande_avancer(%L, %L, null, null, null, null)', c, 'chargement'));
  res := res || ' | CMD-08d vendeur confirme la réception: ' || pg_temp.e(format('select public.commande_avancer(%L, %L, null, null, null, null)', c, 'reception'));
  res := res || ' | CMD-08e étape « terminee » directe: ' || pg_temp.e(format('select public.commande_avancer(%L, %L, null, null, null, null)', c, 'terminee'));
  perform pg_temp.qui(B);
  res := res || ' | CMD-08f acheteur « arrivée » avant chargement: ' || pg_temp.e(format('select public.commande_avancer(%L, %L, null, null, null, null)', c, 'arrivee'));
  res := res || ' | CMD-08g acheteur réception sans mot avant chargement: ' || pg_temp.e(format('select public.commande_reception_mot(%L, null, true, null, null, null)', c));
  res := res || ' | CMD-08h acheteur prépare: ' || pg_temp.e(format('select public.commande_avancer(%L, %L, null, null, null, null)', c, 'preparation'));
  res := res || ' | CMD-08i clôture avant réception: ' || pg_temp.e(format('select public.commande_liberer(%L)', c));
  -- CMD-09 : actions contradictoires : le vendeur demande l'annulation puis charge quand même
  perform pg_temp.qui(S);
  res := res || ' | CMD-09a vendeur demande l''annulation: ' || public.commande_annuler_motif(c, true, null, 'prix_change', null, null);
  execute 'reset role';
  p := array[S || '/cq/' || c || '-1.jpg', S || '/cq/' || c || '-2.jpg', S || '/motpapier-cq-' || c || '.jpg'];
  perform pg_temp.qui(S); perform public.commande_depart_defi(c);
  execute 'reset role';
  insert into storage.objects (bucket_id, name, owner, created_at) values ('preuves', p[1], S, now() + interval '1 second'), ('preuves', p[2], S, now() + interval '1 second'), ('preuves', p[3], S, now() + interval '1 second');
  perform pg_temp.qui(S);
  perform public.commande_depart_preuves(c, array[p[1], p[2]], 100);
  perform public.commande_depart_mot(c, p[3]);
  res := res || ' | CMD-09b chargement pendant la demande d''annulation: ' || pg_temp.e(format('select public.commande_avancer(%L, %L, null, null, null, null)', c, 'chargement'))
     || ' annulation_par=' || pg_temp.lire(format('select coalesce(annulation_par::text, %L) from public.commandes where id = %L', 'vide', c));
  perform pg_temp.qui(B);
  res := res || ' | CMD-09c acheteur accepte l''annulation ensuite: ' || pg_temp.e(format('select public.commande_annuler_motif(%L, true, null, null, null, true)', c))
     || ' ' || pg_temp.cs(c) || ' stock=' || pg_temp.lire(format('select quantity::text from public.offres where id = %L', o));
  res := res || ' | CMD-09d acheteur refuse l''annulation ensuite: ' || pg_temp.e(format('select public.commande_annuler_motif(%L, false, null, null, null, null)', c));
  -- CMD-10 : acheteur annule sa commande pendant que le vendeur la confirme (ordre : acheteur d'abord)
  execute 'reset role';
  n := pg_temp.accord(S, B, o, 20000, 5);
  c2 := pg_temp.cmd(S, B, n, false);
  perform pg_temp.qui(B);
  res := res || ' | CMD-10a acheteur annule: ' || pg_temp.e(format('select public.commande_annuler_motif(%L, true, null, %L, null, null)', c2, 'erreur_saisie'));
  perform pg_temp.qui(S);
  res := res || ' | CMD-10b vendeur confirme juste après: ' || pg_temp.e(format('select public.commande_repondre(%L, true, null)', c2)) || ' ' || pg_temp.cs(c2);
  -- CMD-11 : coupure au milieu de la création de commande (erreur dans la même transaction)
  execute 'reset role';
  n := pg_temp.accord(S, B, o, 20000, 5);
  select count(*) into nb0 from public.commandes where negociation_id = n;
  perform pg_temp.qui(B);
  begin
    perform public.commande_creer2(n, 'vendeur', null, 'Daloa', null);
    raise exception 'coupure simulée';
  exception when others then null;
  end;
  res := res || ' | CMD-11a après coupure: commandes=' || nb0 || '→' || pg_temp.lire(format('select count(*)::text from public.commandes where negociation_id = %L', n))
     || ' recréer: ' || pg_temp.e(format('select public.commande_creer2(%L, %L, null, %L, null)', n, 'vendeur', 'Daloa'));
  -- CMD-11b : ville imposée par le vendeur (ville seulement) : refus avant toute écriture
  execute 'reset role';
  update public.offres set ville_seulement = true where id = o;
  n := pg_temp.accord(S, B, o, 20000, 5);
  perform pg_temp.qui(B);
  res := res || ' | CMD-11b livraison hors ville: ' || pg_temp.e(format('select public.commande_creer2(%L, %L, null, %L, null)', n, 'vendeur', 'Daloa'))
     || ' commandes=' || pg_temp.lire(format('select count(*)::text from public.commandes where negociation_id = %L', n));
  raise exception 'TEST OK: %', res;
end $$;
-- Résultat (25/10/2026) : CMD-07a/c « n'est pas en cours » | 07b « C'est l'autre partie qui confirme » | CMD-08a–i toutes refusées
-- (08d vendeur : message MOT_REQUIS adressé à l'acheteur ; 08f acheteur : « Étape déjà passée » alors que rien n'est chargé)
-- | CMD-09a annulation demandée | 09b le vendeur charge quand même : ok, annulation_par reste rempli | 09c/09d l'acheteur ne peut ni accepter ni refuser
-- (« La marchandise est chargée ») : la demande d'annulation reste pendante | CMD-10a annulée par l'acheteur, 10b confirmation refusée
-- | CMD-11a coupure : 0 commande, recréation ok | 11b ville seulement : refus avant écriture, 0 commande.

-- ══ Bloc CMD-C : états sans sortie. Chaque commande est vieillie de 30 jours, puis toutes les tâches automatiques passent. ══
-- Tâches actives (cron, projet de test) : commandes_delais (5 min), sequestre_liberer_echus (5 min), commandes_expirer (via fiabilite_tick ?), accords_sans_suite.
do $$
declare S uuid := '1bfd5713-2525-44a6-8403-084ebb9ddad3'; B uuid := '68345d7a-9d64-410a-a4c7-92a750d9888d';
  o uuid; n uuid; k text; c uuid[] := '{}'; x uuid; res text := ''; i int; mot text; et text[] := array[
    '1 a_confirmer', '2 confirmee (rien chargé)', '3 transport (livraison jamais déclarée)', '4 arrivée déclarée par l''acheteur', '5 livraison déclarée par le vendeur',
    '6 annulation demandée', '7 litige', '8 terminee non clôturée', '9 mot bloqué (5 essais)'];
begin
  perform pg_temp.verif(S);
  o := pg_temp.offre(S, 1000, 20000, 'cmdc');
  for i in 1..9 loop
    n := pg_temp.accord(S, B, o, 20000, 10);
    x := pg_temp.cmd(S, B, n, i > 1);
    c := c || x;
    if i in (3, 4, 5, 7, 8, 9) then perform pg_temp.partir(S, x); end if;
    if i = 4 then perform pg_temp.qui(B); perform public.commande_avancer(x, 'arrivee', null, null, null, null); end if;
    if i = 5 then perform pg_temp.qui(S); perform public.commande_avancer(x, 'arrivee', null, null, null, null); end if;
    if i = 6 then perform pg_temp.qui(S); perform public.commande_annuler_motif(x, true, null, 'prix_change', null, null); end if;
    if i = 7 then perform pg_temp.qui(B); perform public.commande_litige(x, 'Problème'); end if;
    if i = 8 then select mot_secret into mot from public.commandes where id = x; perform pg_temp.qui(B); perform public.commande_reception_mot(x, mot, false, null, null, null); end if;
    if i = 9 then perform pg_temp.qui(B); for k in select generate_series(1, 5)::text loop perform public.commande_reception_mot(x, 'faux' || k, false, null, null, null); end loop; end if;
    execute 'reset role';
  end loop;
  update public.commandes set created_at = now() - interval '30 days', confirme_le = case when confirme_le is not null then now() - interval '30 days' end,
    livre_le = case when livre_le is not null then now() - interval '30 days' end, termine_le = case when termine_le is not null then now() - interval '30 days' end,
    litige_le = case when litige_le is not null then now() - interval '30 days' end, litige_echeance = case when litige_echeance is not null then now() - interval '27 days' end
  where id = any (c);
  perform public.commandes_delais();
  perform public.commandes_expirer();
  perform public.sequestre_liberer_echus();
  perform public.accords_sans_suite();
  perform public.commandes_delais();
  for i in 1..9 loop
    res := res || ' | CMD-12.' || et[i] || ' → ' || (select concat_ws(' ', etat || '/' || coalesce(etape, '-'), case when libere_le is not null then 'libérée' end,
      case when litige_retard_le is not null then 'litige_en_retard' end, case when annulation_par is not null then 'annulation_pendante' end,
      'alertes=' || coalesce((select string_agg(distinct evenement, ',') from public.commande_alertes a where a.commande_id = cm.id), 'aucune'))
      from public.commandes cm where id = c[i]);
  end loop;
  raise exception 'TEST OK: %', res;
end $$;
-- Résultat (25/10/2026), après 30 jours simulés et passage de toutes les tâches :
-- 1 a_confirmer → annulee (expiration 48 h) | 2 confirmee → en_cours, alerte retard_chargement (l'acheteur peut annuler)
-- | 3 transport, livraison jamais déclarée → en_cours/transport, AUCUNE alerte, aucune sortie automatique
-- | 4 arrivée déclarée par l'acheteur (sans réception) → en_cours/arrivee, AUCUNE alerte, aucune sortie automatique (livre_le vide)
-- | 5 livraison déclarée par le vendeur → litige automatique (règle 24 h, en cours de changement vers 1 h + 1 h)
-- | 6 annulation demandée → reste pendante, alerte retard_chargement | 7 litige → litige_en_retard (décision de l'équipe)
-- | 8 terminee → libérée | 9 mot bloqué → en_cours/transport, alerte mot_bloque à l'équipe, aucune échéance.
-- En attente : deux connexions simultanées (CMD-13 : vendeur annule et acheteur confirme au même instant ; les fonctions verrouillent la commande par « for update »).
