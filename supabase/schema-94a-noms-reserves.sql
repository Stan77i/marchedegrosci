-- Schéma 94a (équipe Confiance, audit du 24/10/2026, P1 n° 3 et P2 n° 17) : noms réservés et nom vérifié figé.
-- À appliquer sur le projet de TEST d'abord (yowdymdnoiubatxlwhfv), puis en production avec l'accord du propriétaire.
-- 1. Personne ne peut s'appeler « Marché de Gros », « MGCI », « admin », « support », « équipe », « officiel », « service client »…
--    Le contrôle se fait après normalisation : minuscules, sans accents, sans espaces ni ponctuation, chiffres lus comme des lettres
--    (0→o, 1→i, 3→e, 4→a, 5→s, 7→t, 8→b, @→a, $→s). Il vaut pour le prénom, le nom, les deux ensemble, le pseudo (qui sert aussi
--    d'adresse de boutique) et le nom de la structure. Le compte officiel (est_admin) reste autorisé.
-- 2. Identité vérifiée : le prénom et le nom ne changent plus (refus clair) ; une correction passe par l'équipe.
--    La suppression du compte (qui vide le nom) reste possible.
-- Les messages commencent par « TEXTE_REFUSE : » : l'application montre seulement la phrase (v3/nuage.js).

create or replace function public._nom_normalise(t text)
returns text language sql immutable set search_path = public as $$
  select regexp_replace(
    translate(lower(coalesce(t, '')),
      'àâäáãåçéèêëíìîïñóòôöõúùûüýÿœæ' || '0134578@$|!',
      'aaaaaaceeeeiiiinooooouuuuyyoa' || 'oieastbasii'),
    '[^a-z]+', '', 'g');
$$;

create or replace function public._nom_reserve(t text)
returns boolean language sql immutable set search_path = public as $$
  select public._nom_normalise(t) ~ '(marchedegro|marchesdegro|marchedugro|marchegros|mgci|mdgci|admin|moderat|support|serviceclient|equipe|officiel|staff)';
$$;

create or replace function public._profil_confiance()
returns trigger language plpgsql security definer set search_path = public as $$
declare champ text; v text; ancien text;
begin
  -- l'équipe et le compte officiel ne sont pas concernés ; un compte qu'on supprime vide son nom librement
  if public.est_admin() or public.est_admin_id(new.user_id) or new.supprime_le is not null then return new; end if;
  foreach champ in array array['prenom', 'nom', 'pseudo', 'structure_nom'] loop
    v := case champ when 'prenom' then new.prenom when 'nom' then new.nom when 'pseudo' then new.pseudo else new.structure_nom end;
    ancien := case when tg_op = 'UPDATE' then case champ when 'prenom' then old.prenom when 'nom' then old.nom when 'pseudo' then old.pseudo else old.structure_nom end end;
    if v is not null and (tg_op = 'INSERT' or v is distinct from ancien) and public._nom_reserve(v) then
      raise exception 'TEXTE_REFUSE : Ce nom est réservé à l’équipe du Marché de Gros. Choisissez-en un autre.' using errcode = 'P0001';
    end if;
  end loop;
  if (tg_op = 'INSERT' or new.prenom is distinct from old.prenom or new.nom is distinct from old.nom)
     and public._nom_reserve(coalesce(new.prenom, '') || coalesce(new.nom, '')) then
    raise exception 'TEXTE_REFUSE : Ce nom est réservé à l’équipe du Marché de Gros. Choisissez-en un autre.' using errcode = 'P0001';
  end if;
  -- identité vérifiée : le nom vu par les autres est celui de la pièce ; il ne change plus sans l'équipe
  if tg_op = 'UPDATE'
     and (public.identite_norm_nom(new.prenom) is distinct from public.identite_norm_nom(old.prenom)
          or public.identite_norm_nom(new.nom) is distinct from public.identite_norm_nom(old.nom))
     and public.identite_ok(new.user_id) then
    raise exception 'TEXTE_REFUSE : Votre identité est vérifiée : votre prénom et votre nom ne changent plus. Pour une correction, écrivez au Marché de Gros.' using errcode = 'P0001';
  end if;
  return new;
end $$;

-- nom du déclencheur choisi pour passer après profil_maj (qui enlève les espaces) : ordre alphabétique
create or replace trigger profils_confiance before insert or update on public.profils
  for each row execute function public._profil_confiance();

-- le contrôle « pseudo libre » de l'inscription dit aussi non pour un nom réservé
create or replace function public.pseudo_libre(p text)
returns boolean language sql stable security definer set search_path = public as $$
  select coalesce(p, '') ~ '^[A-Za-z0-9_.-]{3,24}$' and not public._nom_reserve(p)
    and not exists (select 1 from public.profils where lower(pseudo) = lower(btrim(p)));
$$;

revoke execute on function public._profil_confiance() from public, anon, authenticated;
grant execute on function public._nom_normalise(text) to anon, authenticated;
grant execute on function public._nom_reserve(text) to anon, authenticated;
