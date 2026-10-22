-- ═════════ Marché de Gros CI — schéma 50 : pas de commission transport quand le vendeur a inclus le transport ═════════
-- Demandé par le propriétaire le 22/10/2026 : « si le gars a dit que le transport est inclus, nous, on n'a plus rien à voir dedans.
-- On facture uniquement sur le prix du vendeur. » La commission de 6,9 % (schéma 42) ne vaut que pour un transport
-- organisé par le Marché de Gros (transporteur inscrit) quand le transport N'EST PAS compris dans le prix du vendeur.
-- La commission de 3,5 % (schéma 30) porte déjà sur le seul montant de la vente : rien à changer.
-- Appliqué par Claude avec l'outil Supabase. Aucun drop, aucune donnée effacée : une ligne déjà prévue passe « annulee », avec le motif au journal.

-- le transport de cette commande est-il compris dans le prix du vendeur ? (accord de la négociation d'abord, sinon l'annonce)
create or replace function public._cmd_transport_inclus(p_cmd uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce((select coalesce(n.transport_final, public._transport_vendeur(n.cible, n.cible_id))
                   from public.commandes c join public.negociations n on n.id = c.negociation_id
                   where c.id = p_cmd), false)
$$;
revoke execute on function public._cmd_transport_inclus(uuid) from public, anon, authenticated;

do $$ declare d text; begin
  d := pg_get_functiondef('public._ctr_sync(uuid)'::regprocedure);
  if position('_cmd_transport_inclus' in d) > 0 then return; end if;
  d := replace(d, $q$  if m.statut <> 'acceptee' or m.prix is null then$q$,
    $q$  if m.statut <> 'acceptee' or m.prix is null or public._cmd_transport_inclus(m.commande_id) then$q$);
  d := replace(d, $q$'mission ' || m.statut || (case when m.prix is null then ', sans prix' else '' end)$q$,
    $q$(case when public._cmd_transport_inclus(m.commande_id) then 'transport inclus dans le prix du vendeur' else 'mission ' || m.statut || (case when m.prix is null then ', sans prix' else '' end) end)$q$);
  if position('_cmd_transport_inclus' in d) = 0 then raise exception '_ctr_sync : motif introuvable'; end if;
  execute d;
end $$;

-- lignes déjà enregistrées pour une commande à transport inclus : on les passe « annulee » (le journal garde la trace)
do $$ declare mid uuid; begin
  for mid in select ct.mission_id from public.commissions_transport ct
             where ct.statut <> 'annulee' and public._cmd_transport_inclus(ct.commande_id) loop
    perform public._ctr_sync(mid);
  end loop;
end $$;
