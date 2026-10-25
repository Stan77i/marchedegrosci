-- Schéma 99d : gardes de la négociation (contrôle qualité du 25/10/2026 : ANO-044, ANO-045, ANO-048).
--
-- ANO-044 : prix d'au moins 1 F CFA ; quantité entière pour les unités qui se comptent (sac, carton, régime, cageot, unité, tas,
--   pièce, alvéole, caisse, cagette, botte) ; kg, tonne et litre gardent les décimales. Unité d'une annonce : seulement celles
--   que proposent l'application et le site (contrainte « not valid » : les lignes déjà en base ne sont pas contrôlées,
--   0 ligne fautive sur le test, voir le rapport pour la production).
-- ANO-045 : une proposition dont le montant (prix × quantité) dépasse reglages.commandes.montant_max est refusée.
-- ANO-048 : le même texte renvoyé par le même membre juste après (coupure du réseau, moins de 2 minutes, rien d'autre écrit
--   entre-temps) n'est pas écrit une 2e fois.

create or replace function public._unite_entiere(p_unite text) returns boolean
language sql immutable set search_path = public as $$
  select lower(coalesce(p_unite, '')) in ('sac', 'carton', 'régime', 'cageot', 'unité', 'tas', 'pièce', 'alvéole', 'caisse', 'cagette', 'botte');
$$;

do $c$
begin
  if not exists (select 1 from pg_constraint where conname = 'offres_unite_connue') then
    alter table public.offres add constraint offres_unite_connue check (unit is null or unit in
      ('kg', 'sac', 'carton', 'tonne', 'litre', 'régime', 'cageot', 'unité', 'tas', 'pièce', 'alvéole', 'caisse', 'cagette', 'botte')) not valid;
  end if;
  if not exists (select 1 from pg_constraint where conname = 'demandes_unite_connue') then
    alter table public.demandes add constraint demandes_unite_connue check (unit is null or unit in
      ('kg', 'sac', 'carton', 'tonne', 'litre', 'régime', 'cageot', 'unité', 'tas', 'pièce', 'alvéole', 'caisse', 'cagette', 'botte')) not valid;
  end if;
end $c$;

create or replace function public.nego_agir(nego uuid, action text, prix numeric default null, quantite numeric default null, texte text default null, ref uuid default null)
returns void language plpgsql security definer set search_path = public as $$
declare me uuid := auth.uid(); n public.negociations; t text := nullif(btrim(coalesce(texte, '')), ''); recent int;
  a record; q numeric; deja numeric; prop public.messages; mn numeric; pause timestamptz; refus text; mmax numeric; der public.messages;
