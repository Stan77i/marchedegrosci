-- ═════════ Marché de Gros CI — schéma 97d : litige sans réponse compté à l'acheteur, garde 93 qui prévient, file des notifications à 5 min ═════════
-- Décisions du propriétaire (25/10/2026, « ok pour tout ») :
-- 1. L'acheteur qui ne répond jamais au litige automatique (schéma 97b : commande close en faveur du vendeur) perd des points de
--    fiabilité. Choix le plus proche de l'existant : un « litige perdu » imputé à l'acheteur (schéma 94f, _fiab_litige_perdu),
--    catégorie « litige » de la table annulations. Il compte comme un litige perdu tranché par l'équipe : fiabilité, paliers sur
--    90 jours glissants (_fiab_n90), « litiges perdus » du profil public ; l'acheteur peut le contester comme toute ligne de fiabilité.
--    Pas de rétroactivité : seules les clôtures faites après ce schéma comptent.
--    Si l'acheteur réagit pendant le litige (message, mot secret, refus avec photos), rien ne change : l'équipe tranche (97b).
-- 2. Garde du schéma 93a : quand un téléphone renvoie une quantité plus haute sans avoir vu la quantité du serveur, le serveur garde
--    sa quantité (inchangé) ET le dit : colonne quantite_gardee = true dans la ligne renvoyée (return=representation).
--    L'application affiche « La quantité a changé, vérifiez votre annonce. » et relit l'annonce. La colonne repasse à false à la
--    modification suivante. Les autres changements de la même écriture (prix, texte…) passent toujours.
-- 3. File des notifications (tâche mdg-notif) toutes les 5 minutes au lieu de 15 : le rappel de réception à 30 min (97b) part à
--    l'heure. Les calculs (veille des groupes, actions, relances) gardent leur rythme de 15 min ; le renouvellement reste une fois par heure.
-- Rien n'est effacé. Testé sur le projet de test (supabase/tests/litige-quantites-97-scenarios.sql, bloc L4).

-- ───────── 1. Clôture sans réponse de l'acheteur : litige perdu imputé à l'acheteur
do $$
declare d text;
  a text := $a$    update public.commandes set etat = 'terminee', etape = 'terminee', termine_le = coalesce(termine_le, now()),
      libere_le = now(), liberation = 'auto', montant_refuse = 0 where id = k.id;$a$;
begin
  select pg_get_functiondef('public.commandes_delais()'::regprocedure) into d;
  if position('mdg.fiab_fautif' in d) > 0 then return; end if;   -- déjà fait
  if position(a in d) = 0 then raise exception 'commandes_delais : motif introuvable'; end if;
  d := replace(d, a, $b$    -- l'acheteur n'a pas répondu : « litige perdu » imputé à l'acheteur (déclencheur _fiab_litige_perdu, schéma 94f)
    perform set_config('mdg.fiab_fautif', k.acheteur_id::text, true);
    update public.commandes set etat = 'terminee', etape = 'terminee', termine_le = coalesce(termine_le, now()),
      libere_le = now(), liberation = 'auto', montant_refuse = 0 where id = k.id;
    perform set_config('mdg.fiab_fautif', '', true);$b$);
  execute d;
end $$;

-- ───────── 2. Garde 93 : le serveur garde sa quantité et le signale
alter table public.offres add column if not exists quantite_gardee boolean not null default false;
alter table public.demandes add column if not exists quantite_gardee boolean not null default false;

do $$
declare d text;
  a text := $a$        new.quantity := old.quantity;$a$;
  b text := $a$  c := case when offre then 'offre' else 'demande' end;$a$;
begin
  select pg_get_functiondef('public._annonce_regles()'::regprocedure) into d;
  if position('quantite_gardee' in d) > 0 then return; end if;   -- déjà fait
  if position(a in d) = 0 or position(b in d) = 0 then raise exception '_annonce_regles : motif introuvable'; end if;
  d := replace(d, a, a || $b$
        new.quantite_gardee := true;   -- schéma 97d : l'application prévient le membre$b$);
  d := replace(d, b, $b$  new.quantite_gardee := false;
$b$ || b);
  execute d;
end $$;

-- ───────── 3. Notifications : envoi toutes les 5 minutes, calculs toujours toutes les 15 minutes
create or replace function public.notif_tick()
 returns text
 language plpgsql
 security definer
 set search_path to 'public', 'vault', 'extensions'
as $function$
declare v_url text; v_cle text; nv int := 0; nr int := 0; na int := 0; attente int; rel json; m int := extract(minute from now())::int;
begin
  -- calculs au même rythme qu'avant (un passage sur trois) ; renouvellement une fois par heure
  if m % 15 < 5 then
    nv := public.notif_groupes_veille();
    if m < 5 then nr := public.notif_renouveler_calculer(); end if;
    na := public.notif_actions_calculer();
    begin
      rel := public.notif_relances();
    exception when others then
      rel := json_build_object('erreur', left(sqlerrm, 200));
    end;
  end if;
  select count(*) into attente from public.notif_file f join public.notif_categories c on c.cat = f.cat
  where f.etat = 'attente' and (not public._notif_calme()
    or (c.nature = 'trans' and coalesce(f.type, '') not in ('relance_prix', 'expire_bientot', 'accord_sans_commande', 'demande_fin')));
  if attente = 0 then return format('veille %s, renouveler %s, actions %s, relances %s, rien à envoyer', nv, nr, na, rel); end if;
  select decrypted_secret into v_url from vault.decrypted_secrets where name = 'mdg_push_url';
  select decrypted_secret into v_cle from vault.decrypted_secrets where name = 'mdg_push_cle';
  if v_url is null or v_cle is null then return format('veille %s, renouveler %s, actions %s, relances %s, %s en attente, pas de clé', nv, nr, na, rel, attente); end if;
  perform net.http_post(url := v_url, body := jsonb_build_object('lots', true),
    headers := jsonb_build_object('Content-Type', 'application/json', 'x-mdg-cle', v_cle), timeout_milliseconds := 60000);
  return format('veille %s, renouveler %s, actions %s, relances %s, %s en attente, envoi demandé', nv, nr, na, rel, attente);
end $function$;

select cron.schedule('mdg-notif', '*/5 * * * *', 'select public.notif_tick()');
