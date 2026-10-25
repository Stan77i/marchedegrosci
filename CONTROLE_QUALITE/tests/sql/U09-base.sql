-- U09 Base de données : exercices SQL reproductibles (système de contrôle MGCI, 25/10/2026).
-- Projet de TEST seulement (yowdymdnoiubatxlwhfv). Le projet de test contient des DONNÉES DE SIMULATION (100 comptes, ~100 000 offres de test de charge) :
-- les comptages de BDD-04 portent sur ces données, pas sur la production.
-- Les blocs « do » finissent par raise exception 'TEST OK: …' ou 'TEST ECHEC: …' (tout est annulé). Les « select » sont en lecture seule.
-- Résultat obtenu le 25/10/2026 sous chaque bloc ; tableau complet et anomalies : CONTROLE_QUALITE/rapports/2026-10-25-controle-general.md (annexe : rapports/annexes/2026-10-25-securite.md).

create or replace function pg_temp.e(q text) returns text language plpgsql as $f$
begin execute q; return 'ok'; exception when others then return 'ERR ' || left(sqlerrm, 90); end $f$;
create or replace function pg_temp.qui(u uuid) returns void language plpgsql as $f$
begin perform set_config('request.jwt.claims', json_build_object('sub', u, 'role', 'authenticated')::text, true); execute 'set local role authenticated'; end $f$;
create or replace function pg_temp.anon() returns void language plpgsql as $f$
begin perform set_config('request.jwt.claims', json_build_object('role', 'anon')::text, true); execute 'set local role anon'; end $f$;
create or replace function pg_temp.lire(q text) returns text language plpgsql as $f$
declare prev text := current_user; v text;
begin execute 'reset role'; execute q into v; if prev <> current_user then execute format('set local role %I', prev); end if; return coalesce(v, 'NULL'); end $f$;
create or replace function pg_temp.v(q text) returns text language plpgsql as $f$
declare v text; begin execute q into v; return coalesce(v, 'NULL'); exception when others then return 'ERR ' || left(sqlerrm, 90); end $f$;
create or replace function pg_temp.en(u uuid, q text) returns text language plpgsql as $f$
begin perform pg_temp.qui(u); execute q; execute 'reset role'; return 'ok'; exception when others then return 'ERR ' || left(sqlerrm, 90); end $f$;

-- BDD-01 (statique, lecture seule) : colonnes d'identifiant sans clé étrangère
with fkcols as (
  select c.conrelid::regclass::text t, a.attname col from pg_constraint c join pg_attribute a on a.attrelid = c.conrelid and a.attnum = any(c.conkey) where c.contype = 'f' and c.connamespace = 'public'::regnamespace)
select cl.table_name, string_agg(cl.column_name, ', ' order by cl.column_name) sans_fk
from information_schema.columns cl
where cl.table_schema = 'public' and cl.data_type = 'uuid' and cl.column_name ~ '(_id|^par$|_par$|^auteur|^cible|^proprio)' and cl.column_name <> 'id'
  and not exists (select 1 from fkcols f where f.t in (cl.table_name, 'public.' || cl.table_name) and f.col = cl.column_name)
  and cl.table_name in (select relname from pg_class where relkind = 'r' and relnamespace = 'public'::regnamespace)
group by 1 order by 1;
-- Résultat (25/10/2026) : 41 tables ; sur les tables critiques : annulations (commande_id, vendeur_id, acheteur_id, imputable_id…), commande_alertes.commande_id,
-- groupe_participants.commande_id, stock_mouvements.negociation_id, sanctions.user_id, niveaux_membres.user_id, commissions (vendeur_id, acheteur_id),
-- avis_commandes (auteur_id, cible_id), commandes (cree_par, annulation_par, litige_par, livre_par), negociations.cible_id (cible offre ou demande : clé impossible telle quelle).

