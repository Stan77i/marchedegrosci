-- U14 Situations extrêmes : exercices joués sur le projet de TEST (yowdymdnoiubatxlwhfv). Rien ne reste : chaque bloc finit par raise exception.
-- Coller d'abord le contenu de _outils.sql (même dossier) dans la même requête. Résultats du 25/10/2026 : CONTROLE_QUALITE/rapports/annexes/2026-10-25-metier.md.

-- ══ Bloc EXT-A : même action répétée après une coupure réseau ; textes extrêmes ; cadence ══
do $$
declare S uuid := '1bfd5713-2525-44a6-8403-084ebb9ddad3'; B uuid := '68345d7a-9d64-410a-a4c7-92a750d9888d'; D uuid := '86c69f98-e113-4bfb-bb2a-0bd32fba7830';
  o uuid; n uuid; c uuid; dsc uuid; res text := ''; j1 json; j2 json; tot numeric; i int; r text;
begin
  perform pg_temp.verif(S);
  -- EXT-01 : message privé envoyé deux fois avec le même identifiant (réseau coupé avant la réponse)
  perform pg_temp.qui(B);
  dsc := public.dm_ouvrir(D);
  j1 := public.dm_envoyer(dsc, 'Bonjour, vous avez du maïs ?', 'cq-ext01-a');
  j2 := public.dm_envoyer(dsc, 'Bonjour, vous avez du maïs ?', 'cq-ext01-a');
  res := 'EXT-01a même identifiant: même message=' || ((j1 ->> 'id') = (j2 ->> 'id')) || ' deja=' || coalesce(j2 ->> 'deja', 'false')
     || ' lignes=' || pg_temp.lire(format('select count(*)::text from public.dm where discussion_id = %L and client_id like %L', dsc, 'cq-ext01-a%'));
  perform public.dm_envoyer(dsc, 'Sans identifiant', null);
  perform public.dm_envoyer(dsc, 'Sans identifiant', null);
  res := res || ' | EXT-01b sans identifiant (ancienne application): lignes=' || pg_temp.lire(format('select count(*)::text from public.dm where discussion_id = %L and texte = %L', dsc, 'Sans identifiant'));
  res := res || ' | EXT-01c identifiant invalide: ' || pg_temp.e(format('select public.dm_envoyer(%L, %L, %L)', dsc, 'x', 'a b;x'));
  -- EXT-02 : message de négociation envoyé deux fois (pas d'identifiant côté serveur)
  execute 'reset role';
  o := pg_temp.offre(S, 100, 20000, 'exta');
  perform pg_temp.qui(B); n := public.nego_ouvrir('offre', o, 19000, 10, null);
  perform public.nego_agir(n, 'texte', null, null, 'Je passe demain', null);
  perform public.nego_agir(n, 'texte', null, null, 'Je passe demain', null);
  res := res || ' | EXT-02 texte de négociation répété: lignes=' || pg_temp.lire(format('select count(*)::text from public.messages where negociation_id = %L and texte = %L', n, 'Je passe demain'));
  -- EXT-03 : textes extrêmes
  res := res || ' | EXT-03a 501 caractères: ' || pg_temp.e(format('select public.nego_agir(%L, %L, null, null, %L, null)', n, 'texte', repeat('a', 501)));
  res := res || ' | EXT-03b 2 001 caractères en privé: ' || pg_temp.e(format('select public.dm_envoyer(%L, %L, null)', dsc, repeat('a', 2001)));
  res := res || ' | EXT-03c texte « SQL »: ' || pg_temp.e(format('select public.nego_agir(%L, %L, null, null, %L, null)', n, 'texte', 'x''); update offres set price = 1; --'))
     || ' prix offre=' || pg_temp.lire(format('select price::text from public.offres where id = %L', o));
  res := res || ' | EXT-03d émojis et accents: ' || pg_temp.e(format('select public.nego_agir(%L, %L, null, null, %L, null)', n, 'texte', 'Maïs 🌽 très bon — prix ok ?'));
  res := res || ' | EXT-03e caractère nul: ' || pg_temp.e(format('select public.nego_agir(%L, %L, null, null, %L || chr(1) || %L, null)', n, 'texte', 'a', 'b'));
  res := res || ' | EXT-03f message vide: ' || pg_temp.e(format('select public.nego_agir(%L, %L, null, null, %L, null)', n, 'texte', '   '));
  -- EXT-05 : lieu de livraison trop long, puis dépôt d'argent répété avec une 2e référence
  execute 'reset role';
  n := pg_temp.accord(S, B, o, 20000, 5);
  perform pg_temp.qui(B);
  res := res || ' | EXT-05a lieu 121 caractères: ' || pg_temp.e(format('select public.commande_creer2(%L, %L, %L, %L, null)', n, 'vendeur', repeat('L', 121), 'Daloa'));
  c := public.commande_creer2(n, 'vendeur', null, 'Daloa', null);
  perform pg_temp.qui(S); perform public.commande_repondre(c, true, null);
  execute 'reset role';
  tot := (public._seq_repartition(c) ->> 'total')::numeric;
  -- appels séparés : dans une même expression, les sous-requêtes lisent l'état d'avant l'appel
  r := public.sequestre_depot_confirme(c, 'orange', 'cq-ext-A', tot);
  res := res || ' | EXT-05b dépôt (service) réf. A: ' || r;
  r := public.sequestre_depot_confirme(c, 'orange', 'cq-ext-B', tot);
  res := res || ' puis réf. B (2e paiement reçu ?): ' || r
     || ' séquestres=' || (select count(*) || ' réf=' || string_agg(reference, ',') from public.sequestres where commande_id = c)
     || ' trace réf. B=' || (select count(*) from public.sequestre_journal where commande_id = c and coalesce(note, '') like '%cq-ext-B%');
  -- EXT-04 : cadence : 25 messages en une minute (en dernier : la limite bloque ensuite tout l'acheteur)
  n := pg_temp.lire(format('select id::text from public.negociations where cible_id = %L and auteur_id = %L order by created_at limit 1', o, B))::uuid;
  perform pg_temp.qui(B);
  r := '';
  for i in 1..25 loop
    r := pg_temp.e(format('select public.nego_agir(%L, %L, null, null, %L, null)', n, 'texte', 'm' || i));
    if r <> 'ok' then res := res || ' | EXT-04 cadence: refus au message ' || i || ' : ' || r; exit; end if;
  end loop;
  res := res || ' | EXT-04b une proposition de prix juste après: ' || pg_temp.e(format('select public.nego_ouvrir(%L, %L, 19000, 1, null)', 'offre', o));
  raise exception 'TEST OK: %', res;
end $$;
-- Résultat (25/10/2026) : EXT-01a même identifiant → même message, deja=true, 1 ligne | 01b sans identifiant → 2 lignes | 01c identifiant invalide refusé
-- | EXT-02 texte de négociation répété → 2 lignes (aucun identifiant côté serveur) | 03a/03b trop long refusés | 03c texte « SQL » stocké tel quel, prix intact
-- | 03d émojis ok | 03e caractère de contrôle chr(1) accepté | 03f vide refusé | EXT-05a lieu 121 car. refusé
-- | EXT-05b 2e dépôt avec une AUTRE référence → « bloque », 1 seul séquestre (réf. A), aucune trace de la réf. B (bloc rejoué seul, appels séparés)
-- | EXT-04 cadence : refus au 14e message de la boucle (20 par minute, tous messages confondus) ; une proposition de prix juste après est aussi refusée.

-- ══ Bloc EXT-B : compte banni ou supprimé en pleine commande ; enchaînement interrompu ; mot secret après passage au livreur du vendeur ══
do $$
declare S uuid := '1bfd5713-2525-44a6-8403-084ebb9ddad3'; B uuid := '68345d7a-9d64-410a-a4c7-92a750d9888d';
  ADM uuid := '981961d4-25ba-4e1b-a732-8fd68cd6c922'; CHF uuid := 'f8e1b009-e7c7-4637-b685-c05155f06be9'; TRP uuid := 'd9b2a5a8-5949-48b3-a328-e8d642c3db5d';
  o uuid; n uuid; c uuid; c2 uuid; m uuid; res text := ''; p text[];
begin
  perform pg_temp.verif(S);
  o := pg_temp.offre(S, 1000, 20000, 'extb');
  -- EXT-06 : vendeur banni après confirmation
  n := pg_temp.accord(S, B, o, 20000, 10);
  c := pg_temp.cmd(S, B, n, true);
  begin insert into public.bannis (user_id, motif) values (S, 'autre'); exception when others then res := 'EXT-06 bannir: ' || sqlerrm; end;
  perform pg_temp.qui(S);
  res := res || 'EXT-06a vendeur banni charge: ' || pg_temp.e(format('select public.commande_avancer(%L, %L, null, null, null, null)', c, 'preparation'));
  perform pg_temp.qui(B);
  res := res || ' | EXT-06b acheteur annule tout de suite: ' || pg_temp.e(format('select public.commande_annuler_retard(%L, %L)', c, 'vendeur banni'));
  res := res || ' | EXT-06c acheteur signale: ' || pg_temp.e(format('select public.commande_litige(%L, %L)', c, 'Le vendeur a été banni')) || ' ' || pg_temp.cs(c);
  execute 'reset role';
  -- EXT-07 : compte supprimé pendant une commande : lecture des garde-fous dans le code des fonctions
  res := res || ' | EXT-07 garde-fous « compte supprimé » dans commande_avancer / commande_reception_mot / commande_liberer: '
     || (select string_agg(p.proname || '=' || (pg_get_functiondef(p.oid) like '%supprime_le%'), ', ') from pg_proc p join pg_namespace s on s.oid = p.pronamespace
         where s.nspname = 'public' and p.proname in ('commande_avancer', 'commande_reception_mot', 'commande_liberer', 'commande_repondre', 'nego_agir'));
  raise exception 'TEST OK: %', res;
end $$;

-- Résultat (25/10/2026) : EXT-06a vendeur banni : COMPTE_BANNI | 06b l'acheteur ne peut pas annuler avant 72 h (TROP_TOT) alors que le vendeur ne pourra
-- plus jamais charger | 06c « Signaler un problème » ok → litige (seule sortie) | EXT-07 aucune des 5 fonctions de commande ne vérifie un compte supprimé (lecture du code).

-- ══ Bloc EXT-C : enchaînement interrompu (preuves envoyées, papier refusé) ; mot secret après le refus du transporteur ══
do $$
declare S uuid := '1bfd5713-2525-44a6-8403-084ebb9ddad3'; B uuid := '68345d7a-9d64-410a-a4c7-92a750d9888d';
  ADM uuid := '981961d4-25ba-4e1b-a732-8fd68cd6c922'; CHF uuid := 'f8e1b009-e7c7-4637-b685-c05155f06be9'; TRP uuid := 'd9b2a5a8-5949-48b3-a328-e8d642c3db5d';
  o uuid; n uuid; c uuid; m uuid; res text := ''; p text[];
begin
  perform pg_temp.verif(S);
  o := pg_temp.offre(S, 1000, 20000, 'extc');
  n := pg_temp.accord(S, B, o, 20000, 10);
  c := pg_temp.cmd(S, B, n, true);
  p := array[S || '/cq/' || c || '-1.jpg', S || '/cq/' || c || '-2.jpg', S || '/motpapier-cq-' || c || '.jpg'];
  perform pg_temp.qui(S); perform public.commande_depart_defi(c);
  execute 'reset role';
  insert into storage.objects (bucket_id, name, owner, created_at) values ('preuves', p[1], S, now() + interval '1 second'), ('preuves', p[2], S, now() + interval '1 second');
  perform pg_temp.qui(S);
  perform public.commande_depart_preuves(c, array[p[1], p[2]], 2500);
  res := 'EXT-08a photo du papier absente (envoi coupé): ' || pg_temp.e(format('select public.commande_depart_mot(%L, %L)', c, p[3]));
  res := res || ' | EXT-08b chargement: ' || pg_temp.e(format('select public.commande_avancer(%L, %L, null, null, null, null)', c, 'chargement')) || ' ' || pg_temp.cs(c);
  execute 'reset role';
  insert into storage.objects (bucket_id, name, owner, created_at) values ('preuves', p[3], S, now() + interval '1 second');
  perform pg_temp.qui(S);
  res := res || ' | EXT-08c reprise: papier ' || pg_temp.e(format('select public.commande_depart_mot(%L, %L)', c, p[3]))
     || ' chargement ' || pg_temp.e(format('select public.commande_avancer(%L, %L, null, null, null, null)', c, 'chargement')) || ' ' || pg_temp.cs(c);
  -- EXT-09 : commande réseau, prix du transport refusé → livreur du vendeur : y a-t-il un mot secret ?
  execute 'reset role';
  update public.reglages set valeur = 'true'::jsonb where cle = 'transport_reseau_ouvert';
  n := pg_temp.accord(S, B, o, 20000, 10);
  perform pg_temp.qui(B); c := public.commande_creer2(n, 'reseau', null, 'Daloa', null);
  res := res || ' | EXT-09a commande réseau: mot_secret=' || pg_temp.lire(format('select (mot_secret is not null)::text from public.commandes where id = %L', c));
  perform pg_temp.qui(S); perform public.commande_repondre(c, true, null);
  perform pg_temp.qui(ADM); perform public.admin_affecter(c, TRP);
  m := pg_temp.lire(format('select id::text from public.transport_missions where commande_id = %L and statut = %L', c, 'proposee'))::uuid;
  perform pg_temp.qui(CHF); perform public.transport_agir(m, 'prix', 40000, null);
  perform pg_temp.qui(B); perform public.transport_agir(m, 'refus', null, null);
  res := res || ' | EXT-09b après refus: ' || pg_temp.lire(format('select concat_ws(%L, mode_transport, validation, %L || (mot_secret is not null)) from public.commandes where id = %L', ' ', 'mot=', c));
  raise exception 'TEST OK: %', res;
end $$;
-- Résultat (25/10/2026) : EXT-08a papier absent refusé | 08b chargement refusé (DEPART_PREUVES), commande inchangée | 08c reprise : papier ok, chargement ok
-- | EXT-09a commande réseau : pas de mot secret (validation par codes) | 09b après refus du prix : livreur du vendeur, déclaration, mot secret créé.
-- En attente : deux connexions simultanées (EXT-10 : deux appareils du même membre ; EXT-11 : coupure réseau réelle pendant l'envoi d'une photo).
-- Non exécuté : EXT-12 limite de 40 négociations par jour (demande 41 annonces distinctes d'autres vendeurs ; à faire avec un jeu de données dédié).
