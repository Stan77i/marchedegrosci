-- ═════════ Schéma 65 (23/10/2026) — « Le camion est parti » : une étape à part, signalée par le vendeur ou détectée par le lien ═════════
-- Règle du propriétaire : simple. Le chauffeur ouvre le lien de suivi (le code ne sert qu'en secours). S'il ne l'utilise pas,
-- c'est le vendeur (ou celui qui s'occupe du transport) qui indique les étapes : chargement confirmé, puis « le camion est parti ».
--   • avec son propre transporteur, « Chargement confirmé » ne lance plus le transport tout seul : la commande reste « Chargée » ;
--   • « Le camion est parti » (p_etape = 'transport') : par le vendeur ou par celui qui s'occupe du transport ;
--   • si le chauffeur partage sa position par le lien, le départ est DÉTECTÉ tout seul dès 500 m parcourus depuis le chargement ;
--   • personne n'a rien signalé ? l'acheteur peut quand même signaler l'arrivée et confirmer la réception : rien ne reste bloqué ;
--   • transporteur du réseau : rien ne change (son code de prise en charge lance le transport).
-- Aucun « drop » : create or replace seulement. Les anciennes versions de l'application montrent « Chargée » sans bouton de départ :
-- l'acheteur peut toujours signaler l'arrivée et confirmer la réception.

-- 1) commande_avancer
create or replace function public.commande_avancer(p_id uuid, p_etape text, p_lieu text default null,
  p_lat double precision default null, p_lon double precision default null, p_note text default null) returns text
language plpgsql volatile security definer set search_path = public as $$
declare me uuid := auth.uid(); c public.commandes; r text; lieu text; nt text; pv text;
begin
  select * into c from public.commandes where id = p_id for update;
  r := public._cmd_role2(c, me);
  if c.id is null or r is null then raise exception 'Commande introuvable.'; end if;
  if public.est_banni(me) then raise exception 'COMPTE_BANNI : ce compte a été banni du Marché de Gros.'; end if;
  if c.etat <> 'en_cours' then raise exception 'Cette commande n''est pas en cours.'; end if;
  if c.validation = 'code' and p_etape = 'chargement' then raise exception 'Commande avec codes : le chauffeur tape le code de prise en charge que lui donne le vendeur.'; end if;
  if c.validation = 'code' and p_etape = 'reception' then raise exception 'Commande avec codes : le chauffeur tape le code de réception que lui donne l''acheteur.'; end if;
  if c.validation = 'declaration' and c.mode_transport <> 'reseau' and p_etape = 'reception' then
    raise exception 'MOT_REQUIS : pour confirmer la réception, tapez le mot secret du vendeur trouvé dans la marchandise. Mettez l''application à jour si vous ne voyez pas la case.';
  end if;
  if (p_lat is null) <> (p_lon is null) or (p_lat is not null and (p_lat not between -90 and 90 or p_lon not between -180 and 180)) then
    raise exception 'Position invalide.';
  end if;
  lieu := public._cmd_texte(p_lieu, 120); nt := public._cmd_texte(p_note, 300);
  pv := case when p_lat is not null then 'gps' else 'declaration' end;
  if p_etape = 'preparation' then
    if r <> 'vendeur' then raise exception 'C''est le vendeur qui prépare la marchandise.'; end if;
    if c.etape <> 'confirmee' then raise exception 'Étape déjà passée.'; end if;
  elsif p_etape = 'chargement' then
    if r <> 'vendeur' then raise exception 'C''est le vendeur qui confirme le chargement.'; end if;
    if c.etape not in ('confirmee', 'preparation') then raise exception 'Le chargement est déjà confirmé.'; end if;
  elsif p_etape = 'transport' then
    -- schéma 65 : « Le camion est parti », par le vendeur ou par celui qui s'occupe du transport
    if c.mode_transport = 'reseau' then raise exception 'Avec le transporteur du réseau, le départ suit son code de prise en charge.'; end if;
    if r <> 'vendeur' and r <> c.mode_transport then raise exception 'C''est le vendeur ou celui qui s''occupe du transport qui signale le départ.'; end if;
    if c.etape <> 'chargement' then raise exception 'Confirmez d''abord le chargement.'; end if;
  elsif p_etape = 'transbordement' then
    if c.etape not in ('transport', 'transbordement') then raise exception 'Le transbordement se signale pendant le transport.'; end if;
    if lieu is null then raise exception 'Indiquez le lieu du transbordement.'; end if;
  elsif p_etape = 'arrivee' then
    if r not in ('acheteur', 'chauffeur') then raise exception 'C''est l''acheteur ou le chauffeur qui signale l''arrivée.'; end if;
    if c.etape not in ('chargement', 'transport', 'transbordement') then raise exception 'Le chauffeur doit d''abord être en route.'; end if;
  elsif p_etape = 'reception' then
    if r <> 'acheteur' then raise exception 'C''est l''acheteur qui confirme la réception.'; end if;
    if c.etape not in ('chargement', 'transport', 'transbordement', 'arrivee') then raise exception 'La marchandise doit d''abord être chargée.'; end if;
  else
    raise exception 'Étape inconnue.';
  end if;
  update public.commandes set etape = p_etape where id = p_id;
  perform public._cmd_journal(p_id, p_etape, me, r, pv, lieu, p_lat, p_lon, nt);
  if p_etape = 'chargement' and c.mode_transport = 'reseau' then   -- schéma 65 : avec son propre transporteur, on attend « Le camion est parti »
    update public.commandes set etape = 'transport' where id = p_id;
    perform public._cmd_journal(p_id, 'transport', null, 'systeme', 'auto');
    return 'transport';
  elsif p_etape = 'reception' then
    update public.commandes set etape = 'terminee', etat = 'terminee', termine_le = now() where id = p_id;
    perform public._cmd_journal(p_id, 'terminee', null, 'systeme', 'auto');
    return 'terminee';
  end if;
  return p_etape;
