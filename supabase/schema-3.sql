-- ═════════ Marché de Gros CI — étape 3 : négociation complète (12 octobre 2026) ═════════
-- À lancer APRÈS schema.sql et schema-2.sql. Peut être relancé sans danger.
--
-- Une négociation porte sur une annonce (offre ou demande) entre son auteur et une autre personne.
-- Chaque proposition (prix, quantité, conditions) est un message de genre 'prix' qui a son propre sort :
--   en_attente → acceptee | refusee | retiree | remplacee (contre-proposition) | expiree (48 h sans réponse).
-- État de la négociation : ouverte | conclue | close (motif_fin : arretee, annonce_retiree).
-- L'accord enregistre un instantané figé (prix_final, quantite_finale, conditions_finales, conclu_le) que plus rien ne modifie.
-- Un accord n'est ni un paiement ni une livraison.

-- ——— L'auteur d'une annonce peut refuser les propositions de prix ———
alter table public.offres   add column if not exists negociable boolean not null default true;
alter table public.demandes add column if not exists negociable boolean not null default true;

-- ——— Colonnes de la négociation ———
alter table public.negociations add column if not exists dernier_quantite   numeric;
alter table public.negociations add column if not exists dernier_msg        uuid;
alter table public.negociations add column if not exists expire_le          timestamptz;
alter table public.negociations add column if not exists quantite_finale    numeric;
alter table public.negociations add column if not exists conditions_finales text;
alter table public.negociations add column if not exists conclu_le          timestamptz;
alter table public.negociations add column if not exists motif_fin          text check (motif_fin in ('arretee', 'annonce_retiree'));
alter table public.messages add column if not exists quantite  numeric check (quantite is null or (quantite > 0 and quantite < 1e9));
alter table public.messages add column if not exists issue     text check (issue in ('en_attente', 'acceptee', 'refusee', 'retiree', 'remplacee', 'expiree'));
alter table public.messages add column if not exists expire_le timestamptz;
alter table public.messages drop constraint if exists messages_genre_check;
alter table public.messages add constraint messages_genre_check check (genre in ('texte', 'prix', 'accord', 'refus', 'fin', 'retrait'));
create index if not exists nego_cible on public.negociations (cible, cible_id);

-- ——— L'accord est figé ———
create or replace function public.nego_fige() returns trigger
language plpgsql set search_path = public as $$
begin
  if old.statut = 'conclue' and (new.statut <> 'conclue' or new.prix_final is distinct from old.prix_final
     or new.quantite_finale is distinct from old.quantite_finale or new.conditions_finales is distinct from old.conditions_finales
     or new.conclu_le is distinct from old.conclu_le) then
    raise exception 'Un accord conclu ne peut plus être modifié.';
  end if;
  return new;
end $$;
drop trigger if exists negociation_figee on public.negociations;
create trigger negociation_figee before update on public.negociations for each row execute function public.nego_fige();

-- ——— Annonce retirée ou masquée : les négociations ouvertes se ferment (les accords restent) ———
create or replace function public.nego_annonce_retiree() returns trigger
language plpgsql security definer set search_path = public as $$
declare c text := case when tg_table_name = 'offres' then 'offre' else 'demande' end;
begin
  if tg_op = 'DELETE' or new.status <> 'active' then
    update public.negociations set statut = 'close', motif_fin = 'annonce_retiree', updated_at = now()
    where cible = c and cible_id = old.id and statut = 'ouverte';
    update public.messages set issue = 'retiree' where issue = 'en_attente'
      and negociation_id in (select id from public.negociations where cible = c and cible_id = old.id);
  end if;
  return coalesce(new, old);
end $$;
drop trigger if exists offres_nego on public.offres;
drop trigger if exists demandes_nego on public.demandes;
create trigger offres_nego   after update of status or delete on public.offres   for each row execute function public.nego_annonce_retiree();
create trigger demandes_nego after update of status or delete on public.demandes for each row execute function public.nego_annonce_retiree();

-- ——— Ouvrir (ou relancer) une négociation par une proposition ———
create or replace function public.nego_ouvrir(cible text, cible_id uuid, prix numeric, quantite numeric default null, texte text default null) returns uuid
language plpgsql volatile security definer set search_path = public as $$
declare me uuid := auth.uid(); a record; n uuid; ouvertes int;
begin
  if me is null then raise exception 'Connectez-vous pour proposer un prix.'; end if;
  if cible = 'offre' then
    select user_id, product_label, city, unit, quantity, price as p, status, negociable into a from public.offres where id = cible_id;
  elsif cible = 'demande' then
    select user_id, product_label, city, unit, quantity, budget as p, status, negociable into a from public.demandes where id = cible_id;
  else raise exception 'Annonce inconnue.'; end if;
  if not found or a.status <> 'active' then raise exception 'Cette annonce n''est plus disponible.'; end if;
  if a.user_id = me then raise exception 'C''est votre propre annonce.'; end if;
  if not a.negociable and (prix is distinct from a.p) then raise exception 'Le prix de cette annonce n''est pas négociable : vous pouvez proposer le prix affiché.'; end if;
  select count(*) into ouvertes from public.negociations where auteur_id = me and created_at > now() - interval '1 day';
  if ouvertes >= 40 then raise exception 'Limite atteinte : 40 négociations ouvertes par jour.'; end if;
  insert into public.negociations (cible, cible_id, auteur_id, proprio_id, produit, ville, unite, quantite, prix_annonce)
  values (cible, cible_id, me, a.user_id, a.product_label, a.city, a.unit, a.quantity, a.p)
  on conflict on constraint negociations_cible_cible_id_auteur_id_key do nothing
  returning id into n;
  if n is null then select g.id into n from public.negociations g where g.cible = nego_ouvrir.cible and g.cible_id = nego_ouvrir.cible_id and g.auteur_id = me; end if;
  perform public.nego_agir(n, 'prix', prix, quantite, texte, null);
  return n;