-- BDD-02 (limite + erreur) : valeurs impossibles écrites directement dans les tables (ce que la base laisse passer si une fonction se trompe)
do $$
declare S uuid := '1bfd5713-2525-44a6-8403-084ebb9ddad3'; B uuid := '68345d7a-9d64-410a-a4c7-92a750d9888d';
  r text := ''; bad boolean := false; v text; q text; attendu text; i int; acceptes text := ''; n uuid; c uuid;
  ins_c text := 'insert into public.commandes (numero, vendeur_id, acheteur_id, cree_par, produit, quantite, unite, prix_unitaire, montant, mode_transport, etat, etape) values (%L, %L, %L, %L, %L, %s, %L, %s, %s, %L, %L, %L)';
  cas text[][];
begin
  insert into public.verifications (user_id, statut, piece, defi, decide_le, expire_le, numero) values (S, 'verifie', 'cni', '1234', now(), current_date + 365, 'CQ-BDD2');
  select id into n from public.negociations limit 1;
  select id into c from public.commandes limit 1;
  cas := array[
    array['commande quantité -5', format(ins_c, 'CQ-B1', S, B, B, 'mais', '-5', 'sac', '1000', '-5000', 'vendeur', 'en_cours', 'confirmee')],
    array['commande quantité 0', format(ins_c, 'CQ-B2', S, B, B, 'mais', '0', 'sac', '1000', '0', 'vendeur', 'en_cours', 'confirmee')],
    array['commande prix 0', format(ins_c, 'CQ-B3', S, B, B, 'mais', '10', 'sac', '0', '0', 'vendeur', 'en_cours', 'confirmee')],
    array['commande montant négatif', format(ins_c, 'CQ-B4', S, B, B, 'mais', '10', 'sac', '1000', '-1', 'vendeur', 'en_cours', 'confirmee')],
    array['commande montant ≠ quantité × prix', format(ins_c, 'CQ-B5', S, B, B, 'mais', '10', 'sac', '1000', '999999', 'vendeur', 'en_cours', 'confirmee')],
    array['commande vendeur = acheteur', format(ins_c, 'CQ-B6', S, S, S, 'mais', '10', 'sac', '1000', '10000', 'vendeur', 'en_cours', 'confirmee')],
    array['commande état inconnu', format(ins_c, 'CQ-B7', S, B, B, 'mais', '10', 'sac', '1000', '10000', 'vendeur', 'payee', 'confirmee')],
    array['commande étape inconnue', format(ins_c, 'CQ-B8', S, B, B, 'mais', '10', 'sac', '1000', '10000', 'vendeur', 'en_cours', 'volee')],
    array['commande terminée sans date de fin', format(ins_c, 'CQ-B9', S, B, B, 'mais', '10', 'sac', '1000', '10000', 'vendeur', 'terminee', 'terminee')],
    array['commande quantité sans unité', format(ins_c, 'CQ-B10', S, B, B, 'mais', '10', '', '1000', '10000', 'vendeur', 'en_cours', 'confirmee')],
    array['offre quantité -1', format('insert into public.offres (user_id, client_id, product_slug, product_label, region_slug, city, quantity, unit, price, status) values (%L, %L, %L, %L, %L, %L, -1, %L, 1000, %L)', S, 'cq-b11', 'mais', 'Maïs', 'yamoussoukro', 'Yamoussoukro', 'sac', 'active')],
    array['offre prix 0 (prix ferme)', format('insert into public.offres (user_id, client_id, product_slug, product_label, region_slug, city, quantity, unit, price, status, negociable) values (%L, %L, %L, %L, %L, %L, 5, %L, 0, %L, false)', S, 'cq-b12', 'mais', 'Maïs', 'yamoussoukro', 'Yamoussoukro', 'sac', 'active')],
    array['offre statut inconnu', format('insert into public.offres (user_id, client_id, product_slug, product_label, region_slug, city, quantity, unit, price, status) values (%L, %L, %L, %L, %L, %L, 5, %L, 1000, %L)', S, 'cq-b13', 'mais', 'Maïs', 'yamoussoukro', 'Yamoussoukro', 'sac', 'vendue')],
    array['négociation statut inconnu', format('update public.negociations set statut = %L where id = %L', 'gagnee', n)],
    array['avis note 6', format('insert into public.avis_commandes (commande_id, auteur_id, cible_id, role_cible, note) values (%L, %L, %L, %L, 6)', c, B, S, 'vendeur')],
    array['commission taux 5 %', format('update public.commissions set taux = 0.05 where commande_id = %L', c)],
    array['commission encaissée', format('update public.commissions set encaissement = %L where commande_id = %L', 'encaisse', c)],
    array['stock rendu > pris', format('update public.stock_mouvements set rendu = pris + 1 where negociation_id = (select negociation_id from public.stock_mouvements limit 1)')],
    array['mission prix négatif', format('update public.transport_missions set prix = -1 where id = (select id from public.transport_missions limit 1)')],
    array['groupe objectif 0', format('update public.groupes_achat set objectif = 0 where id = (select id from public.groupes_achat limit 1)')],
    array['discussion avec soi-même', format('insert into public.discussions (a_id, b_id) values (%L, %L)', S, S)],
    array['message de négociation prix 0', format('insert into public.messages (negociation_id, auteur_id, genre, prix) values (%L, %L, %L, 0)', n, S, 'prix')]
  ];
  for i in 1 .. array_length(cas, 1) loop
    v := pg_temp.e(cas[i][2]);
    if v = 'ok' then acceptes := acceptes || cas[i][1] || ' ; '; else r := r || i || ':refus ' || left(v, 30) || ' | '; end if;
  end loop;
  r := r || ' || ACCEPTÉS par la base : ' || coalesce(nullif(acceptes, ''), 'aucun');
  if acceptes <> '' then bad := true; end if;
  raise exception '%: %', case when bad then 'TEST ECHEC' else 'TEST OK' end, r;