end $$;

-- 2) commande_reception_mot : aussi depuis « Chargée »
create or replace function public.commande_reception_mot(p_id uuid, p_mot text default null, p_sans_mot boolean default false,
  p_lat double precision default null, p_lon double precision default null, p_note text default null) returns text
language plpgsql volatile security definer set search_path = public as $$
declare me uuid := auth.uid(); c public.commandes; r text; nt text; sans boolean := coalesce(p_sans_mot, false);
begin
  select * into c from public.commandes where id = p_id for update;
  r := public._cmd_role2(c, me);
  if c.id is null or r is null then raise exception 'Commande introuvable.'; end if;
  if public.est_banni(me) then raise exception 'COMPTE_BANNI : ce compte a été banni du Marché de Gros.'; end if;
  if c.etat <> 'en_cours' then raise exception 'Cette commande n''est pas en cours.'; end if;
  if r <> 'acheteur' then raise exception 'C''est l''acheteur qui confirme la réception.'; end if;
  if c.validation = 'code' then raise exception 'Commande avec codes : le chauffeur tape le code de réception que lui donne l''acheteur.'; end if;
  if c.etape not in ('chargement', 'transport', 'transbordement', 'arrivee') then raise exception 'La marchandise doit d''abord être chargée.'; end if;
  if (p_lat is null) <> (p_lon is null) or (p_lat is not null and (p_lat not between -90 and 90 or p_lon not between -180 and 180)) then
    raise exception 'Position invalide.';
  end if;
  if not sans then
    if public._mot_norme(p_mot) = '' then raise exception 'Tapez le mot secret écrit sur le papier glissé dans la marchandise.'; end if;
    if c.mot_secret is null or public._mot_norme(p_mot) <> public._mot_norme(c.mot_secret) then
      raise exception 'MOT_FAUX : ce n''est pas le mot secret du vendeur. Vérifiez le papier glissé dans la marchandise.';
    end if;
  end if;
  nt := public._cmd_texte(p_note, 240);
  update public.commandes set etape = 'reception' where id = p_id;
  perform public._cmd_journal(p_id, 'reception', me, 'acheteur', case when sans then 'declaration' else 'code' end, null, p_lat, p_lon,
    case when sans then 'Réception confirmée sans le mot secret du vendeur' else 'Mot secret du vendeur retrouvé dans la marchandise' end || coalesce(' · ' || nt, ''));
  update public.commandes set etape = 'terminee', etat = 'terminee', termine_le = now() where id = p_id;
  perform public._cmd_journal(p_id, 'terminee', null, 'systeme', 'auto');
  return 'terminee';
