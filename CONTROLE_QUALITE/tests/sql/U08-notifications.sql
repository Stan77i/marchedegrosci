-- U08 Notifications : exercices joués sur le projet de TEST (yowdymdnoiubatxlwhfv). Rien ne reste : chaque bloc finit par raise exception.
-- Coller d'abord le contenu de _outils.sql (même dossier) dans la même requête. Résultats du 25/10/2026 : CONTROLE_QUALITE/rapports/annexes/2026-10-25-metier.md.
-- Aucun envoi réel : notif_preparer écrit seulement le journal (annulé avec le bloc) ; la fonction « pousser » n'est pas appelée.

-- ══ Bloc NOT-A : notification qui annonce une disponibilité qui n'existe plus ══
do $$
declare S uuid := '1bfd5713-2525-44a6-8403-084ebb9ddad3'; B uuid := '68345d7a-9d64-410a-a4c7-92a750d9888d'; Cm uuid := 'e0191bd5-e039-4948-9143-6a30cfdeaf6c';
  D uuid := '86c69f98-e113-4bfb-bb2a-0bd32fba7830';
  o uuid; o2 uuid; o3 uuid; did uuid := gen_random_uuid(); n uuid; c uuid; res text := ''; j json; l json; k int;
begin
  perform pg_temp.verif(S); perform pg_temp.verif(D);
  update public.notif_regles set calme_debut = 0, calme_fin = 0, ecart_min = 1 where id = 1;   -- heures calmes neutralisées (bloc annulé)
  -- NOT-01 : offre publiée → file d'attente remplie par le déclencheur push_annonce
  o := pg_temp.offre(S, 1000, 20000, 'nota');
  res := 'NOT-01a file après publication: ' || (select count(*) from public.notif_file where objet_id = o::text) || ' ligne(s), quantité annoncée='
     || coalesce((select min(donnees ->> 'quantite') from public.notif_file where objet_id = o::text), '-');
  insert into public.notif_file (user_id, cat, type, cle, regroupe, objet_id, slug, libelle, url, donnees)
    values (B, 'offres', 'offre', 'cq-not01:' || o, 'cq-not01:' || o, o::text, 'mais', 'Maïs', 'x', jsonb_build_object('quantite', 1000, 'unite', 'sac', 'prix', 20000, 'ville', 'Yamoussoukro'));
  -- NOT-02 : 990 sacs vendus : l'offre reste active avec 10 sacs, la notification garde « 1 000 sacs »
  n := pg_temp.accord(S, Cm, o, 20000, 990);
  res := res || ' | NOT-02 après vente de 990: stock=' || (select quantity || '/' || status from public.offres where id = o)
     || ' objet_vivant=' || public._notif_objet_vivant('offre', o::text, null)
     || ' file: ' || (select string_agg(etat || ' quantite=' || (donnees ->> 'quantite'), ', ') from public.notif_file where cle = 'cq-not01:' || o);
  -- NOT-03 : prix changé par le vendeur : la notification garde l'ancien prix
  update public.offres set price = 30000 where id = o;
  res := res || ' | NOT-03 prix changé à 30 000: prix notifié=' || (select donnees ->> 'prix' from public.notif_file where cle = 'cq-not01:' || o);
  -- NOT-04 : offre épuisée (10 derniers sacs) → la file passe « perime », notif_preparer refuse
  n := pg_temp.accord(S, Cm, o, 20000, 10);
  l := public.notif_lots_prendre(300);
  res := res || ' | NOT-04 offre épuisée: ' || (select quantity || '/' || status from public.offres where id = o)
     || ' file=' || (select etat from public.notif_file where cle = 'cq-not01:' || o)
     || ' preparer=' || (public.notif_preparer(B, 'offres', 'cq-not04:' || o, 'offre', o::text, 'mais', 'x', 'Nouvelle offre : Maïs', '1 000 sacs à Yamoussoukro') ->> 'raison');
  -- NOT-05 : offre en pause
  o2 := pg_temp.offre(S, 100, 20000, 'nota2');
  update public.offres set pause_le = now() where id = o2;
  res := res || ' | NOT-05 offre en pause: ' || coalesce(public.notif_preparer(B, 'offres', 'cq-not05:' || o2, 'offre', o2::text) ->> 'raison', 'envoyer');
  -- NOT-06 : offre pour une demande retirée entre-temps
  insert into public.demandes (id, user_id, client_id, product_slug, product_label, region_slug, city, quantity, unit, budget, status)
    values (did, D, 'cq-not06-' || did, 'mais', 'Maïs', 'san-pedro', 'San-Pédro', 10, 'sac', 20000, 'active');
  o3 := pg_temp.offre(S, 101, 20000, 'nota3');
  insert into public.notif_file (user_id, cat, type, cle, regroupe, objet_id) values (D, 'offres', 'offre_pour_demande', 'cq-not06:' || o3, 'pour_demande:' || did, o3::text);
  update public.demandes set status = 'retiree' where id = did;
  l := public.notif_lots_prendre(300);
  res := res || ' | NOT-06 demande retirée: file=' || (select etat from public.notif_file where cle = 'cq-not06:' || o3);
  -- NOT-07 : accord sans commande, puis commande créée → le rappel ne part plus
  o2 := pg_temp.offre(S, 102, 20000, 'nota4');
  n := pg_temp.accord(S, B, o2, 20000, 5);
  res := res || ' | NOT-07 rappel accord sans commande: avant=' || coalesce(public.notif_preparer(B, 'commande', 'cq-not07a:' || n, 'accord_sans_commande', n::text) ->> 'raison', 'envoyer');
  c := pg_temp.cmd(S, B, n, false);
  res := res || ' après commande=' || coalesce(public.notif_preparer(B, 'commande', 'cq-not07b:' || n, 'accord_sans_commande', n::text) ->> 'raison', 'envoyer');
  -- NOT-08 : relance d'une proposition déjà acceptée
  res := res || ' | NOT-08 relance après accord: ' || coalesce(public.notif_preparer(B, 'negociation', 'cq-not08:' || n, 'relance_prix', n::text) ->> 'raison', 'envoyer');
  -- NOT-09 : même clé deux fois (double appel de la tâche)
  res := res || ' | NOT-09 clé en double: 1er=' || coalesce(public.notif_preparer(B, 'commande', 'cq-not09', 'creee', null) ->> 'raison', 'envoyer')
     || ' 2e=' || coalesce(public.notif_preparer(B, 'commande', 'cq-not09', 'creee', null) ->> 'raison', 'envoyer')
     || ' lignes=' || (select count(*) from public.notif_journal where cle = 'cq-not09');
  -- NOT-10 : un type non prévu (identifiant d'objet inexistant) passe toujours le contrôle « objet vivant »
  res := res || ' | NOT-10 type inconnu (« else true ») : ' || public._notif_objet_vivant('conseil', gen_random_uuid()::text, null);
  raise exception 'TEST OK: %', res;
end $$;
-- Résultat (25/10/2026) : NOT-01a aucune cible pour cette offre de test (0 ligne) ; ligne posée à la main pour la suite
-- | NOT-02 après vente de 990 sur 1 000 : offre active (10 sacs), objet « vivant », la ligne en attente annonce toujours « quantite=1000 »
-- | NOT-03 prix passé à 30 000 : la ligne annonce toujours 20 000 | NOT-04 offre épuisée : file « perime », notif_preparer « objet_perime »
-- | NOT-05 pause : objet_perime | NOT-06 demande retirée : perime | NOT-07 rappel d'accord : envoyé avant la commande, objet_perime après
-- | NOT-08 relance après accord : objet_perime | NOT-09 2e appel même clé : doublon | NOT-10 type non prévu : toujours « vivant ».
-- Texte réellement envoyé : supabase/functions/pousser/index.ts (cas « offre ») construit « 1 000 sacs · 20 000 F » à partir de donnees.

-- ══ Bloc NOT-B : fraude, compte supprimé, heures calmes, plafond ══
do $$
declare B uuid := '68345d7a-9d64-410a-a4c7-92a750d9888d'; Cm uuid := 'e0191bd5-e039-4948-9143-6a30cfdeaf6c'; D uuid := '86c69f98-e113-4bfb-bb2a-0bd32fba7830';
  res text := ''; j json; nid uuid; h int := extract(hour from now() at time zone 'UTC'); i int;
begin
  update public.notif_regles set calme_debut = 0, calme_fin = 0, ecart_min = 1 where id = 1;
  j := public.notif_preparer(D, 'commande', 'cq-notb-1', 'creee', null, null, 'x', 'Commande', 'Texte');
  nid := (j ->> 'nid')::uuid;
  -- NOT-11 : fraude par un membre connecté
  perform pg_temp.qui(B);
  res := 'NOT-11a appeler notif_preparer: ' || pg_temp.e(format('select public.notif_preparer(%L, %L, %L)', Cm, 'offres', 'cq-x'));
  res := res || ' | NOT-11b écrire dans la file: ' || pg_temp.e(format('insert into public.notif_file (user_id, cat, type, cle, regroupe) values (%L, %L, %L, %L, %L)', Cm, 'offres', 'offre', 'cq-x', 'cq-x'));
  res := res || ' | NOT-11c marquer « envoyée » la notification d''un autre: ' || pg_temp.e(format('select public.notif_resultat(%L, 1, 1)', nid));
  res := res || ' | NOT-11d marquer « ouverte » la notification d''un autre: ' || pg_temp.e(format('select public.notif_ouverte(%L, %L)', nid, 'clic'))
     || ' → ' || pg_temp.lire(format('select concat_ws(%L, resultat, ouvert_le::text) from public.notif_journal where nid = %L', ' ', nid));
  res := res || ' | NOT-11e lire le journal des autres: ' || pg_temp.e(format('select count(*) from public.notif_journal where user_id = %L', D))
     || ' lignes_visibles=' || (select count(*) from public.notif_journal where user_id = D);
  execute 'reset role';
  -- NOT-12 : compte supprimé : commercial ignoré, transactionnel ?
  update public.profils set supprime_le = now() where user_id = Cm;
  res := res || ' | NOT-12 compte supprimé: commercial=' || coalesce(public.notif_preparer(Cm, 'offres', 'cq-notb-12a') ->> 'raison', 'envoyer')
     || ' transactionnel=' || coalesce(public.notif_preparer(Cm, 'commande', 'cq-notb-12b') ->> 'raison', 'envoyer');
  -- NOT-13 : heures calmes : commercial retenu, commande envoyée
  update public.notif_regles set calme_debut = h, calme_fin = (h + 1) % 24 where id = 1;
  res := res || ' | NOT-13 heures calmes: commercial=' || coalesce(public.notif_preparer(D, 'offres', 'cq-notb-13a') ->> 'raison', 'envoyer')
     || ' commande=' || coalesce(public.notif_preparer(D, 'commande', 'cq-notb-13b') ->> 'raison', 'envoyer');
  -- NOT-14 : plafond de 8 commerciaux par jour (le temps qui passe est simulé en reculant les envois)
  update public.notif_regles set calme_debut = 0, calme_fin = 0, ecart_min = 1 where id = 1;
  for i in 1..10 loop
    j := public.notif_preparer(B, 'groupes', 'cq-notb-14-' || i);
    if (j ->> 'envoyer')::boolean then perform public.notif_resultat((j ->> 'nid')::uuid, 1, 1); end if;
    update public.notif_journal set cree_le = cree_le - interval '3 minutes' where user_id = B and cree_le > now() - interval '1 day';
    res := res || case when i = 1 then ' | NOT-14 plafond: ' else ',' end || coalesce(j ->> 'raison', 'ok');
  end loop;
  raise exception 'TEST OK: %', res;
end $$;
-- Résultat (25/10/2026) : NOT-11a/b/c refusés (permission denied) | 11d « ouverte » posée sur la notification d'un autre membre (nid connu) : ok
-- | 11e journal des autres : 0 ligne visible | NOT-12 compte supprimé : commercial ignoré, transactionnel « envoyer »
-- | NOT-13 heures calmes : commercial retenu, commande envoyée | NOT-14 8 envois puis plafond, plafond.
-- En attente : clés push réelles (envoi effectif, affichage, notification balayée) : le projet de test n'a pas les clés ; jamais mesurable côté serveur.
