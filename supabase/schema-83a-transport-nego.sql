-- Schéma 83a : chantier 1 (commande et transport), partie négociation.
-- Appliqué sur le projet de TEST le 24/10/2026. Pas encore en production.
-- 1. Réglage « transporteur du réseau Marché de Gros ouvert » lu dans une table (STABLE), changé par l'admin seulement. Reste fermé.
-- 2. Le prix du transport entre dans la proposition : transport inclus, à part (avec son prix) ou sans transport.
--    Tout part en un seul appel (nego_ouvrir2, nego_agir2) : le marqueur transport ne se perd plus.
-- 3. L'accord fige aussi le transport (transport_final, prix_transport_final).

create table if not exists public.reglages (
  cle text primary key,
  valeur jsonb not null,
  maj_le timestamptz not null default now(),
  maj_par uuid
);
alter table public.reglages enable row level security;
revoke all on public.reglages from anon, authenticated;
insert into public.reglages (cle, valeur) values ('transport_reseau_ouvert', 'false'::jsonb) on conflict (cle) do nothing;

create or replace function public._transport_reseau_ouvert()
 returns boolean
 language sql
 stable security definer
 set search_path to 'public'
as $function$
  select coalesce((select valeur = 'true'::jsonb from public.reglages where cle = 'transport_reseau_ouvert'), false)
$function$;

create or replace function public.admin_transport_reseau(p_oui boolean)
 returns boolean
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
begin
  if not public.est_admin() then raise exception 'Réservé à l''administration.'; end if;
  insert into public.reglages (cle, valeur, maj_le, maj_par) values ('transport_reseau_ouvert', to_jsonb(coalesce(p_oui, false)), now(), auth.uid())
  on conflict (cle) do update set valeur = excluded.valeur, maj_le = now(), maj_par = auth.uid();
  return coalesce(p_oui, false);
end $function$;
revoke execute on function public.admin_transport_reseau(boolean) from public, anon;
grant execute on function public.admin_transport_reseau(boolean) to authenticated;

alter table public.messages add column if not exists prix_transport numeric;
alter table public.negociations add column if not exists dernier_prix_transport numeric;
alter table public.negociations add column if not exists prix_transport_final numeric;
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'messages_prix_transport_check') then
    alter table public.messages add constraint messages_prix_transport_check check (prix_transport is null or (prix_transport > 0 and prix_transport < 100000000));
  end if;
  if not exists (select 1 from pg_constraint where conname = 'negociations_prix_transport_check') then
    alter table public.negociations add constraint negociations_prix_transport_check check ((dernier_prix_transport is null or (dernier_prix_transport > 0 and dernier_prix_transport < 100000000))
      and (prix_transport_final is null or (prix_transport_final > 0 and prix_transport_final < 100000000)));
  end if;
end $$;

create or replace function public.nego_transport_suivi()
 returns trigger
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
declare t boolean; pt numeric;
begin
  if new.dernier_msg is distinct from old.dernier_msg and new.dernier_msg is not null then
    new.dernier_transport := null; new.dernier_prix_transport := null;
  end if;
  if old.statut is distinct from 'conclue' and new.statut = 'conclue' and old.dernier_msg is not null then
    select transport_inclus, prix_transport into t, pt from public.messages where id = old.dernier_msg;
    new.transport_final := t; new.prix_transport_final := pt;
    update public.messages set transport_inclus = t, prix_transport = pt where negociation_id = new.id and genre = 'accord' and transport_inclus is null;
  end if;
  return new;
end $function$;

create or replace function public.nego_fige()
 returns trigger
 language plpgsql
 set search_path to 'public'
as $function$
begin
  if old.statut = 'conclue' and (new.statut <> 'conclue' or new.prix_final is distinct from old.prix_final
     or new.quantite_finale is distinct from old.quantite_finale or new.conditions_finales is distinct from old.conditions_finales
     or new.conclu_le is distinct from old.conclu_le or new.transport_final is distinct from old.transport_final
     or new.prix_transport_final is distinct from old.prix_transport_final) then
    raise exception 'Un accord conclu ne peut plus être modifié.';
  end if;
  return new;
end $function$;

-- transport d'une proposition : 'inclus', 'apart' (avec son prix), 'sans' ; null = rien de dit
create or replace function public._nego_transport_valider(p_transport text, p_prix_transport numeric)
 returns numeric
 language plpgsql
 immutable
 set search_path to 'public'
as $function$
begin
  if p_transport is not null and p_transport not in ('inclus', 'apart', 'sans') then raise exception 'Choix de transport inconnu.'; end if;
  if p_transport = 'apart' then
    if p_prix_transport is null or p_prix_transport <= 0 or p_prix_transport >= 100000000 then
      raise exception 'Indiquez le prix du transport, en francs (ex. 25 000).';
    end if;
    return round(p_prix_transport, 0);
  end if;
  if p_prix_transport is not null then raise exception 'Le prix du transport va avec « Transport à part ».'; end if;
  return null;
end $function$;

create or replace function public._nego_transport_poser(p_nego uuid, p_transport text, p_pt numeric)
 returns void
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
declare n public.negociations; tr boolean;
begin
  if p_transport is null then return; end if;
  select * into n from public.negociations where id = p_nego;
  if n.dernier_msg is null then return; end if;
  tr := p_transport = 'inclus';
  update public.messages set transport_inclus = tr, prix_transport = p_pt where id = n.dernier_msg and genre = 'prix' and issue = 'en_attente';
  update public.negociations set dernier_transport = tr, dernier_prix_transport = p_pt where id = p_nego;
end $function$;
revoke execute on function public._nego_transport_poser(uuid, text, numeric) from public, anon, authenticated;

create or replace function public.nego_agir2(nego uuid, action text, prix numeric default null, quantite numeric default null, texte text default null, ref uuid default null,
  p_transport text default null, p_prix_transport numeric default null)
 returns void
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
declare pt numeric;
begin
  if action = 'prix' then pt := public._nego_transport_valider(p_transport, p_prix_transport);
  elsif p_transport is not null or p_prix_transport is not null then raise exception 'Le transport se choisit dans une proposition de prix.'; end if;
  perform public.nego_agir(nego, action, prix, quantite, texte, ref);
  if action = 'prix' then perform public._nego_transport_poser(nego, p_transport, pt); end if;
end $function$;
revoke execute on function public.nego_agir2(uuid, text, numeric, numeric, text, uuid, text, numeric) from public, anon;
grant execute on function public.nego_agir2(uuid, text, numeric, numeric, text, uuid, text, numeric) to authenticated;

create or replace function public.nego_ouvrir2(cible text, cible_id uuid, prix numeric, quantite numeric default null, texte text default null,
  p_transport text default null, p_prix_transport numeric default null)
 returns uuid
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
declare pt numeric; v uuid;
begin
  pt := public._nego_transport_valider(p_transport, p_prix_transport);
  v := public.nego_ouvrir(cible, cible_id, prix, quantite, texte);
  perform public._nego_transport_poser(v, p_transport, pt);
  return v;
end $function$;
revoke execute on function public.nego_ouvrir2(text, uuid, numeric, numeric, text, text, numeric) from public, anon;
grant execute on function public.nego_ouvrir2(text, uuid, numeric, numeric, text, text, numeric) to authenticated;
