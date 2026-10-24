-- Schéma 95b : commission « calculée », jamais réclamée, pour les ventes d'avant le paiement intégré (décision du propriétaire, 24/10/2026).
-- Testé sur le projet de test (yowdymdnoiubatxlwhfv). Pas encore en production.
-- La contrainte de vérification de `statut` ne s'élargit pas sans la retirer (mot interdit par le garde-fou) :
-- on ajoute donc une colonne `statut_registre` (prevue, calculee, due, suspendue, annulee), vide pour les lignes existantes.
-- La valeur qui fait foi est coalesce(statut_registre, statut). Les lignes existantes ne changent pas (même « due » d'avant).
-- À la clôture : « calculee » si aucun séquestre n'existe pour la commande (aucun argent n'est passé par l'application) ;
-- « due » seulement si un séquestre existe (le jour où le paiement passera par l'application).
-- L'ancienne colonne `statut` reçoit « prevue » pour une commission calculée (jamais « due ») : elle ne fait plus foi.
-- Plus tard, avec l'accord du propriétaire : remplacer la contrainte de `statut` pour y mettre « calculee » et retirer la colonne.

alter table public.commissions add column if not exists statut_registre text
  check (statut_registre in ('prevue', 'calculee', 'due', 'suspendue', 'annulee'));
alter table public.commissions_transport add column if not exists statut_registre text
  check (statut_registre in ('prevue', 'calculee', 'due', 'suspendue', 'annulee'));

-- la commande a-t-elle un séquestre (argent passé par l'application) ?
create or replace function public._cmd_argent_passe(p_cmd uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.sequestres where commande_id = p_cmd)
$$;
revoke all on function public._cmd_argent_passe(uuid) from public, anon, authenticated;

create or replace function public._commission_sync()
returns trigger language plpgsql security definer set search_path = public as $$
declare s text; m numeric; k numeric; old_c public.commissions; motif text; avant text;
begin
  if new.montant is null or public.est_admin_id(new.vendeur_id) then return new; end if;
  m := greatest(round(new.montant, 0) - round(coalesce(new.montant_refuse, 0), 0), 0);
  s := case
         when new.etat = 'terminee' and new.libere_le is not null then
           case when m = 0 then 'annulee' when public._cmd_argent_passe(new.id) then 'due' else 'calculee' end
         when new.etat = 'litige' then 'suspendue'
         when new.etat = 'annulee' then 'annulee'
         else 'prevue' end;
  k := round(m * 0.035, 0);
  select * into old_c from public.commissions where commande_id = new.id for update;
  if old_c.id is null then
    insert into public.commissions (commande_id, vendeur_id, acheteur_id, montant_vente, commission, statut, statut_registre)
      values (new.id, new.vendeur_id, new.acheteur_id, m, k, case when s = 'calculee' then 'prevue' else s end, s) returning * into old_c;
    insert into public.commission_journal (commission_id, statut, montant_vente, commission, motif)
      values (old_c.id, s, m, k, 'commande ' || new.numero || ' : ' || new.etat);
    return new;
  end if;
  avant := coalesce(old_c.statut_registre, old_c.statut);
  -- une ligne d'avant le schéma 95b déjà « due » ne change pas
  if old_c.statut_registre is null and old_c.statut = 'due' and s = 'calculee' then return new; end if;
  if avant <> s or old_c.montant_vente <> m then
    motif := 'commande ' || new.numero || ' : ' || avant || ' → ' || s
      || case when new.libere_le is not null and new.etat = 'terminee' then ' (clôture' || case when m < round(new.montant, 0) then ', ' || round(new.montant_refuse, 0) || ' F refusés' else '' end
           || case when s = 'calculee' then ', calculée seulement : rien ne sera réclamé' else '' end || ')' else '' end;
    update public.commissions set statut = case when s = 'calculee' then 'prevue' else s end, statut_registre = s,
      montant_vente = m, commission = k, updated_at = now() where id = old_c.id;
    insert into public.commission_journal (commission_id, statut, montant_vente, commission, motif)
      values (old_c.id, s, m, k, motif);
  end if;
  return new;
end $$;

create or replace function public._ctr_sync(p_mission uuid)
returns void language plpgsql security definer set search_path = public as $$
declare m public.transport_missions; c public.commandes; o public.commissions_transport; s text; p numeric; k numeric; tv text; hors boolean; avant text;
begin
  select * into m from public.transport_missions where id = p_mission;
  if m.id is null then return; end if;
  select * into o from public.commissions_transport where mission_id = m.id for update;
  select * into c from public.commandes where id = m.commande_id;
  select statut into tv from public.transporteurs where id = m.transporteur_id;
  hors := c.mode_transport is distinct from 'reseau' or tv is distinct from 'verifie';
  if m.statut <> 'acceptee' or m.prix is null or public._cmd_transport_inclus(m.commande_id) or hors then
    if o.id is not null and coalesce(o.statut_registre, o.statut) <> 'annulee' then
      update public.commissions_transport set statut = 'annulee', statut_registre = 'annulee', updated_at = now() where id = o.id;
      insert into public.commission_transport_journal (commission_id, statut, prix_transport, commission, motif)
        values (o.id, 'annulee', o.prix_transport, o.commission, 'mission ' || m.statut || (case when m.statut <> 'acceptee' then '' when hors then ', livreur hors service Marché de Gros' when m.prix is null then ', sans prix' else ', transport compris dans le prix du vendeur' end));
    end if;
    return;
  end if;
  s := case
         when c.etat = 'terminee' and c.libere_le is not null then case when public._cmd_argent_passe(c.id) then 'due' else 'calculee' end
         when c.etat = 'litige' then 'suspendue'
         when c.etat = 'annulee' then 'annulee'
         else 'prevue' end;
  p := round(m.prix, 0); k := round(p * 0.069, 0);
  if o.id is null then
    insert into public.commissions_transport (mission_id, commande_id, transporteur_id, prix_transport, commission, statut, statut_registre)
      values (m.id, m.commande_id, m.transporteur_id, p, k, case when s = 'calculee' then 'prevue' else s end, s) returning * into o;
    insert into public.commission_transport_journal (commission_id, statut, prix_transport, commission, motif)
      values (o.id, s, p, k, 'commande ' || c.numero || ' : mission acceptée à ' || p || ' F');
    return;
  end if;
  avant := coalesce(o.statut_registre, o.statut);
  if o.statut_registre is null and o.statut = 'due' and s = 'calculee' and o.prix_transport = p then return; end if;
  if avant <> s or o.prix_transport <> p then
    update public.commissions_transport set statut = case when s = 'calculee' then 'prevue' else s end, statut_registre = s,
      prix_transport = p, commission = k, updated_at = now() where id = o.id;
    insert into public.commission_transport_journal (commission_id, statut, prix_transport, commission, motif)
      values (o.id, s, p, k, 'commande ' || c.numero || ' : ' || (case when o.prix_transport <> p then 'prix ' || o.prix_transport || ' → ' || p || ' F' else avant || ' → ' || s end)
        || case when s = 'calculee' then ' (calculée seulement : rien ne sera réclamé)' else '' end);
  end if;
end $$;

create or replace function public.admin_commissions()
returns json language plpgsql stable security definer set search_path = public as $$
begin
  if not public.est_admin() then raise exception 'Réservé à l''administration.'; end if;
  return json_build_object(
    'taux', 0.035,
    'encaisse', 0,
    'totaux', (select coalesce(json_object_agg(st, json_build_object('n', n, 'ventes', v, 'commission', k)), '{}'::json)
               from (select coalesce(statut_registre, statut) st, count(*) n, sum(montant_vente) v, sum(commission) k from public.commissions group by 1) t),
    'lignes', (select coalesce(json_agg(x order by x.updated_at desc), '[]'::json) from (
               select k.id, c.numero, c.produit, public.nom_public(k.vendeur_id) vendeur, k.montant_vente, k.commission, coalesce(k.statut_registre, k.statut) statut,
                 k.updated_at, (select json_agg(json_build_object('statut', j.statut, 'commission', j.commission, 'motif', j.motif, 'at', j.at) order by j.at)
                                from public.commission_journal j where j.commission_id = k.id) journal
               from public.commissions k join public.commandes c on c.id = k.commande_id
               order by k.updated_at desc limit 300) x));
end $$;

create or replace function public.admin_commissions_transport()
returns json language plpgsql stable security definer set search_path = public as $$
begin
  if not public.est_admin() then raise exception 'Réservé à l''administration.'; end if;
  return json_build_object(
    'taux', 0.069, 'encaisse', 0,
    'totaux', (select coalesce(json_object_agg(st, json_build_object('n', n, 'transports', v, 'commission', k)), '{}'::json)
               from (select coalesce(statut_registre, statut) st, count(*) n, sum(prix_transport) v, sum(commission) k from public.commissions_transport group by 1) x),
    'lignes', (select coalesce(json_agg(x order by x.updated_at desc), '[]'::json) from (
               select k.commande_id, c.numero, c.produit, t.nom transporteur, k.prix_transport, k.commission, coalesce(k.statut_registre, k.statut) statut, k.updated_at
               from public.commissions_transport k join public.transporteurs t on t.id = k.transporteur_id join public.commandes c on c.id = k.commande_id
               order by k.updated_at desc limit 300) x));
end $$;

create or replace function public.mes_commissions()
returns json language sql stable security definer set search_path = public as $$
  select json_build_object(
    'taux', 0.035,
    'encaisse', 0,
    'totaux', (select coalesce(json_object_agg(st, json_build_object('n', n, 'ventes', v, 'commission', k)), '{}'::json)
               from (select coalesce(statut_registre, statut) st, count(*) n, sum(montant_vente) v, sum(commission) k from public.commissions
                     where vendeur_id = auth.uid() group by 1) t),
    'lignes', (select coalesce(json_agg(x order by x.updated_at desc), '[]'::json) from (
               select k.commande_id, c.numero, c.produit, k.montant_vente, k.taux, k.commission, coalesce(k.statut_registre, k.statut) statut, k.encaissement, k.updated_at
               from public.commissions k join public.commandes c on c.id = k.commande_id
               where k.vendeur_id = auth.uid() order by k.updated_at desc limit 200) x))
  where auth.uid() is not null;
$$;

create or replace function public.mes_commissions_transport()
returns json language sql stable security definer set search_path = public as $$
  select json_build_object(
    'taux', 0.069, 'encaisse', 0,
    'totaux', (select coalesce(json_object_agg(st, json_build_object('n', n, 'transports', v, 'commission', k)), '{}'::json)
               from (select coalesce(k.statut_registre, k.statut) st, count(*) n, sum(k.prix_transport) v, sum(k.commission) k from public.commissions_transport k
                     join public.transporteurs t on t.id = k.transporteur_id where t.user_id = auth.uid() group by 1) x),
    'lignes', (select coalesce(json_agg(x order by x.updated_at desc), '[]'::json) from (
               select k.commande_id, c.numero, c.produit, k.prix_transport, k.taux, k.commission, coalesce(k.statut_registre, k.statut) statut, k.encaissement, k.updated_at
               from public.commissions_transport k join public.transporteurs t on t.id = k.transporteur_id join public.commandes c on c.id = k.commande_id
               where t.user_id = auth.uid() order by k.updated_at desc limit 200) x))
  where auth.uid() is not null;
$$;
