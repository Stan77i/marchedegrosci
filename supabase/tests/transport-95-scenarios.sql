-- Scénarios du schéma 95 (projet de test seulement). Tout est annulé par la dernière exception : rien ne reste.
-- Comptes du projet de test : admin 981961d4…, chauffeur f8e1b009… (transporteur vérifié d9b2a5a8…).
do $$
declare
  adm uuid := '981961d4-25ba-4e1b-a732-8fd68cd6c922';
  chf uuid := 'f8e1b009-e7c7-4637-b685-c05155f06be9';
  trp uuid := 'd9b2a5a8-5949-48b3-a328-e8d642c3db5d';
  c1 uuid := '4bcea401-db94-4a3a-8958-33fb0efd5bef';  -- passera en mode réseau
  c2 uuid := 'abac67eb-5bc0-40b5-8ac2-5a6fca538d71';  -- livreur du vendeur avec prix
  c3 uuid := '07d1aa53-d3cf-401a-859b-f2e9a51a19b0';  -- transport à part
  c4 uuid := '5102e105-78ff-4264-93d7-a28a41750185';  -- arrondis
  r text := ''; x text; mid uuid; j json; ach uuid;
begin
  update public.reglages set valeur = 'false'::jsonb where cle = 'transport_reseau_ouvert';
  -- 1. service fermé : admin_affecter refusé
  perform set_config('request.jwt.claims', json_build_object('sub', adm, 'role', 'authenticated')::text, true);
  execute 'set local role authenticated';
  begin x := public.admin_affecter(c1, trp); r := r || '1.ferme=' || x; exception when others then r := r || '1.ferme=REFUS(' || sqlerrm || ')'; end;
  -- 6. ouverture refusée sous le seuil (seuil réglé à 20, 15 vérifiés)
  execute 'reset role';
  insert into public.reglages (cle, valeur, maj_le) values ('transport_reseau_min', '20'::jsonb, now()) on conflict (cle) do update set valeur = excluded.valeur;
  execute 'set local role authenticated';
  begin r := r || ' | 6.seuil20=' || public.admin_transport_reseau(true); exception when others then r := r || ' | 6.seuil20=REFUS(' || sqlerrm || ')'; end;
  execute 'reset role';
  update public.reglages set valeur = '1'::jsonb where cle = 'transport_reseau_min';
  execute 'set local role authenticated';
  begin r := r || ' | 6.seuil1(plancher 3)=' || public.admin_transport_reseau(true); exception when others then r := r || ' | 6.seuil1=REFUS(' || sqlerrm || ')'; end;
  -- 2. service ouvert, commande « livreur du vendeur » : refusé
  begin x := public.admin_affecter(c1, trp); r := r || ' | 2.mode_vendeur=' || x; exception when others then r := r || ' | 2.mode_vendeur=REFUS(' || sqlerrm || ')'; end;
  -- 3. commande en mode réseau : affectation, prix 50 000, 6,9 %
  execute 'reset role';
  update public.commandes set mode_transport = 'reseau', validation = 'code', transport_regle = 'mgci' where id = c1;
  execute 'set local role authenticated';
  x := public.admin_affecter(c1, trp); r := r || ' | 3.reseau=' || x;
  execute 'reset role';
  select id into mid from public.transport_missions where commande_id = c1 and statut = 'proposee';
  perform set_config('request.jwt.claims', json_build_object('sub', chf, 'role', 'authenticated')::text, true);
  execute 'set local role authenticated';
  begin x := public.chauffeur_repondre2(mid, true, 50000, null); r := r || ' rep=' || x; exception when others then r := r || ' rep=ERR(' || sqlerrm || ')'; end;
  -- en mode réseau, le prix se fixe à trois : on simule l'accord des trois sur 50 000 F
  execute 'reset role';
  update public.transport_missions set statut = 'acceptee', prix = 50000, repondu_le = now() where id = mid;
  update public.commandes set transporteur_id = trp where id = c1;
  r := r || ' registre=' || coalesce((select statut || ':' || commission from public.commissions_transport where mission_id = mid), 'aucun');
  execute 'set local role authenticated';
  select json_agg(e) into j from json_array_elements(public.chauffeur_missions()) e where e->>'commande_id' = c1::text;
  r := r || ' chauffeur(reseau): taux=' || coalesce(j->0->>'taux','?') || ' com=' || coalesce(j->0->>'commission','?') || ' net=' || coalesce(j->0->>'net','?');
  execute 'reset role';
  j := public._seq_repartition(c1);
  r := r || ' repart: total=' || (j->>'total') || ' tk=' || (j->>'transporteur_commission') || ' marche=' || (j->>'marche');
  -- 4. livreur du vendeur avec un prix : 0 %
  insert into public.transport_missions (commande_id, transporteur_id, propose_par, propose_role, statut, repondu_le, prix)
    values (c2, trp, chf, 'vendeur', 'acceptee', now(), 50000);
  j := public._seq_repartition(c2);
  r := r || ' | 4.vendeur repart: total=' || (j->>'total') || ' tk=' || (j->>'transporteur_commission') || ' net=' || (j->>'transporteur_net') || ' marche=' || (j->>'marche')
         || ' registre=' || (select count(*) from public.commissions_transport where commande_id = c2 and statut <> 'annulee');
  perform set_config('request.jwt.claims', json_build_object('sub', chf, 'role', 'authenticated')::text, true);
  execute 'set local role authenticated';
  select json_agg(e) into j from json_array_elements(public.chauffeur_missions()) e where e->>'commande_id' = c2::text;
  r := r || ' chauffeur: taux=' || coalesce(j->0->>'taux','?') || ' com=' || coalesce(j->0->>'commission','?') || ' net=' || coalesce(j->0->>'net','?');
  execute 'reset role';
  -- 5. transport à part : 270 000 + 30 000
  update public.commandes set transport_regle = 'a_part', prix_transport = 30000, total_convenu = 300000 where id = c3;
  j := public._seq_repartition(c3);
  r := r || ' | 5.a_part: total=' || (j->>'total') || ' convenu=' || (select total_convenu from public.commandes where id = c3)
         || ' vendeur_net=' || (j->>'vendeur_net') || ' (brut ' || (j->>'vendeur_brut') || ' - ' || (j->>'vendeur_commission') || ' + ' || (j->>'vendeur_transport') || ') tk=' || (j->>'transporteur_commission');
  -- 7. arrondis : 12 345,4 F de marchandise, 2 000,4 F refusés, transport réseau 7 246,38 F
  update public.commandes set montant = 12345.4, montant_refuse = 2000.4 where id = c1;
  update public.transport_missions set prix = 7246.38 where commande_id = c1 and statut = 'acceptee';
  j := public._seq_repartition(c1);
  r := r || ' | 7.arrondis: ' || j::text || ' somme_parts=' || ((j->>'acheteur_rembourse')::numeric + (j->>'vendeur_brut')::numeric + (j->>'vendeur_transport')::numeric + (j->>'transporteur_brut')::numeric);
  -- 8. textes de clôture
  select acheteur_id into ach from public.commandes where id = c4;
  perform set_config('request.jwt.claims', json_build_object('sub', ach, 'role', 'authenticated')::text, true);
  execute 'set local role authenticated';
  begin perform public.commande_liberer(c4); exception when others then r := r || ' | 8.cloture_en_cours=' || sqlerrm; end;
  perform set_config('request.jwt.claims', json_build_object('sub', chf, 'role', 'authenticated')::text, true);
  begin perform public.commande_liberer(c4); exception when others then r := r || ' | autre=' || sqlerrm; end;
  raise exception 'TEST: %', r;
end $$;