end $$;

-- ——— Agir dans une négociation ———
-- action : 'texte' | 'prix' (proposition ou contre-proposition) | 'accord' | 'refus' | 'retrait' (retirer sa proposition) | 'fin'
-- ref : la proposition à laquelle on répond (accord, refus) — si elle a changé entre-temps, l'action est refusée.
create or replace function public.nego_agir(nego uuid, action text, prix numeric default null, quantite numeric default null, texte text default null, ref uuid default null) returns void
language plpgsql volatile security definer set search_path = public as $$
declare me uuid := auth.uid(); n public.negociations; t text := nullif(btrim(coalesce(texte, '')), ''); recent int;
  a record; q numeric; deja numeric; prop public.messages;
begin
  select * into n from public.negociations where id = nego for update;
  if n.id is null or me is null or me not in (n.auteur_id, n.proprio_id) then raise exception 'Négociation introuvable.'; end if;
  if action not in ('texte', 'prix', 'accord', 'refus', 'retrait', 'fin') then raise exception 'Action inconnue.'; end if;
  if char_length(t) > 500 then raise exception 'Message trop long (500 caractères au plus).'; end if;
  select count(*) into recent from public.messages where auteur_id = me and created_at > now() - interval '1 minute';
  if recent >= 20 then raise exception 'Trop de messages d''un coup. Patientez une minute.'; end if;
  if n.dernier_msg is not null then select * into prop from public.messages where id = n.dernier_msg; end if;
  -- une proposition sans réponse depuis 48 h expire
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
    if n.cible = 'offre' then select quantity, status, negociable, price as p into a from public.offres where id = n.cible_id;
    else select quantity, status, negociable, budget as p into a from public.demandes where id = n.cible_id; end if;
    if not found or a.status <> 'active' then raise exception 'Cette annonce n''est plus disponible.'; end if;
    if not a.negociable and me <> n.proprio_id and prix is distinct from a.p then raise exception 'Le prix de cette annonce n''est pas négociable.'; end if;
    q := coalesce(quantite, n.dernier_quantite, a.quantity);
    if q is not null and (q <= 0 or q >= 1e9) then raise exception 'Quantité invalide.'; end if;
    if q is not null and a.quantity > 0 and q > a.quantity then raise exception 'Quantité trop grande : l''annonce porte sur % au plus.', a.quantity; end if;
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
      if n.cible = 'offre' then select quantity, status into a from public.offres where id = n.cible_id;
      else select quantity, status into a from public.demandes where id = n.cible_id; end if;
      if not found or a.status <> 'active' then raise exception 'Cette annonce n''est plus disponible.'; end if;
      -- plusieurs acheteurs sur une même offre : on ne promet pas plus que la quantité annoncée
      select coalesce(sum(quantite_finale), 0) into deja from public.negociations where cible = n.cible and cible_id = n.cible_id and statut = 'conclue';
      if a.quantity > 0 and prop.quantite is not null and deja + prop.quantite > a.quantity then
        raise exception 'Quantité plus disponible : % déjà convenus sur %, il reste %.', deja, a.quantity, greatest(a.quantity - deja, 0);
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

-- ——— Ce qui reste d'une annonce (pour l'auteur de l'annonce et ceux qui négocient dessus) ———
create or replace function public.nego_dispo(cible text, cible_id uuid)
returns table (quantite numeric, convenue numeric, accords bigint, en_cours bigint)
language plpgsql stable security definer set search_path = public as $$
declare me uuid := auth.uid(); proprio uuid;
begin
  if nego_dispo.cible = 'offre' then select o.user_id, o.quantity into proprio, quantite from public.offres o where o.id = nego_dispo.cible_id;
  else select d.user_id, d.quantity into proprio, quantite from public.demandes d where d.id = nego_dispo.cible_id; end if;
  if me is null or (me is distinct from proprio and not exists (select 1 from public.negociations g where g.cible = nego_dispo.cible and g.cible_id = nego_dispo.cible_id and g.auteur_id = me)) then
    raise exception 'Accès refusé.';
  end if;
  select coalesce(sum(g.quantite_finale), 0), count(*) filter (where g.statut = 'conclue'), count(*) filter (where g.statut = 'ouverte')
    into convenue, accords, en_cours from public.negociations g where g.cible = nego_dispo.cible and g.cible_id = nego_dispo.cible_id;
  return next;
end $$;

-- ——— Les anciennes fonctions (étape 2) ne sont plus appelables ———
revoke execute on function public.proposer_prix(text, uuid, numeric, text), public.negocier(uuid, text, numeric, text) from public, anon, authenticated;
revoke execute on function public.nego_fige(), public.nego_annonce_retiree() from public, anon, authenticated;
revoke execute on function public.nego_ouvrir(text, uuid, numeric, numeric, text), public.nego_agir(uuid, text, numeric, numeric, text, uuid), public.nego_dispo(text, uuid) from public, anon;
grant execute on function public.nego_ouvrir(text, uuid, numeric, numeric, text), public.nego_agir(uuid, text, numeric, numeric, text, uuid), public.nego_dispo(text, uuid) to authenticated;