end $$;
-- Résultat (25/10/2026) : TEST ECHEC : 13/22 refusées ; acceptées par commandes : quantité -5 et 0, prix 0, montant négatif, montant ≠ quantité × prix, vendeur = acheteur,
-- terminée sans termine_le, unité vide ; offre « prix ferme 0 » acceptée hors application (contrôle réservé au membre connecté).

-- BDD-03 (normal) : ordre des déclencheurs et effet combiné sur une annonce trafiquée et sur une commande
do $$
declare S uuid := '1bfd5713-2525-44a6-8403-084ebb9ddad3'; B uuid := '68345d7a-9d64-410a-a4c7-92a750d9888d';
  r text := ''; bad boolean := false; v text; o uuid := gen_random_uuid(); c uuid; ordre text;
begin
  -- ordre réel des déclencheurs « avant » (PostgreSQL les joue par ordre alphabétique du nom)
  select string_agg(t.tgname, ' > ' order by t.tgname) into ordre from pg_trigger t where t.tgrelid = 'public.offres'::regclass and not t.tgisinternal and t.tgtype & 2 = 2;
  r := r || 'offres (avant): ' || ordre;
  select string_agg(t.tgname, ' > ' order by t.tgname) into ordre from pg_trigger t where t.tgrelid = 'public.commandes'::regclass and not t.tgisinternal and t.tgtype & 2 = 2;
  r := r || ' || commandes (avant): ' || ordre;
  select string_agg(t.tgname, ' > ' order by t.tgname) into ordre from pg_trigger t where t.tgrelid = 'public.commandes'::regclass and not t.tgisinternal and t.tgtype & 2 = 0;
  r := r || ' || commandes (après): ' || ordre;
  -- effet combiné sur une annonce envoyée avec des valeurs trafiquées par un membre
  insert into public.verifications (user_id, statut, piece, defi, decide_le, expire_le, numero) values (S, 'verifie', 'cni', '1234', now(), current_date + 365, 'CQ-BDD3');
  perform pg_temp.qui(S);
  v := pg_temp.e(format('insert into public.offres (id, user_id, client_id, product_slug, product_label, region_slug, city, quantity, unit, price, status, created_at, phone, seller_name, expire_le, quantite_vue, maj_le) values (%L, %L, %L, %L, %L, %L, %L, 10, %L, 1000, %L, %L, %L, %L, %L, 999, %L)',
       o, S, 'cq-bdd3', 'mais', 'Maïs', 'yamoussoukro', 'Yamoussoukro', 'sac', 'active', '2020-01-01', '0701020304', 'Faux Nom', '2099-01-01', '2099-01-01'));
  execute 'reset role';
  r := r || ' || annonce trafiquée: ' || v || ' -> ' || coalesce((select concat_ws(' ', 'créée=' || (created_at::date = current_date), 'tel=' || coalesce(phone, 'vide'), 'nom=' || seller_name,
       'expire_dans_j=' || extract(day from expire_le - now())::int, 'quantite_vue=' || coalesce(quantite_vue::text, 'vide'), 'maj_le_futur=' || (maj_le > now() + interval '1 day')) from public.offres where id = o), 'absente');
  if exists (select 1 from public.offres where id = o and (created_at::date <> current_date or phone is not null or seller_name = 'Faux Nom' or expire_le > now() + interval '400 days' or maj_le > now() + interval '1 day')) then bad := true; end if;
  -- déclencheurs « après » d'une commande : commission calculée à la création, annulée à l'annulation
  insert into public.commandes (numero, vendeur_id, acheteur_id, cree_par, produit, quantite, unite, prix_unitaire, montant, mode_transport, etat, etape)
    values ('CQ-BDD3', S, B, B, 'mais', 10, 'sac', 20000, 200000, 'vendeur', 'en_cours', 'confirmee') returning id into c;
  r := r || ' || commission à la création: ' || coalesce((select statut || '/' || statut_registre || ' ' || commission || ' F' from public.commissions where commande_id = c), 'aucune');
  perform set_config('mdg.fiab_accord', 'true', true);
  update public.commandes set etat = 'annulee', annulation_par = B, annulation_motif = 'erreur_saisie' where id = c;
  r := r || ' ; après annulation: ' || coalesce((select statut || '/' || statut_registre from public.commissions where commande_id = c), 'aucune')
     || ' annulation enregistrée=' || exists (select 1 from public.annulations where commande_id = c)
     || ' confirme_le posé=' || ((select confirme_le from public.commandes where id = c) is not null);
  if (select statut from public.commissions where commande_id = c) <> 'annulee' then bad := true; end if;
  raise exception '%: %', case when bad then 'TEST ECHEC' else 'TEST OK' end, r;
