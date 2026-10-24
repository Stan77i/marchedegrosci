-- Schéma 83d : chantier 1, filtre des numéros renforcé.
-- Appliqué sur le projet de TEST le 24/10/2026. Pas encore en production.
-- Repère aussi : les chiffres écrits en lettres (« zéro sept quarante-cinq… »), les séparateurs doubles (07 / 45 - 12…),
-- +225 ou 00225 sans le 0, et un numéro coupé en plusieurs messages.
-- S'étend aux messages de litige (déclencheur sur litige_messages). Les notes de commande passent déjà par texte_refus (_cmd_texte).
-- L'alerte d'un message de litige ne s'enregistre que si alertes accepte la source 'litige' : voir la question laissée au propriétaire.

-- chiffres en lettres → chiffres (« zéro sept quarante cinq » → « 0 7 45 ») ; les autres mots restent tels quels
create or replace function public._chiffres_lettres(t text)
 returns text
 language plpgsql
 immutable
 set search_path to 'public'
as $function$
declare w0 text; w text; o text := ''; cur int; v int;
begin
  if t is null then return null; end if;
  foreach w0 in array regexp_split_to_array(btrim(regexp_replace(t, '([[:alpha:]])-+([[:alpha:]])', '\1 \2', 'g')), '\s+') loop
    w := regexp_replace(lower(translate(w0, 'ÀÂÄÉÈÊËÎÏÔÖÙÛÜÇàâäéèêëîïôöùûüç', 'AAAEEEEIIOOUUUCaaaeeeeiioouuuc')), '[.,;:!?]+$', '');
    v := case w when 'zero' then 0 when 'un' then 1 when 'une' then 1 when 'deux' then 2 when 'trois' then 3 when 'quatre' then 4
      when 'cinq' then 5 when 'six' then 6 when 'sept' then 7 when 'huit' then 8 when 'neuf' then 9
      when 'dix' then 10 when 'onze' then 11 when 'douze' then 12 when 'treize' then 13 when 'quatorze' then 14 when 'quinze' then 15 when 'seize' then 16
      when 'vingt' then 20 when 'vingts' then 20 when 'trente' then 30 when 'quarante' then 40 when 'cinquante' then 50 when 'soixante' then 60 end;
    if w = 'et' and cur is not null then continue; end if;
    if v is null then
      if cur is not null then o := o || ' ' || cur::text; cur := null; end if;
      o := o || ' ' || w0;
    elsif cur is null then cur := v;
    elsif cur = 4 and v = 20 then cur := 80;
    elsif cur in (60, 80) and v between 1 and 19 then cur := cur + v;
    elsif cur in (10, 20, 30, 40, 50, 60, 70, 80, 90) and v between 1 and 9 then cur := cur + v;
    else o := o || ' ' || cur::text; cur := v;
    end if;
  end loop;
  if cur is not null then o := o || ' ' || cur::text; end if;
  return btrim(o);
end $function$;

-- un numéro de Côte d'Ivoire, avec ou sans indicatif, séparateurs simples ou doubles
create or replace function public._num_motif()
 returns text
 language sql
 immutable
 set search_path to 'public'
as $function$
  select '((\+|00)\s*225([\s.\-_/·]{0,4}[0-9]){8,10}|(\+?\s*225[\s.\-_/·]*)?0[\s.\-_/·]{0,4}[1-9]([\s.\-_/·]{0,4}[0-9]){8})'
$function$;

create or replace function public.sortie_masquer(t text)
 returns text
 language plpgsql
 immutable
 set search_path to 'public'
as $function$
declare r text;
begin
  if t is null then return null; end if;
  r := regexp_replace(t, public._num_motif(), '[numéro masqué]', 'g');
  if public._chiffres_lettres(r) ~ public._num_motif() then
    r := regexp_replace(public._chiffres_lettres(r), public._num_motif(), '[numéro masqué]', 'g');
  end if;
  return r;
end $function$;

create or replace function public.sortie_motif(t text)
 returns text
 language sql
 immutable
 set search_path to 'public'
as $function$
  select case
    when t ~ public._num_motif() then 'numéro de téléphone'
    when public._chiffres_lettres(t) ~ public._num_motif() then 'numéro de téléphone en lettres'
    when t ~* '(whats\s*app|watsap|watsapp|wa\.me|wtsp|telegram|t\.me/|messenger|signal\s*app|\mimo\M|viber)' then 'autre messagerie'
    when t ~* '(https?://|www\.|facebook\.com|fb\.com|instagram\.com|tiktok\.com)' then 'lien vers un autre site'
    else null end;
$function$;

-- texte_refus (profils, annonces, notes de commande, litiges) : refuse aussi un numéro écrit en lettres
create or replace function public.texte_refus(t text)
 returns text
 language sql
 immutable
 set search_path to 'public'