end $$;

-- le lien de suivi : départ détecté à 500 m du premier point reçu après le chargement
create or replace function public.suivi_lien_position(p_jeton text, p_lat double precision, p_lon double precision, p_precision real default null) returns json
language plpgsql volatile security definer set search_path = public as $$
declare l public.suivi_liens; c public.commandes; der timestamptz; t0 timestamptz; p0 record; d double precision;
begin
  select * into l from public.suivi_liens where jeton = p_jeton;
  if l.jeton is null or not l.actif or l.expire_le <= now() then
    return json_build_object('ok', false, 'arreter', true, 'message', 'Ce lien n''est plus valable.'); end if;
  select * into c from public.commandes where id = l.commande_id;
  if c.etat <> 'en_cours' or c.etape in ('reception', 'terminee') then
    return json_build_object('ok', false, 'arreter', true, 'message', 'La livraison est terminée : merci, le partage s''arrête.'); end if;
  if p_lat is null or p_lon is null or p_lat not between -90 and 90 or p_lon not between -180 and 180 then raise exception 'Position invalide.'; end if;
  update public.suivi_liens set vu_le = now() where jeton = l.jeton;
  select max(at) into der from public.positions where commande_id = c.id;
  if der is not null and der > now() - interval '15 seconds' then return json_build_object('ok', false, 'arreter', false, 'message', 'trop tôt'); end if;
  insert into public.positions (commande_id, transporteur_id, lat, lon, precision_m) values (c.id, null, p_lat, p_lon, p_precision);
  if c.etape = 'chargement' and c.mode_transport <> 'reseau' then
    select max(at) into t0 from public.commande_etapes where commande_id = c.id and evenement = 'chargement';
    select lat, lon into p0 from public.positions where commande_id = c.id and at >= coalesce(t0, now()) order by at limit 1;
    if p0.lat is not null then
      d := 2 * 6371000 * asin(sqrt(power(sin(radians(p_lat - p0.lat) / 2), 2) + cos(radians(p0.lat)) * cos(radians(p_lat)) * power(sin(radians(p_lon - p0.lon) / 2), 2)));
      if d >= 500 then
        update public.commandes set etape = 'transport' where id = c.id;
        perform public._cmd_journal(c.id, 'transport', null, 'systeme', 'gps', null, p_lat, p_lon, 'Départ détecté par le lien de suivi du chauffeur');
      end if;
    end if;
  end if;
  return json_build_object('ok', true, 'arreter', false);
end $$;

-- notifications : le départ signalé (par une personne, ou détecté par le lien) prévient l'autre partie ; le passage automatique reste muet
create or replace function public.push_commande() returns trigger
language plpgsql security definer set search_path = public, vault, extensions as $$
declare v_url text; v_cle text;
begin
  if new.evenement = 'terminee' or (new.evenement = 'transport' and new.preuve = 'auto') then return new; end if;
  select decrypted_secret into v_url from vault.decrypted_secrets where name = 'mdg_push_url';
  select decrypted_secret into v_cle from vault.decrypted_secrets where name = 'mdg_push_cle';
  if v_url is null or v_cle is null then return new; end if;
  perform net.http_post(url := v_url, body := jsonb_build_object('commande_etape_id', new.id),
    headers := jsonb_build_object('Content-Type', 'application/json', 'x-mdg-cle', v_cle), timeout_milliseconds := 8000);
  return new;
exception when others then return new;
end $$;
