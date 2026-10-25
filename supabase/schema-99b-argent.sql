-- Schéma 99b : registre des commissions et dépôts (contrôle qualité du 25/10/2026 : ANO-013, ANO-022, ANO-045).
-- Aucun paiement n'est branché : rien n'est simulé, rien n'est encaissé, aucun argent ne bouge.
--
-- ANO-013 (décision du propriétaire, 25/10/2026) : les anciennes commissions « due » sans séquestre (aucun argent passé par
--   l'application) deviennent « d'avant la règle : non réclamée ». La contrainte de statut_registre ne peut pas recevoir une
--   nouvelle valeur sans être retirée (mot bloqué par le garde-fou) : elles passent à « calculee » (= jamais réclamée, règle 95b)
--   avec la marque avant_regle = vrai et une ligne de journal qui le dit. Rien n'est effacé.
--   Les écrans lisent avant_regle : admin_commissions, admin_commissions_transport, mes_commissions (totaux.avant_regle à part).
-- ANO-022 : un 2e dépôt avec une autre référence sur une commande qui a déjà son séquestre n'est plus ignoré : il est gardé dans
--   sequestre_depots_doubles (à rembourser, vu par l'équipe) et la fonction répond « depot_double ».
-- ANO-045 : plafond de montant par commande (reglages.commandes.montant_max, 1 milliard de F CFA par défaut, réglable) :
--   vérifié à la proposition de prix (schéma 99d) et à la création de la commande (commande_creer2).

-- 1. ANO-013 : marque « d'avant la règle »
alter table public.commissions add column if not exists avant_regle boolean not null default false;
alter table public.commissions_transport add column if not exists avant_regle boolean not null default false;

with x as (
  update public.commissions k set statut = 'prevue', statut_registre = 'calculee', avant_regle = true, updated_at = now()
  where coalesce(k.statut_registre, k.statut) = 'due' and not exists (select 1 from public.sequestres q where q.commande_id = k.commande_id)
  returning k.id, k.montant_vente, k.commission)
insert into public.commission_journal (commission_id, statut, montant_vente, commission, motif)
select x.id, 'calculee', x.montant_vente, x.commission,
  'Requalifiée le 25/10/2026 : vente d''avant la règle, aucun argent passé par l''application. Non réclamée.' from x;

with x as (
  update public.commissions_transport k set statut = 'prevue', statut_registre = 'calculee', avant_regle = true, updated_at = now()
  where coalesce(k.statut_registre, k.statut) = 'due' and not exists (select 1 from public.sequestres q where q.commande_id = k.commande_id)
  returning k.id, k.prix_transport, k.commission)
insert into public.commission_transport_journal (commission_id, statut, prix_transport, commission, motif)
select x.id, 'calculee', x.prix_transport, x.commission,
  'Requalifiée le 25/10/2026 : transport d''avant la règle, aucun argent passé par l''application. Non réclamée.' from x;

create or replace function public.admin_commissions() returns json
language plpgsql stable security definer set search_path = public as $$
begin
  if not public.est_admin() then raise exception 'Réservé à l''administration.'; end if;
  return json_build_object(
    'taux', 0.035,
    'encaisse', 0,
    'totaux', (select coalesce(json_object_agg(st, json_build_object('n', n, 'ventes', v, 'commission', k)), '{}'::json)
               from (select coalesce(statut_registre, statut) st, count(*) n, sum(montant_vente) v, sum(commission) k from public.commissions group by 1) t),
    'avant_regle', (select json_build_object('n', count(*), 'ventes', coalesce(sum(montant_vente), 0), 'commission', coalesce(sum(commission), 0))
                    from public.commissions where avant_regle),
    'lignes', (select coalesce(json_agg(x order by x.updated_at desc), '[]'::json) from (
               select k.id, c.numero, c.produit, public.nom_public(k.vendeur_id) vendeur, k.montant_vente, k.commission, coalesce(k.statut_registre, k.statut) statut,
                 k.avant_regle, k.updated_at, (select json_agg(json_build_object('statut', j.statut, 'commission', j.commission, 'motif', j.motif, 'at', j.at) order by j.at)
                                from public.commission_journal j where j.commission_id = k.id) journal
               from public.commissions k join public.commandes c on c.id = k.commande_id
               order by k.updated_at desc limit 300) x));
end $$;

create or replace function public.admin_commissions_transport() returns json
language plpgsql stable security definer set search_path = public as $$
begin
  if not public.est_admin() then raise exception 'Réservé à l''administration.'; end if;
  return json_build_object(
    'taux', 0.069, 'encaisse', 0,
    'totaux', (select coalesce(json_object_agg(st, json_build_object('n', n, 'transports', v, 'commission', k)), '{}'::json)
               from (select coalesce(statut_registre, statut) st, count(*) n, sum(prix_transport) v, sum(commission) k from public.commissions_transport group by 1) x),
    'avant_regle', (select json_build_object('n', count(*), 'transports', coalesce(sum(prix_transport), 0), 'commission', coalesce(sum(commission), 0))
                    from public.commissions_transport where avant_regle),
    'lignes', (select coalesce(json_agg(x order by x.updated_at desc), '[]'::json) from (
               select k.commande_id, c.numero, c.produit, t.nom transporteur, k.prix_transport, k.commission, coalesce(k.statut_registre, k.statut) statut,
                 k.avant_regle, k.updated_at
               from public.commissions_transport k join public.transporteurs t on t.id = k.transporteur_id join public.commandes c on c.id = k.commande_id
               order by k.updated_at desc limit 300) x));
end $$;

create or replace function public.mes_commissions() returns json
language sql stable security definer set search_path = public as $$
  select json_build_object(
    'taux', 0.035,
    'encaisse', 0,
    'totaux', (select coalesce(json_object_agg(st, json_build_object('n', n, 'ventes', v, 'commission', k)), '{}'::json)
               from (select coalesce(statut_registre, statut) st, count(*) n, sum(montant_vente) v, sum(commission) k from public.commissions
                     where vendeur_id = auth.uid() group by 1) t),
    'avant_regle', (select json_build_object('n', count(*), 'ventes', coalesce(sum(montant_vente), 0), 'commission', coalesce(sum(commission), 0))
                    from public.commissions where vendeur_id = auth.uid() and avant_regle),
    'lignes', (select coalesce(json_agg(x order by x.updated_at desc), '[]'::json) from (
               select k.commande_id, c.numero, c.produit, k.montant_vente, k.taux, k.commission, coalesce(k.statut_registre, k.statut) statut,
                 k.avant_regle, k.encaissement, k.updated_at
               from public.commissions k join public.commandes c on c.id = k.commande_id
               where k.vendeur_id = auth.uid() order by k.updated_at desc limit 200) x))
  where auth.uid() is not null;
$$;

-- 2. ANO-022 : dépôt en double gardé, jamais ignoré
create table if not exists public.sequestre_depots_doubles (
  id bigint generated always as identity primary key,
  commande_id uuid not null references public.commandes(id),
  operateur text not null check (char_length(operateur) between 1 and 20),
  reference text not null check (char_length(reference) between 1 and 120),
  montant numeric,
  recu_le timestamptz not null default now(),
  traite_le timestamptz,
  traite_par uuid,
  note text check (note is null or char_length(note) <= 300),
  unique (operateur, reference)
);
alter table public.sequestre_depots_doubles enable row level security;
revoke all on public.sequestre_depots_doubles from anon, authenticated;

create or replace function public.sequestre_depot_confirme(p_cmd uuid, p_operateur text, p_reference text, p_montant numeric) returns text
language plpgsql security definer set search_path = public as $$
declare c public.commandes; r json; s public.sequestres;
begin
  select * into c from public.commandes where id = p_cmd for update;
  if c.id is null then raise exception 'Commande introuvable.'; end if;
  select * into s from public.sequestres where commande_id = c.id;
  if s.id is not null then
    -- même dépôt reçu une 2e fois (coupure) : même réponse ; autre référence : 2e paiement à rembourser, gardé pour l'équipe
    if s.reference is distinct from p_reference or s.operateur is distinct from p_operateur then
      insert into public.sequestre_depots_doubles (commande_id, operateur, reference, montant)
      values (c.id, left(coalesce(p_operateur, '?'), 20), left(coalesce(nullif(p_reference, ''), '?'), 120), round(p_montant, 0))
      on conflict (operateur, reference) do nothing;
      return 'depot_double';
    end if;
    return s.etat;
  end if;
  if c.etat <> 'en_cours' then raise exception 'Les fonds se bloquent quand la commande est confirmée et pas encore terminée.'; end if;
  r := public._seq_repartition(c.id);
  if p_montant is null or round(p_montant, 0) <> (r->>'total')::numeric then
    raise exception 'Montant reçu (%) différent du total attendu (%).', p_montant, r->>'total';
  end if;
  insert into public.sequestres (commande_id, operateur, reference, montant) values (c.id, p_operateur, p_reference, round(p_montant, 0));
  perform public._seq_journal(c.id, 'depot', null, 'systeme', round(p_montant, 0) || ' F bloqués chez ' || p_operateur || ' (réf. ' || p_reference || ')');
  return 'bloque';
end $$;

-- l'équipe lit les dépôts en double (écran à faire)
create or replace function public.admin_depots_doubles() returns json
language plpgsql stable security definer set search_path = public as $$
begin
  if not public.est_admin() then raise exception 'Réservé à l''administration.'; end if;
  return (select coalesce(json_agg(json_build_object('id', d.id, 'commande_id', d.commande_id, 'numero', c.numero, 'operateur', d.operateur,
            'reference', d.reference, 'montant', d.montant, 'recu_le', d.recu_le, 'traite_le', d.traite_le, 'note', d.note) order by d.recu_le desc), '[]'::json)
          from public.sequestre_depots_doubles d join public.commandes c on c.id = d.commande_id);
end $$;
revoke all on function public.admin_depots_doubles() from public, anon;
grant execute on function public.admin_depots_doubles() to authenticated;

-- 3. ANO-045 : plafond de montant à la création de la commande
create or replace function public.commande_creer2(p_nego uuid, p_mode text, p_lieu text default null, p_ville_arrivee text default null, p_ville_depart text default null)
returns uuid language plpgsql security definer set search_path = public as $$
declare me uuid := auth.uid(); n public.negociations; dep text; arr text; meme boolean; inclus boolean; apart boolean; regle text; cid uuid; mt numeric;
  vs boolean; nom text; ann text; mmax numeric := public._cmd_montant_max();
begin
  if me is null then raise exception 'Connectez-vous d''abord.'; end if;
  select * into n from public.negociations where id = p_nego;
  if n.id is null or me not in (n.auteur_id, n.proprio_id) then raise exception 'Accord introuvable.'; end if;
  if n.prix_final is not null and coalesce(n.quantite_finale, n.quantite) is not null and n.prix_final * coalesce(n.quantite_finale, n.quantite) > mmax then
    raise exception 'MONTANT_MAX : une commande ne peut pas dépasser % F CFA. Faites plusieurs commandes plus petites.', replace(to_char(mmax, 'FM999G999G999G999'), ',', ' ');
  end if;
  if n.cible = 'offre' then
    select city, ville_seulement into ann, vs from public.offres where id = n.cible_id;
    dep := coalesce(nullif(btrim(n.ville), ''), ann);
    arr := public._cmd_texte(p_ville_arrivee, 80);
    if arr is null then raise exception 'Choisissez la ville de livraison.'; end if;
  else
    select city, ville_seulement into ann, vs from public.demandes where id = n.cible_id;
    arr := coalesce(nullif(btrim(n.ville), ''), public._cmd_texte(p_ville_arrivee, 80), ann);
    dep := public._cmd_texte(p_ville_depart, 80);
    if dep is null then raise exception 'Choisissez la ville où se trouve la marchandise.'; end if;
  end if;
  if coalesce(vs, false) and public._ville_cle(coalesce(n.ville, ann)) <> '' then
    nom := public._ville_ref(coalesce(nullif(btrim(n.ville), ''), ann));
    if n.cible = 'offre' and public._ville_cle(public._ville_ref(arr)) is distinct from public._ville_cle(nom) then
      raise exception 'Ce vendeur vend uniquement à % : la livraison doit se faire à %.', nom, nom;
    elsif n.cible = 'demande' and public._ville_cle(public._ville_ref(dep)) is distinct from public._ville_cle(nom) then
      raise exception 'Cet acheteur achète uniquement à % : la marchandise doit se trouver à %.', nom, nom;
    end if;
  end if;
  perform set_config('mgci.ville_verifiee', '1', true);
  meme := public._ville_cle(public._ville_ref(dep)) = public._ville_cle(public._ville_ref(arr));
  inclus := coalesce(n.transport_final, public._transport_vendeur(n.cible, n.cible_id));
  apart := not inclus and n.prix_transport_final is not null;
  if p_mode = 'acheteur' and apart then
    raise exception 'Le transport à part est convenu avec le vendeur : c''est lui qui livre, ou un transporteur du réseau Marché de Gros.';
  end if;
  regle := case when p_mode = 'reseau' then 'mgci' when inclus then 'inclus' when apart then 'a_part'
                when p_mode = 'vendeur' then 'livreur_vendeur' when meme then 'retrait' else 'acheteur' end;
  cid := public.commande_creer(p_nego, p_mode, p_lieu, case when p_mode = 'reseau' then 'code' else 'declaration' end);
  perform set_config('mgci.ville_verifiee', '', true);
  select montant into mt from public.commandes where id = cid;
  update public.commandes set ville_depart = left(dep, 80), ville_arrivee = left(arr, 80), meme_ville = meme, transport_regle = regle,
    prix_transport = case when regle = 'a_part' then round(n.prix_transport_final, 0) end,
    total_convenu = case when mt is null or regle = 'mgci' then null when regle = 'a_part' then round(mt, 0) + round(n.prix_transport_final, 0) else round(mt, 0) end
  where id = cid;
  return cid;
end $$;
