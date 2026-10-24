-- Schéma 96f : 250 abonnés à un produit (comptes fictifs, liens vérifiés mis de côté dans ce bloc annulé) → tous prévenus.
-- Projet de TEST seulement ; tout est annulé par l'exception finale.
do $$
declare o uuid; d uuid; n_o int; n_d int; i int; u uuid;
begin
  set local session_replication_role = replica;
  select id into o from public.offres where status = 'active' limit 1;
  select id into d from public.demandes where status = 'active' limit 1;
  update public.offres set product_slug = 'test96f' where id = o;
  update public.demandes set product_slug = 'test96f' where id = d;
  for i in 1..250 loop
    u := gen_random_uuid();
    insert into public.alertes_produits (user_id, product_slug, offres, demandes) values (u, 'test96f', true, true);
    insert into public.push_abonnements (user_id, endpoint, p256dh, auth) values (u, 'https://test.invalid/' || u, repeat('x', 30), repeat('y', 10));
  end loop;
  select count(*) into n_o from public.notif_cible_annonce('offres', o) c where c.raison = 'suivi';
  select count(*) into n_d from public.notif_cible_annonce('demandes', d) c where c.raison = 'suivi';
  raise exception 'TEST: 250 abonnés → offre : % prévenus (suivi) | demande : % prévenus (suivi)', n_o, n_d;
end $$;
