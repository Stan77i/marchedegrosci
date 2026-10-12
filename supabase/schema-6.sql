-- ═════════ Marché de Gros CI — étape 6 : notifications sur le téléphone (même application fermée), pastille sur l'icône (12 octobre 2026) ═════════
-- À lancer APRÈS les étapes 1 à 5. Peut être relancé sans danger. Aucun service payant : Web Push (le service de notification du téléphone)
-- + une fonction Edge Supabase « pousser » (offre gratuite) + pg_net (appel HTTP depuis la base).
--
-- Chemin d'une notification : un message de négociation est inséré → le déclencheur appelle la fonction « pousser » (pg_net)
-- → elle retrouve le destinataire, ses téléphones abonnés et son nombre de réponses à lire → le téléphone affiche la notification
-- et le chiffre sur l'icône (même hors de l'application ; hors réseau, elle arrive dès le retour du réseau).
--
-- Les clés (VAPID publique / privée, clé partagée entre la base et la fonction, adresse de la fonction) sont rangées dans le coffre
-- Supabase (vault) sous les noms mdg_vapid_public, mdg_vapid_prive, mdg_push_cle, mdg_push_url — jamais dans ce fichier ni dans le code.

create extension if not exists pg_net with schema extensions;

-- un téléphone abonné = une ligne (l'adresse que donne le service de notification du téléphone)
create table if not exists public.push_abonnements (
  endpoint   text primary key check (char_length(endpoint) between 20 and 1000 and endpoint like 'https://%'),
  user_id    uuid not null references auth.users(id) on delete cascade,
  p256dh     text not null check (char_length(p256dh) between 20 and 200),
  auth       text not null check (char_length(auth) between 8 and 100),
  appareil   text check (char_length(appareil) <= 120),
  created_at timestamptz not null default now(),
  vu_le      timestamptz not null default now()
);
create index if not exists push_abonnements_user on public.push_abonnements (user_id);
alter table public.push_abonnements enable row level security;
do $$ begin if not exists (select 1 from pg_policies where tablename = 'push_abonnements' and policyname = 'voir mes téléphones') then
  create policy "voir mes téléphones" on public.push_abonnements for select to authenticated using (user_id = auth.uid()); end if; end $$;
revoke all on public.push_abonnements from anon, authenticated;
grant select on public.push_abonnements to authenticated;

-- s'abonner : un téléphone n'appartient qu'à un compte à la fois (si on change de compte sur le même téléphone, il suit le nouveau)
create or replace function public.push_abonner(p_endpoint text, p_p256dh text, p_auth text, p_appareil text default null) returns void
language plpgsql volatile security definer set search_path = public as $$
begin
  if auth.uid() is null then raise exception 'Connectez-vous d''abord.'; end if;
  insert into public.push_abonnements (endpoint, user_id, p256dh, auth, appareil) values (p_endpoint, auth.uid(), p_p256dh, p_auth, left(p_appareil, 120))
  on conflict (endpoint) do update set user_id = excluded.user_id, p256dh = excluded.p256dh, auth = excluded.auth, appareil = excluded.appareil, vu_le = now();
end $$;
create or replace function public.push_desabonner(p_endpoint text) returns void
language sql volatile security definer set search_path = public as $$
  delete from public.push_abonnements where endpoint = p_endpoint and user_id = auth.uid();
$$;

-- le chiffre sur l'icône : les négociations où l'autre a écrit en dernier et que l'on n'a pas encore ouvertes
create or replace function public.push_badge(uid uuid) returns integer
language sql stable security definer set search_path = public as $$
  select count(*)::int from public.negociations n
  where uid in (n.auteur_id, n.proprio_id) and n.dernier_par is not null and n.dernier_par <> uid
    and n.updated_at > coalesce(case when n.auteur_id = uid then n.lu_auteur else n.lu_proprio end, '-infinity'::timestamptz);
$$;

-- la configuration lue par la fonction « pousser » (elle seule : rôle service)
create or replace function public.push_config() returns json
language sql stable security definer set search_path = public, vault as $$
  select json_object_agg(name, decrypted_secret) from vault.decrypted_secrets where name in ('mdg_vapid_public', 'mdg_vapid_prive', 'mdg_push_cle');
$$;

-- chaque nouveau message de négociation : on prévient l'autre partie (sans jamais bloquer l'envoi du message)
create or replace function public.push_message() returns trigger
language plpgsql security definer set search_path = public, vault, extensions as $$
declare v_url text; v_cle text;
begin
  select decrypted_secret into v_url from vault.decrypted_secrets where name = 'mdg_push_url';
  select decrypted_secret into v_cle from vault.decrypted_secrets where name = 'mdg_push_cle';
  if v_url is null or v_cle is null then return new; end if;
  perform net.http_post(url := v_url, body := jsonb_build_object('message_id', new.id),
    headers := jsonb_build_object('Content-Type', 'application/json', 'x-mdg-cle', v_cle), timeout_milliseconds := 8000);
  return new;
exception when others then return new;
end $$;
do $$ begin if not exists (select 1 from pg_trigger where tgname = 'push_message' and tgrelid = 'public.messages'::regclass) then
  create trigger push_message after insert on public.messages for each row execute function public.push_message(); end if; end $$;

revoke execute on function public.push_abonner(text, text, text, text), public.push_desabonner(text), public.push_badge(uuid), public.push_config(), public.push_message() from public, anon, authenticated;
grant execute on function public.push_abonner(text, text, text, text), public.push_desabonner(text) to authenticated;
grant execute on function public.push_badge(uuid), public.push_config() to service_role;

-- la fonction « pousser » (rôle service) lit seulement ce qu'il lui faut, et retire les abonnements périmés
grant select on public.messages, public.negociations, public.profils to service_role;
grant select, delete on public.push_abonnements to service_role;
