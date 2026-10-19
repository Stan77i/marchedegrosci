-- ═════════ Marché de Gros CI — schéma 22 : pas de liens, pas d'hameçonnage (19 octobre 2026) ═════════
-- Peut être relancé sans danger. (Déjà appliqué sur le projet mgci le 19 octobre 2026.)
--
-- Tout texte écrit par un membre (sauf l'administrateur, qui parle au nom du Marché de Gros) (messages privés, négociations, avis, profil, annonces) est refusé s'il contient :
--   • un lien ou une adresse de site : http://, https://, www., « nom.com », « nom.ci », « nom point com », wa.me, bit.ly…
--     (même le site du Marché de Gros : on échange uniquement dans l'application)
--   • une adresse e-mail
--   • un numéro de téléphone (07 01 02 03 04, +225…) : les numéros restent cachés, on échange dans l'application
--   • une demande de code secret, de mot de passe ou de code de retrait (le Marché de Gros ne les demande jamais)
--   • un code de transfert d'argent à taper (*144*…#, #150#…), une ruse classique pour faire envoyer de l'argent
-- La règle est dans la base : aucune version de l'application, ancienne ou modifiée, ne peut la contourner.
-- L'application montre le même message avant l'envoi (app/garde.js).

create or replace function public.texte_refus(t text) returns text
language sql immutable set search_path = public as $f$
  select case
    when t is null or btrim(t) = '' then null
    when t ~* '[a-z0-9._%+-]+\s?(@|\(at\)|\[at\])\s?[a-z0-9-]+\s?\.\s?[a-z]{2,}'
      then 'Pas d’adresse e-mail ici : pour votre sécurité, échangez uniquement dans l’application.'
    when t ~* '(h\s*t\s*t\s*p\s*s?\s*:\s*/\s*/|\mwww\s*\.|\mwww\M)'
      or t ~* '\m[a-z0-9-]*[a-z][a-z0-9-]*(\s?\.|\s?(\(\.\)|\[\.\]|\(dot\)|\[dot\])\s?)(com|net|org|ci|fr|info|biz|io|me|ly|app|xyz|site|online|shop|store|link|click|top|africa|gl|gd|to|cc|tv|page|dev|live|club|vip|pro|be|ch|ca|us|uk|gg|ws|im|sn|cm|bf|ml|tg|bj|gh|ng)\M'
      or t ~* '\m(point|dot)\s+(com|net|org|info)\M'
      then 'Pas de lien ici : pour votre sécurité, les adresses de sites (www, .com, .ci…) sont interdites sur le Marché de Gros, même la nôtre. Échangez uniquement dans l’application.'
    when t ~* '(\*\s*\d{2,4}\s*(\*\s*\d*\s*)*#|#\s*\d{3}\s*#)'
      then 'Pas de code de transfert à taper (*144*…#) : c’est une ruse fréquente pour faire envoyer de l’argent. Ne payez qu’à la livraison, après avoir vu la marchandise.'
    when t ~* '((\+|00)\s*225([\s.\-]*\d){8,10}|\m(0[157]|2[157])([\s.\-]*\d){8}\M)'
      then 'Pas de numéro de téléphone ici : pour votre sécurité, les numéros restent cachés sur le Marché de Gros. Échangez avec le bouton « Écrire ».'
    when t ~* '(mot\s+de\s+passe|code\s+(secret|confidentiel|pin|otp|sms|de\s+(confirmation|validation|v[ée]rification|retrait|s[ée]curit[ée]|connexion|secours)))'
      then 'Pour votre sécurité, on ne parle pas de code secret ni de mot de passe ici. Le Marché de Gros ne vous les demandera jamais : ne les donnez à personne.'
  end;
$f$;
grant execute on function public.texte_refus(text) to anon, authenticated;

create or replace function public.garde_textes() returns trigger
language plpgsql set search_path = public as $f$
declare r text;
begin
  -- l'administrateur (le « Marché de Gros » officiel) peut écrire des liens ; personne d'autre
  if public.est_admin() then return new; end if;
  if tg_table_name in ('offres', 'demandes') and public.est_admin_id(new.user_id) then return new; end if;
  r := public.texte_refus(case tg_table_name
    when 'dm' then new.texte
    when 'messages' then new.texte
    when 'avis' then new.texte
    when 'profils' then concat_ws(' · ', new.prenom, new.nom, new.pseudo, new.bio, new.activites)
    when 'offres' then concat_ws(' · ', new.seller_name, new.city, new.agent, new.product_label)
    when 'demandes' then concat_ws(' · ', new.buyer_name, new.city, new.product_label)
  end);
  if r is not null then raise exception 'TEXTE_REFUSE : %', r using errcode = 'P0001'; end if;
  return new;
end $f$;

create or replace trigger dm_garde_textes before insert or update on public.dm for each row execute function public.garde_textes();
create or replace trigger messages_garde_textes before insert or update on public.messages for each row execute function public.garde_textes();
create or replace trigger avis_garde_textes before insert or update on public.avis for each row execute function public.garde_textes();
create or replace trigger profils_garde_textes before insert or update on public.profils for each row execute function public.garde_textes();
create or replace trigger offres_garde_textes before insert or update on public.offres for each row execute function public.garde_textes();
create or replace trigger demandes_garde_textes before insert or update on public.demandes for each row execute function public.garde_textes();
