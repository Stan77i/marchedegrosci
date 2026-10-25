-- Scénarios des schémas 101a à 101e (décisions juridiques n° 21, 14, 16, 22).
-- Projet de TEST seulement (yowdymdnoiubatxlwhfv). Le bloc finit par raise exception 'TEST: …' : rien ne reste en base.
-- S = vendeur, B, C = acheteurs, D = membre dont le numéro est « contesté », ADM = administrateur (comptes de simulation du test).
-- Le scénario J4 marche avant et après le collage de schema-101e : avant, le passage note « en_attente » et n'efface rien ;
-- après, il efface les vieilles lignes synthétiques et garde les récentes.

create or replace function pg_temp.qui(u uuid) returns void language plpgsql as $f$
begin perform set_config('request.jwt.claims', json_build_object('sub', u, 'role', 'authenticated')::text, true); execute 'set local role authenticated'; end $f$;
create or replace function pg_temp.anon() returns void language plpgsql as $f$
begin perform set_config('request.jwt.claims', '{"role":"anon"}', true); execute 'set local role anon'; end $f$;
create or replace function pg_temp.groupe(S uuid, B uuid, C uuid, tr text, frais numeric, zone text) returns text language plpgsql as $f$
declare o uuid := gen_random_uuid(); g uuid := gen_random_uuid(); r text;
begin
  execute 'reset role';
  insert into public.offres (id, user_id, client_id, product_slug, product_label, region_slug, city, quantity, unit, price, status, transport)
    values (o, S, 'j101-' || o, 'mais', 'Maïs', 'yamoussoukro', 'Yamoussoukro', 500, 'sac', 20000, 'active', tr);
  insert into public.groupes_achat (id, offre_id, vendeur_id, createur_id, produit, unite, zone, region_slug, objectif, min_participants,
      date_limite, prix_base, paliers, frais_transport, statut, confirmer_avant)
    values (g, o, S, B, 'Maïs', 'sac', zone, 'yamoussoukro', 100, 2, now() + interval '2 days', 20000, '[]'::jsonb, frais,
      'en_attente_confirmation', now() + interval '1 day');
  insert into public.groupe_participants (groupe_id, user_id, quantite, prix_vu, statut, confirme_le)
    values (g, B, 60, 20000, 'confirme', now()), (g, C, 40, 20000, 'confirme', now());
  r := public._groupe_evaluer(g);
  return r || ' → ' || (select string_agg(concat_ws('/', p.quantite::int, c.mode_transport, coalesce(c.transport_regle, 'null'), coalesce(c.prix_transport::text, '-'),
      coalesce(c.total_convenu::text, '-'), 'meme=' || coalesce(c.meme_ville::text, 'null')), ' ; ' order by p.quantite desc)
    from public.groupe_participants p join public.commandes c on c.id = p.commande_id where p.groupe_id = g);
end $f$;

do $$
declare S uuid := '1bfd5713-2525-44a6-8403-084ebb9ddad3'; B uuid := '68345d7a-9d64-410a-a4c7-92a750d9888d';
  C uuid := 'efec4ce4-7ab1-4b93-9e90-020bd0007a8c'; D uuid := 'd56f75b3-463d-484d-9e19-4af3fd3eb8d8';
  ADM uuid := '981961d4-25ba-4e1b-a732-8fd68cd6c922';
  res text := ''; U uuid; pa json; pm json; tel text; j json; x text;
  n_vieux bigint; n_neuf bigint; s_vieux uuid; s_neuf uuid; sg_vieux uuid; c_vieux uuid; c_photo uuid; c_neuf uuid; ng_vieux uuid; ph text;
  avant jsonb; apres jsonb; pas jsonb; efface boolean := to_regprocedure('public._conservation_effacer()') is not null;