as $function$
  select case
    when t is null or btrim(t) = '' then null
    when t ~* '[a-z0-9._%+-]+\s?(@|\(at\)|\[at\])\s?[a-z0-9-]+\s?\.\s?[a-z]{2,}'
      then 'Pas d’adresse e-mail ici : pour votre sécurité, échangez uniquement dans l’application.'
    when t ~* '(h\s*t\s*t\s*p\s*s?\s*:\s*/\s*/|\mwww\s*\.|\mwww\M)'
      or t ~* '\m[a-z0-9-]*[a-z][a-z0-9-]*(\s?\.|\s?(\(\.\)|\[\.\]|\(dot\)|\[dot\])\s?)(com|net|org|ci|fr|info|biz|io|me|ly|app|xyz|site|online|shop|store|link|click|top|africa|gl|gd|to|cc|tv|page|dev|live|club|vip|pro|be|ch|ca|us|uk|gg|ws|im|sn|cm|bf|ml|tg|bj|gh|ng)\M'
      or t ~* '\m(point|dot)\s+(com|net|org|info)\M'
      then 'Pas de lien ici : pour votre sécurité, les adresses de sites (www, .com, .ci…) sont interdites sur le Marché de Gros, même la nôtre. Échangez uniquement dans l’application.'
    when t ~* '(\m(face\s*-?\s*book|fb|fbk|f\s*\.\s*b|insta|instagram|instagr\w*|tik\s*-?\s*tok|tiktok|snap|snapchat|whats?\s*-?\s*app?|wh?ats?\s*app+|wh?atsap+|whatsap+|wasap+|watsap+|wtsp|whtsp|wsp|t[eé]l[eé]gram+|messenger|youtube|you\s*tube|linked\s*in|linkedin|twitter|threads)\M|\m(sur|mon|ma|via|par|en)\s+(wa|signal|ig|x)\M|(^|[\s(:])@[a-z0-9_.]{3,})'
      then 'Pas de réseaux sociaux ici (Facebook, WhatsApp, Instagram, TikTok…) : pour votre sécurité, échangez uniquement dans l’application.'
    when t ~* '(\*\s*\d{2,4}\s*(\*\s*\d*\s*)*#|#\s*\d{3}\s*#)'
      then 'Pas de code de transfert à taper (*144*…#) : c’est une ruse fréquente pour faire envoyer de l’argent. Ne payez qu’à la livraison, après avoir vu la marchandise.'
    when t ~* '((\+|00)\s*225([\s.\-]*\d){8,10}|\m(0[157]|2[157])([\s.\-]*\d){8}\M)'
      or t ~ public._num_motif() or public._chiffres_lettres(t) ~ public._num_motif()
      then 'Pas de numéro de téléphone ici : pour votre sécurité, les numéros restent cachés sur le Marché de Gros. Échangez avec le bouton « Écrire ».'
    when t ~* '(mot\s+de\s+passe|code\s+(secret|confidentiel|pin|otp|sms|de\s+(confirmation|validation|v[ée]rification|retrait|s[ée]curit[ée]|connexion|secours)))'
      then 'Pour votre sécurité, on ne parle pas de code secret ni de mot de passe ici. Le Marché de Gros ne vous les demandera jamais : ne les donnez à personne.'
  end;
$function$;

-- un morceau de numéro : seulement des chiffres (en lettres ou non), 1 à 9 chiffres
create or replace function public._num_morceau(t text)
 returns text
 language sql
 immutable
 set search_path to 'public'
as $function$
  select case when x ~ '^[0-9]{1,9}$' then x end
  from (select regexp_replace(public._chiffres_lettres(coalesce(t, '')), '[\s.\-_/·+()]', '', 'g') as x) y
$function$;

create or replace function public.controle_sortie()
 returns trigger
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
declare m text; v_ref uuid; src text; frag text; avant text;
begin
  if new.texte is null or public.est_admin_id(new.auteur_id) then return new; end if;
  src := case tg_table_name when 'dm' then 'dm' when 'litige_messages' then 'litige' else 'negociation' end;
  v_ref := (to_jsonb(new) ->> case tg_table_name when 'dm' then 'discussion_id' when 'litige_messages' then 'commande_id' else 'negociation_id' end)::uuid;
  m := public.sortie_motif(new.texte);
  if m is null then
    -- numéro coupé en plusieurs messages : les derniers morceaux du même auteur, dans la même discussion, depuis 15 minutes
    frag := public._num_morceau(new.texte);
    if frag is not null then
      if tg_table_name = 'dm' then
        select string_agg(k, '' order by le) into avant from (select public._num_morceau(d.texte) k, d.created_at le from public.dm d
          where d.discussion_id = v_ref and d.auteur_id = new.auteur_id and d.created_at > now() - interval '15 minutes' order by d.created_at desc limit 5) z where k is not null;
      elsif tg_table_name = 'litige_messages' then
        select string_agg(k, '' order by le) into avant from (select public._num_morceau(l.texte) k, l.at le from public.litige_messages l
          where l.commande_id = v_ref and l.auteur_id = new.auteur_id and l.at > now() - interval '15 minutes' order by l.at desc limit 5) z where k is not null;
      else
        select string_agg(k, '' order by le) into avant from (select public._num_morceau(g.texte) k, g.created_at le from public.messages g
          where g.negociation_id = v_ref and g.auteur_id = new.auteur_id and g.created_at > now() - interval '15 minutes' order by g.created_at desc limit 5) z where k is not null;
      end if;
      if (coalesce(avant, '') || frag) ~ '((225)?0[1-9][0-9]{8}|225[0-9]{8})' then m := 'numéro coupé en plusieurs messages'; end if;
    end if;
    if m is null then return new; end if;
  end if;
  begin
    insert into public.alertes (user_id, source, ref_id, motif, extrait) values (new.auteur_id, src, v_ref, m, left(new.texte, 300));
  exception when check_violation then null;
  end;
  new.texte := case when m = 'numéro coupé en plusieurs messages' then '[numéro masqué]' else public.sortie_masquer(new.texte) end;
  return new;
end $function$;

create or replace trigger litige_messages_controle_sortie before insert on public.litige_messages
  for each row execute function public.controle_sortie();