end $$;
-- Résultat (25/10/2026) : TEST OK : tout normalisé ; commission 7 000 F prévue puis annulée. Nouveau déclencheur offres_quantites (schéma 97b, en cours de changement par une autre équipe).

-- BDD-04 (intégrité, lecture seule, données de simulation)
select 'commandes terminées sans termine_le' k, count(*)::text v from public.commandes where etat = 'terminee' and termine_le is null
union all select 'commandes terminées non clôturées depuis plus de 24 h', count(*)::text from public.commandes where etat = 'terminee' and libere_le is null and termine_le < now() - interval '24 hours'
union all select 'commandes en_cours sans étape', count(*)::text from public.commandes where etat = 'en_cours' and etape is null
union all select 'commandes quantite<=0 ou prix<=0 ou montant<0', count(*)::text from public.commandes where quantite <= 0 or prix_unitaire <= 0 or montant < 0
union all select 'commandes montant ≠ quantité × prix (écart > 1 F)', count(*)::text from public.commandes where abs(coalesce(montant, 0) - round(coalesce(quantite, 0) * coalesce(prix_unitaire, 0))) > 1
union all select 'commandes vendeur = acheteur', count(*)::text from public.commandes where vendeur_id = acheteur_id
union all select 'commandes sans profil vendeur ou acheteur', count(*)::text from public.commandes c where not exists (select 1 from public.profils p where p.user_id = c.vendeur_id) or not exists (select 1 from public.profils p where p.user_id = c.acheteur_id)
union all select 'commandes sans commission', count(*)::text from public.commandes c where not exists (select 1 from public.commissions k where k.commande_id = c.id)
union all select 'commissions ≠ 3,5 % (écart > 1 F)', count(*)::text from public.commissions where abs(commission - round(montant_vente * 0.035)) > 1
union all select 'commandes litige sans échéance', count(*)::text from public.commandes where etat = 'litige' and litige_echeance is null
union all select 'commandes litige échéance dépassée', count(*)::text from public.commandes where etat = 'litige' and litige_echeance < now()
union all select 'offres actives quantité 0 (épuisées encore actives)', count(*)::text from public.offres where status = 'active' and quantity = 0
union all select 'offres actives expirées (expire_le passé)', count(*)::text from public.offres where status = 'active' and expire_le < now()
union all select 'demandes actives expirées', count(*)::text from public.demandes where status = 'active' and expire_le < now()
union all select 'offres actives de comptes supprimés', count(*)::text from public.offres o join public.profils p on p.user_id = o.user_id where o.status = 'active' and p.supprime_le is not null
union all select 'offres actives de comptes bannis', count(*)::text from public.offres o where o.status = 'active' and exists (select 1 from public.bannis b where b.user_id = o.user_id)
union all select 'négociations ouvertes sur annonce non active', count(*)::text from public.negociations n where n.statut = 'ouverte' and not exists (select 1 from public.offres o where n.cible = 'offre' and o.id = n.cible_id and o.status = 'active') and not exists (select 1 from public.demandes d where n.cible = 'demande' and d.id = n.cible_id and d.status = 'active')
union all select 'négociations dont l''annonce n''existe plus', count(*)::text from public.negociations n where not exists (select 1 from public.offres o where o.id = n.cible_id) and not exists (select 1 from public.demandes d where d.id = n.cible_id)
union all select 'accords conclus sans mouvement de stock', count(*)::text from public.negociations n where n.statut = 'conclue' and not exists (select 1 from public.stock_mouvements m where m.negociation_id = n.id)
union all select 'mouvements de stock orphelins (négociation absente)', count(*)::text from public.stock_mouvements m where not exists (select 1 from public.negociations n where n.id = m.negociation_id)
union all select 'annulations orphelines (commande absente)', count(*)::text from public.annulations a where not exists (select 1 from public.commandes c where c.id = a.commande_id)
union all select 'commande_alertes orphelines', count(*)::text from public.commande_alertes a where not exists (select 1 from public.commandes c where c.id = a.commande_id)
union all select 'avis sur commande non terminée', count(*)::text from public.avis_commandes a join public.commandes c on c.id = a.commande_id where c.etat <> 'terminee'
union all select 'avis dont l''auteur n''est pas partie', count(*)::text from public.avis_commandes a join public.commandes c on c.id = a.commande_id where a.auteur_id not in (c.vendeur_id, c.acheteur_id)
union all select 'dm dont l''auteur n''est pas dans la discussion', count(*)::text from public.dm m join public.discussions d on d.id = m.discussion_id where m.auteur_id not in (d.a_id, d.b_id)
union all select 'missions acceptées sur commande hors réseau', count(*)::text from public.transport_missions m join public.commandes c on c.id = m.commande_id where m.statut = 'acceptee' and c.mode_transport <> 'reseau'
union all select 'missions acceptées avec transporteur non vérifié', count(*)::text from public.transport_missions m join public.transporteurs t on t.id = m.transporteur_id where m.statut = 'acceptee' and t.statut <> 'verifie'
union all select 'pièces vérifiées sur 2 comptes', count(*)::text from (select numero from public.verifications where statut = 'verifie' and numero is not null group by numero having count(distinct user_id) > 1) z
union all select 'annonces_publiees inférieur au nombre réel d''annonces', count(*)::text from public.annonces_publiees ap where ap.n < (select count(*) from public.offres o where o.user_id = ap.user_id) + (select count(*) from public.demandes d where d.user_id = ap.user_id)
union all select 'suspensions actives', count(*)::text from public.sanctions where type = 'suspension' and levee_le is null and now() between debut and fin
union all select 'comptes de simulation (profils)', count(*)::text from public.profils;
-- Résultat (25/10/2026, données de simulation) : 0 partout SAUF : avis sur commande non terminée = 2 (commande MDG-C-261023-FE0FD3 : terminée, litige, annulée par l'équipe ;
-- ces avis comptent toujours dans reputation_publique) ; missions acceptées hors réseau = 17 (modes acheteur/vendeur, ancien parcours, transporteurs vérifiés) ;
-- annonces_publiees inférieur au réel = 75 (annonces de simulation insérées en masse) ; profils = 100.

