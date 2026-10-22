-- ═════════ Marché de Gros CI — schéma 60 : les échanges ne sont pas secrets, l'équipe peut tout lire pour juger ═════════
-- Demandé par le propriétaire le 22/10/2026 : « Il n'y a pas de conversation secrète. C'est sur notre plateforme, c'est nous qui
-- mettons en relation. Pour pouvoir juger, il faut que toutes les conversations sortent. »
--   • Les messages directs ne s'effacent plus au bout de 7 jours : ils sont gardés 1 AN (dm_duree), le temps de régler un litige.
--     (Les messages déjà effacés par l'ancienne règle ne peuvent pas être retrouvés.)
--     Place : ≈ 0,5 Ko par message ; les 500 Mo de la base gratuite tiennent environ un million de messages.
--   • Avec le numéro de commande, l'équipe voit tout : l'accord, l'historique, la négociation complète (chaque prix proposé,
--     chaque message) et les messages directs entre l'acheteur et le vendeur (admin_commande_numero).
--   • Les membres en sont informés dans l'application (Messages, Réglages → Confidentialité, litiges).
-- Appliqué par Claude avec l'outil Supabase. Aucun drop, aucune donnée effacée (au contraire : on efface moins).

create or replace function public.dm_duree() returns interval
language sql immutable set search_path = public as $$ select interval '365 days' $$;

create or replace function public.admin_commande_numero(p_numero text) returns json
language plpgsql stable security definer set search_path = public as $$
declare c public.commandes;
begin
  if not public.est_admin() then raise exception 'Réservé à l''administration.'; end if;
  select * into c from public.commandes where upper(numero) = upper(btrim(coalesce(p_numero, '')));
  if c.id is null then return null; end if;
  return json_build_object('id', c.id, 'numero', c.numero, 'etat', c.etat, 'etape', c.etape, 'produit', c.produit, 'quantite', c.quantite, 'unite', c.unite,
    'prix_unitaire', c.prix_unitaire, 'montant', c.montant, 'mode_transport', c.mode_transport, 'validation', c.validation,
    'ville_depart', c.ville_depart, 'lieu_livraison', c.lieu_livraison, 'cree_le', c.created_at, 'termine_le', c.termine_le, 'mot_secret', c.mot_secret,
    'vendeur', coalesce(public.nom_public(c.vendeur_id), 'Membre'), 'acheteur', coalesce(public.nom_public(c.acheteur_id), 'Membre'),
    'negociation', (select json_build_object('prix_final', n.prix_final, 'quantite_finale', n.quantite_finale, 'transport_final', n.transport_final, 'conditions_finales', n.conditions_finales, 'statut', n.statut, 'conclu_le', n.conclu_le)
                    from public.negociations n where n.id = c.negociation_id),
    -- la négociation complète : chaque proposition de prix et chaque message, dans l'ordre
    'conversation', (select coalesce(json_agg(json_build_object('at', m.created_at, 'genre', m.genre, 'prix', m.prix, 'quantite', m.quantite, 'texte', m.texte,
                       'role', case when m.auteur_id = c.vendeur_id then 'vendeur' when m.auteur_id = c.acheteur_id then 'acheteur' else 'autre' end) order by m.created_at), '[]'::json)
                     from public.messages m where m.negociation_id = c.negociation_id),
    -- les messages directs entre l'acheteur et le vendeur
    'messages_directs', (select coalesce(json_agg(json_build_object('at', m.created_at, 'texte', m.texte,
                       'role', case when m.auteur_id = c.vendeur_id then 'vendeur' when m.auteur_id = c.acheteur_id then 'acheteur' else 'autre' end) order by m.created_at), '[]'::json)
                     from public.dm m join public.discussions d on d.id = m.discussion_id
                     where (d.a_id = c.vendeur_id and d.b_id = c.acheteur_id) or (d.a_id = c.acheteur_id and d.b_id = c.vendeur_id)),
    'discussion_litige', (select coalesce(json_agg(json_build_object('at', m.at, 'role', m.role, 'texte', m.texte) order by m.at), '[]'::json)
                     from public.litige_messages m where m.commande_id = c.id),
    'sequestre', public.commande_sequestre(c.id),
    'journal', (select coalesce(json_agg(j), '[]'::json) from public.commande_journal(c.id) j));
end $$;
revoke execute on function public.admin_commande_numero(text) from public, anon;
grant execute on function public.admin_commande_numero(text) to authenticated;