begin
  -- ══ J1 (n° 21) : profil public, totaux sans compte, détail pour un membre connecté ══
  select x2.u into U from (select g.proprio_id u from public.negociations g where g.statut = 'conclue' group by 1 order by count(*) desc limit 1) x2;
  perform pg_temp.anon(); pa := public.profil_public(U); execute 'reset role';
  perform pg_temp.qui(B); pm := public.profil_public(U); execute 'reset role';
  res := concat(res, 'J1 anon: detail=', pa ->> 'detail', ' ventes=', pa ->> 'ventes', ' transactions=', pa ->> 'transactions',
    ' historique=', coalesce(pa ->> 'historique', 'null'), ' volumes=', coalesce(pa ->> 'volumes', 'null'), ' lieux=', coalesce(pa ->> 'lieux', 'null'), ' vu_le=', coalesce(pa ->> 'vu_le', 'null'),
    ' | membre: detail=', pm ->> 'detail', ' ventes=', pm ->> 'ventes', ' historique=', json_array_length(pm -> 'historique'), ' lignes, volumes=', json_array_length(pm -> 'volumes'), ' lieux=', json_array_length(pm -> 'lieux'));

  -- ══ J2 (n° 14) : achat groupé, le transport suit l'offre (quantités 60 et 40, frais 30 000 F pour le groupe) ══
  insert into public.verifications (user_id, statut, piece, defi, decide_le, expire_le, numero) values (S, 'verifie', 'cni', '1234', now(), current_date + 365, 'J101-S');
  res := concat(res, ' || J2 inclus: ', pg_temp.groupe(S, B, C, 'inclus', 30000, 'Daloa'));
  res := concat(res, ' | non+frais: ', pg_temp.groupe(S, B, C, 'non', 30000, 'Daloa'));
  res := concat(res, ' | non sans frais: ', pg_temp.groupe(S, B, C, 'non', null, 'Daloa'));
  res := concat(res, ' | hors_ville même ville: ', pg_temp.groupe(S, B, C, 'hors_ville', null, 'Yamoussoukro'));
  res := concat(res, ' | hors_ville autre ville: ', pg_temp.groupe(S, B, C, 'hors_ville', null, 'Daloa'));
  res := concat(res, ' | sans transport écrit: ', pg_temp.groupe(S, B, C, null, null, 'Daloa'));

  -- ══ J3 (n° 16) : numéro contesté, deux cases obligatoires, notées au journal ══
  select substr(split_part(email, '@', 1), 4) into tel from auth.users where id = D;
  perform pg_temp.qui(ADM);
  begin perform public.admin_numero_rendre(tel, 'Pièce vue au bureau, appel passé : le numéro est à lui.'); x := 'accepté (FAUX)';
  exception when others then x := 'refusé: ' || sqlerrm; end;
  res := concat(res, ' || J3 ancien appel: ', x);
  begin perform public.admin_numero_rendre(tel, 'Pièce vue au bureau, appel passé : le numéro est à lui.', true, false); x := 'accepté (FAUX)';
  exception when others then x := 'refusé: ' || sqlerrm; end;
  res := concat(res, ' | sans appel: ', x);
  j := public.admin_numero_rendre(tel, 'Pièce vue au bureau, appel passé : le numéro est à lui.', true, true);
  execute 'reset role';
  res := concat(res, ' | deux cases: libre=', j ->> 'libre', ' journal=', (select detail::text from public.admin_journal where action = 'numero_rendu' and cible_id = D order by at desc limit 1));
  perform pg_temp.qui(B);
  begin perform public.admin_numero_rendre(tel, 'Pièce vue au bureau, appel passé : le numéro est à lui.', true, true); x := 'accepté (FAUX)';
  exception when others then x := 'refusé: ' || sqlerrm; end;
  execute 'reset role';
  res := concat(res, ' | membre: ', x);

  -- ══ J4 (n° 22) : conservation, vieilles lignes synthétiques contre lignes récentes ══
  avant := public._conservation_compte();
  insert into public.notif_journal (user_id, cat, nature, type, cle, titre, corps, cree_le, resultat) values (B, 'commande', 'trans', 'j101', 'j101-vieux', 'Vieux', 'Vieux', now() - interval '91 days', 'ok') returning id into n_vieux;
  insert into public.notif_journal (user_id, cat, nature, type, cle, titre, corps, cree_le, resultat) values (B, 'commande', 'trans', 'j101', 'j101-neuf', 'Neuf', 'Neuf', now() - interval '89 days', 'ok') returning id into n_neuf;
  insert into public.sanctions (user_id, type, debut, fin, motif, par) values (B, 'avertissement', now() - interval '3 years', now() - interval '3 years' + interval '7 days', 'j101 vieux', ADM) returning id into s_vieux;
  insert into public.sanctions (user_id, type, debut, fin, motif, par) values (B, 'avertissement', now() - interval '1 year', now() - interval '1 year' + interval '7 days', 'j101 neuf', ADM) returning id into s_neuf;
  insert into public.signalements (user_id, cible, cible_id, motif, traite, traite_le, created_at) values (B, 'offre', gen_random_uuid(), 'j101', true, now() - interval '25 months', now() - interval '25 months') returning id into sg_vieux;
  update public.signalements set traite = true, traite_le = now() - interval '25 months', created_at = now() - interval '25 months' where id = sg_vieux;
  insert into public.commandes (numero, vendeur_id, acheteur_id, cree_par, produit, quantite, unite, prix_unitaire, montant, ville_depart, lieu_livraison,
      commission_montant, mode_transport, validation, etat, etape, created_at, termine_le)
    values ('J101-V', S, B, B, 'Maïs', 10, 'sac', 20000, 200000, 'Yamoussoukro', 'Daloa', 7000, 'vendeur', 'declaration', 'terminee', 'terminee', now() - interval '6 years', now() - interval '6 years')
    returning id into c_vieux;
  ph := S || '/j101-' || replace(gen_random_uuid()::text, '-', '') || '.jpg';
  insert into storage.objects (bucket_id, name, owner) values ('preuves', ph, S);
  insert into public.commandes (numero, vendeur_id, acheteur_id, cree_par, produit, quantite, unite, prix_unitaire, montant, ville_depart, lieu_livraison,
      commission_montant, mode_transport, validation, etat, etape, created_at, termine_le, depart_photos)
    values ('J101-P', S, B, B, 'Maïs', 10, 'sac', 20000, 200000, 'Yamoussoukro', 'Daloa', 7000, 'vendeur', 'declaration', 'terminee', 'terminee', now() - interval '6 years', now() - interval '6 years', array[ph])
    returning id into c_photo;
  insert into public.commandes (numero, vendeur_id, acheteur_id, cree_par, produit, quantite, unite, prix_unitaire, montant, ville_depart, lieu_livraison,
      commission_montant, mode_transport, validation, etat, etape, created_at, termine_le)
    values ('J101-N', S, B, B, 'Maïs', 10, 'sac', 20000, 200000, 'Yamoussoukro', 'Daloa', 7000, 'vendeur', 'declaration', 'terminee', 'terminee', now() - interval '4 years', now() - interval '4 years')
    returning id into c_neuf;
  insert into public.negociations (cible, cible_id, auteur_id, proprio_id, produit, statut, created_at, updated_at)
    values ('offre', gen_random_uuid(), B, S, 'Maïs', 'conclue', now() - interval '6 years', now() - interval '6 years') returning id into ng_vieux;
  res := concat(res, ' || J4 dates: cmd vieille termine_le=', (select termine_le::date from public.commandes where id = c_vieux),
    ' nego updated_at=', (select updated_at::date from public.negociations where id = ng_vieux));
  apres := public._conservation_compte();
  res := concat(res, ' | compte avant=', avant::text, ' après insertion=', apres::text,
    ' photo listée=', public.preuve_purgeable(ph), ' cmd avec photo retenue=', not exists (select 1 from public._cons_commandes() i where i = c_photo));
  perform pg_temp.qui(B);
  begin perform public.conservation_compter(); x := 'accepté (FAUX)'; exception when others then x := 'refusé: ' || sqlerrm; end;
  res := concat(res, ' | membre compter: ', x);
  begin perform public.admin_preuves_a_effacer(); x := 'accepté (FAUX)'; exception when others then x := 'refusé: ' || sqlerrm; end;
  res := concat(res, ' | membre liste photos: ', x);
  begin perform 1 from public.conservation_journal; x := 'lignes vues=' || (select count(*) from public.conservation_journal); exception when others then x := 'refusé: ' || sqlerrm; end;
  res := concat(res, ' | membre journal: ', x);
  execute 'reset role';
  pas := public.conservation_passage();
  res := concat(res, ' | effacement installé=', efface, ' passage=', pas::text,
    ' journal=', (select etat || ' total=' || total from public.conservation_journal order by id desc limit 1),
    ' restent: notif vieux=', exists (select 1 from public.notif_journal where id = n_vieux), ' neuf=', exists (select 1 from public.notif_journal where id = n_neuf),
    ' sanction vieille=', exists (select 1 from public.sanctions where id = s_vieux), ' récente=', exists (select 1 from public.sanctions where id = s_neuf),
    ' signalement vieux=', exists (select 1 from public.signalements where id = sg_vieux),
    ' cmd 6 ans=', exists (select 1 from public.commandes where id = c_vieux), ' cmd 6 ans avec photo=', exists (select 1 from public.commandes where id = c_photo),
    ' cmd 4 ans=', exists (select 1 from public.commandes where id = c_neuf), ' nego 6 ans=', exists (select 1 from public.negociations where id = ng_vieux),
    ' cron=', (select schedule || ' actif=' || active from cron.job where jobname = 'mdg-conservation'));

  raise exception 'TEST: %', res;
end $$;