-- BDD-05 (concurrent + panne dans une transaction) : négociation ouverte deux fois, insertion partiellement invalide, accord plus grand que le stock
do $$
declare S uuid := '1bfd5713-2525-44a6-8403-084ebb9ddad3'; B uuid := '68345d7a-9d64-410a-a4c7-92a750d9888d';
  r text := ''; bad boolean := false; v1 text; v2 text; o uuid := gen_random_uuid(); n0 bigint; n1 bigint; q0 numeric; q1 numeric;
begin
  insert into public.verifications (user_id, statut, piece, defi, decide_le, expire_le, numero) values (S, 'verifie', 'cni', '1234', now(), current_date + 365, 'CQ-BDD5');
  insert into public.offres (id, user_id, client_id, product_slug, product_label, region_slug, city, quantity, unit, price, status)
    values (o, S, 'cq-bdd5', 'mais', 'Maïs', 'yamoussoukro', 'Yamoussoukro', 100, 'sac', 20000, 'active');
  -- concurrence simulée : le même acheteur ouvre deux fois la négociation de la même offre (double clic, deux téléphones)
  perform pg_temp.qui(B);
  v1 := pg_temp.v(format('select public.nego_ouvrir(%L, %L, 19000, 10, null)::text', 'offre', o));
  v2 := pg_temp.v(format('select public.nego_ouvrir(%L, %L, 18000, 10, null)::text', 'offre', o));
  execute 'reset role';
  r := r || 'nego 1: ' || left(v1, 40) || ' ; nego 2: ' || left(v2, 50) || ' ; négociations ouvertes=' || (select count(*) from public.negociations where cible_id = o and statut = 'ouverte');
  if (select count(*) from public.negociations where cible_id = o and statut = 'ouverte') > 1 then bad := true; end if;
  begin
    insert into public.negociations (cible, cible_id, auteur_id, proprio_id, statut) values ('offre', o, B, S, 'ouverte');
    r := r || ' ; 2e ouverte insérée en base: acceptée'; bad := true;
  exception when unique_violation then r := r || ' ; 2e ouverte insérée en base: refusée (index unique)';
            when others then r := r || ' ; 2e ouverte insérée en base: refusée (' || left(sqlerrm, 40) || ')'; end;
  -- panne : une instruction de 3 lignes dont la 3e est invalide → aucune ligne ne reste
  n0 := (select count(*) from public.commandes);
  begin
    insert into public.commandes (numero, vendeur_id, acheteur_id, cree_par, produit, quantite, unite, prix_unitaire, montant, mode_transport, etat, etape)
    values ('CQ-BDD5-1', S, B, B, 'mais', 1, 'sac', 1000, 1000, 'vendeur', 'en_cours', 'confirmee'),
           ('CQ-BDD5-2', S, B, B, 'mais', 1, 'sac', 1000, 1000, 'vendeur', 'en_cours', 'confirmee'),
           ('CQ-BDD5-3', S, B, B, 'mais', 1, 'sac', 1000, 1000, 'vendeur', 'payee', 'confirmee');
  exception when others then r := r || ' | insertion de 3 commandes (3e invalide): refusée'; end;
  n1 := (select count(*) from public.commandes);
  r := r || ' ; lignes restées=' || (n1 - n0) || ' commissions restées=' || (select count(*) from public.commissions k join public.commandes c on c.id = k.commande_id where c.numero like 'CQ-BDD5-%');
  if n1 <> n0 then bad := true; end if;
  -- panne : accord sur plus que le stock → le stock ne bouge pas
  q0 := (select quantity from public.offres where id = o);
  perform pg_temp.qui(S);
  v1 := pg_temp.e(format('select public.nego_agir(%L, %L, 19000, 500, null, null)', v1::uuid, 'prix'));
  execute 'reset role';
  q1 := (select quantity from public.offres where id = o);
  r := r || ' | contre-offre 500 sacs sur un stock de 100: ' || left(v1, 50) || ' ; stock ' || q0 || ' -> ' || q1;
  if q0 <> q1 then bad := true; end if;
  raise exception '%: %', case when bad then 'TEST ECHEC' else 'TEST OK' end, r;
end $$;
-- Résultat (25/10/2026) : TEST OK : 1 négociation (même id rendu), index unique ; 0 ligne restée ; stock inchangé.

-- BDD-06 (concurrent) : deux connexions qui prennent le même stock au même instant. EN ATTENTE : deux connexions simultanées (impossible via le MCP).