begin
  select * into n from public.negociations where id = nego for update;
  if n.id is null or me is null or me not in (n.auteur_id, n.proprio_id) then raise exception 'Négociation introuvable.'; end if;
  if action not in ('texte', 'prix', 'accord', 'refus', 'retrait', 'fin') then raise exception 'Action inconnue.'; end if;
  if char_length(t) > 500 then raise exception 'Message trop long (500 caractères au plus).'; end if;
  -- 99d : même texte renvoyé après une coupure : déjà écrit, rien de plus
  if action = 'texte' and t is not null then
    select * into der from public.messages where negociation_id = nego order by created_at desc, id desc limit 1;
    if der.id is not null and der.auteur_id = me and der.genre = 'texte' and der.texte = t and der.created_at > now() - interval '2 minutes' then
      return;
    end if;
  end if;
  select count(*) into recent from public.messages where auteur_id = me and created_at > now() - interval '1 minute';
  if recent >= 20 then raise exception 'Trop de messages d''un coup. Patientez une minute.'; end if;
  if n.dernier_msg is not null then select * into prop from public.messages where id = n.dernier_msg; end if;
  if prop.id is not null and prop.issue = 'en_attente' and n.expire_le <= now() then
    update public.messages set issue = 'expiree' where id = prop.id; prop.issue := 'expiree';
    update public.negociations set dernier_par = null, dernier_msg = null where id = nego; n.dernier_par := null; n.dernier_msg := null;
  end if;

  if action = 'texte' then
    if t is null then raise exception 'Message vide.'; end if;
    insert into public.messages (negociation_id, auteur_id, genre, texte) values (nego, me, 'texte', t);

  elsif n.statut = 'conclue' then
    raise exception 'Cette négociation est conclue : l''accord ne peut plus changer.';

  elsif action = 'prix' then
    if prix is null or prix <= 0 or prix >= 1e9 then raise exception 'Indiquez un prix.'; end if;
    if prix < 1 then raise exception 'Le prix doit être d''au moins 1 F CFA.'; end if;
    if n.statut = 'close' and n.motif_fin = 'arretee' then
      refus := public._nego_arret_refus(n.cible, n.cible_id, me);
      if refus is not null then raise exception '%', refus; end if;
    end if;
    if n.cible = 'offre' then select quantity, status, negociable, price as p, pause_le into a from public.offres where id = n.cible_id;
    else select quantity, status, negociable, budget as p, null::timestamptz as pause_le into a from public.demandes where id = n.cible_id; end if;
    if not found or a.status <> 'active' then raise exception 'Cette annonce n''est plus disponible.'; end if;
    if a.pause_le is not null then raise exception 'ANNONCE_EN_PAUSE : ce vendeur a mis cette offre en pause. Revenez plus tard.'; end if;
    if n.cible = 'offre' and coalesce(a.quantity, 0) <= 0 and not public.est_admin_id(n.proprio_id) then
      raise exception 'Cette offre n''a plus de stock.';
    end if;
    if not a.negociable and me <> n.proprio_id and prix is distinct from a.p then raise exception 'Le prix de cette annonce n''est pas négociable.'; end if;
    q := coalesce(quantite, n.dernier_quantite, a.quantity);
    if q is not null and (q <= 0 or q >= 1e9) then raise exception 'Quantité invalide.'; end if;
    if q is not null and q <> trunc(q) and public._unite_entiere(n.unite) then
      raise exception 'La quantité doit être un nombre entier (unité : %).', n.unite;
    end if;
    if q is not null and a.quantity > 0 and q > a.quantity then raise exception 'Quantité trop grande : l''annonce porte sur % au plus.', a.quantity; end if;
    mmax := public._cmd_montant_max();
    if q is not null and prix * q > mmax then
      raise exception 'MONTANT_MAX : une commande ne peut pas dépasser % F CFA. Proposez une quantité plus petite.', replace(to_char(mmax, 'FM999G999G999G999'), ',', ' ');
    end if;
    if me <> n.proprio_id then
      if n.cible = 'offre' then select o.qte_min into mn from public.offres o where o.id = n.cible_id;
      else select d0.qte_min into mn from public.demandes d0 where d0.id = n.cible_id; end if;
      if mn is not null then
        if a.quantity > 0 then mn := least(mn, a.quantity); end if;
        if q is null or q < mn then
          raise exception '% à partir de % %. Proposez au moins cette quantité.',
            case when n.cible = 'offre' then 'Le vendeur vend' else 'L''acheteur achète' end, replace(trim_scale(mn)::text, '.', ','), coalesce(n.unite, '');
        end if;
      end if;
    end if;
    if prop.id is not null and prop.issue = 'en_attente' then update public.messages set issue = 'remplacee' where id = prop.id; end if;
    insert into public.messages (negociation_id, auteur_id, genre, prix, quantite, texte, issue, expire_le)
    values (nego, me, 'prix', prix, q, t, 'en_attente', now() + interval '48 hours') returning * into prop;
    update public.negociations set statut = 'ouverte', motif_fin = null, dernier_prix = prix, dernier_quantite = q, dernier_par = me,
      dernier_msg = prop.id, expire_le = prop.expire_le where id = nego;

  elsif action in ('accord', 'refus') then
    if prop.id is null or prop.issue <> 'en_attente' then
      raise exception '%', case when prop.issue = 'expiree' then 'Cette proposition a expiré (48 h sans réponse). Faites une nouvelle proposition.' else 'Il n''y a pas de proposition en attente.' end;
    end if;
    if prop.auteur_id = me then raise exception 'Vous ne pouvez pas répondre à votre propre proposition.'; end if;
    if ref is not null and ref <> prop.id then raise exception 'La proposition a changé entre-temps. Relisez la dernière proposition.'; end if;
    if n.statut <> 'ouverte' then raise exception 'Cette négociation est terminée.'; end if;
    if action = 'accord' then
      if n.cible = 'offre' then select quantity, status, pause_le into a from public.offres where id = n.cible_id for update;
      else select quantity, status, null::timestamptz as pause_le into a from public.demandes where id = n.cible_id for update; end if;
      if not found or a.status <> 'active' then raise exception 'Cette annonce n''est plus disponible.'; end if;
      if a.pause_le is not null then raise exception 'ANNONCE_EN_PAUSE : cette offre est en pause. Pas de nouvel accord tant qu''elle l''est.'; end if;
      if n.cible = 'offre' and coalesce(a.quantity, 0) <= 0 and not public.est_admin_id(n.proprio_id) then
        raise exception 'Quantité plus disponible : cette offre n''a plus de stock.';
      end if;
      select coalesce(sum(quantite_finale), 0) into deja from public.negociations where cible = n.cible and cible_id = n.cible_id and statut = 'conclue';
      if a.quantity > 0 and prop.quantite is not null and prop.quantite > a.quantity then
        raise exception 'Quantité plus disponible : il reste % sur cette annonce.', a.quantity;
      end if;
      update public.messages set issue = 'acceptee' where id = prop.id;
      insert into public.messages (negociation_id, auteur_id, genre, prix, quantite, texte) values (nego, me, 'accord', prop.prix, prop.quantite, t);
      update public.negociations set statut = 'conclue', prix_final = prop.prix, quantite_finale = prop.quantite, conditions_finales = prop.texte,
        conclu_le = now(), dernier_par = null, dernier_msg = null, expire_le = null where id = nego;
    else
      update public.messages set issue = 'refusee' where id = prop.id;
      insert into public.messages (negociation_id, auteur_id, genre, prix, quantite, texte) values (nego, me, 'refus', prop.prix, prop.quantite, t);
      update public.negociations set dernier_par = null, dernier_msg = null, expire_le = null where id = nego;
    end if;

  elsif action = 'retrait' then
    if prop.id is null or prop.issue <> 'en_attente' or prop.auteur_id <> me then raise exception 'Vous n''avez pas de proposition en attente à retirer.'; end if;
    update public.messages set issue = 'retiree' where id = prop.id;
    insert into public.messages (negociation_id, auteur_id, genre, prix, quantite, texte) values (nego, me, 'retrait', prop.prix, prop.quantite, t);
    update public.negociations set dernier_par = null, dernier_msg = null, expire_le = null where id = nego;

  elsif action = 'fin' then
    if n.statut <> 'ouverte' then raise exception 'Cette négociation est déjà terminée.'; end if;
    if prop.id is not null and prop.issue = 'en_attente' then update public.messages set issue = 'retiree' where id = prop.id; end if;
    insert into public.messages (negociation_id, auteur_id, genre, texte) values (nego, me, 'fin', t);
    update public.negociations set statut = 'close', motif_fin = 'arretee', dernier_par = null, dernier_msg = null, expire_le = null where id = nego;
  end if;

  update public.negociations set updated_at = now(),
    lu_auteur  = case when me = auteur_id  then now() else lu_auteur end,
    lu_proprio = case when me = proprio_id then now() else lu_proprio end
  where id = nego;
end $$;
