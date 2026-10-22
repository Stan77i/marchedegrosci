-- ═════════ Marché de Gros CI — schéma 51 : le chauffeur demande le code dans l'application, chacun exige le code de l'autre ═════════
-- Demandé par le propriétaire le 22/10/2026 : le chauffeur doit exiger que l'acheteur montre son code, l'acheteur doit exiger
-- que le transporteur montre le sien ; « ça se discute dans l'application, pas sur WhatsApp ».
--   • le chauffeur (transporteur inscrit, mission acceptée) touche « Demander le code » : le vendeur (avant le chargement)
--     ou l'acheteur (pendant le transport) reçoit une notification. Une demande toutes les 2 minutes au plus par commande.
--     Le code lui-même n'est JAMAIS envoyé par notification ni par message : il se montre de vive voix, sur place.
--   • l'acheteur et le vendeur voient le code transporteur du chauffeur (T-4K7P) une fois la mission acceptée :
--     ils exigent qu'il le leur montre dans son Espace chauffeur, pour être sûrs que c'est le bon.
-- Appliqué par Claude avec l'outil Supabase. Aucun drop, aucune donnée effacée.

create table if not exists public.code_demandes (
  id          uuid primary key default gen_random_uuid(),
  commande_id uuid not null references public.commandes (id) on delete cascade,
  par         uuid not null,
  quoi        text not null check (quoi in ('prise_en_charge', 'reception')),
  at          timestamptz not null default now()
);
create index if not exists code_demandes_cmd on public.code_demandes (commande_id, at desc);
alter table public.code_demandes enable row level security;
revoke all on public.code_demandes from anon, authenticated;

create or replace function public.commande_code_demander(p_cmd uuid) returns json
language plpgsql volatile security definer set search_path = public as $$
declare me uuid := auth.uid(); c public.commandes; q text;
begin
  if me is null then raise exception 'Connectez-vous d''abord.'; end if;
  select * into c from public.commandes where id = p_cmd;
  if c.id is null or public._cmd_role2(c, me) is distinct from 'chauffeur' then raise exception 'Commande introuvable.'; end if;
  if c.validation <> 'code' or c.etat <> 'en_cours' then raise exception 'Cette commande ne se valide pas avec un code en ce moment.'; end if;
  q := case when coalesce(c.etape, 'confirmee') in ('confirmee', 'preparation') then 'prise_en_charge'
            when c.etape in ('transport', 'transbordement', 'arrivee') then 'reception' end;
  if q is null then raise exception 'Aucun code à demander à cette étape.'; end if;
  if exists (select 1 from public.code_demandes where commande_id = c.id and at > now() - interval '2 minutes') then
    return json_build_object('ok', false, 'message', 'Demande déjà envoyée : attendez 2 minutes avant de la renvoyer.'); end if;
  insert into public.code_demandes (commande_id, par, quoi) values (c.id, me, q);
  return json_build_object('ok', true, 'a', case q when 'prise_en_charge' then 'vendeur' else 'acheteur' end);
end $$;
revoke execute on function public.commande_code_demander(uuid) from public, anon;
grant execute on function public.commande_code_demander(uuid) to authenticated;

-- notification (fonction Edge « pousser », { code_demande_id })
create or replace function public.push_code_demande() returns trigger
language plpgsql security definer set search_path = public, vault, extensions as $$
declare v_url text; v_cle text;
begin
  select decrypted_secret into v_url from vault.decrypted_secrets where name = 'mdg_push_url';
  select decrypted_secret into v_cle from vault.decrypted_secrets where name = 'mdg_push_cle';
  if v_url is null or v_cle is null then return new; end if;
  perform net.http_post(url := v_url, body := jsonb_build_object('code_demande_id', new.id),
    headers := jsonb_build_object('Content-Type', 'application/json', 'x-mdg-cle', v_cle), timeout_milliseconds := 8000);
  return new;
exception when others then return new;
end $$;
revoke all on function public.push_code_demande() from public, anon, authenticated;
create or replace trigger code_demandes_push after insert on public.code_demandes for each row execute function public.push_code_demande();

-- le code transporteur du chauffeur, visible par l'acheteur et le vendeur une fois la mission acceptée
do $$ declare d text; begin
  d := pg_get_functiondef('public.commande_transport(uuid)'::regprocedure);
  if position('''code'', case when m.statut' in d) > 0 then return; end if;
  d := replace(d, $q$'prix', m.prix)$q$, $q$'prix', m.prix, 'code', case when m.statut = 'acceptee' then t.code end)$q$);
  if position('''code'', case when m.statut' in d) = 0 then raise exception 'commande_transport : motif introuvable'; end if;
  execute d;
end $$;
