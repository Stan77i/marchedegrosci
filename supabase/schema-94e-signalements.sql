-- Schéma 94e (équipe Confiance, audit du 24/10/2026, P2 n° 16 et P3 n° 36 ; partie 8 « masquage automatique ») : signalements d'annonces.
-- À appliquer sur le projet de TEST d'abord (yowdymdnoiubatxlwhfv), puis en production avec l'accord du propriétaire.
-- 1. Plus de masquage par des comptes neufs : seuls comptent les signaleurs à l'identité vérifiée, inscrits depuis au moins 30 jours,
--    autres que le propriétaire (3 par défaut). Réglages dans reglages.confiance : signal_seuil (0 = jamais de masquage automatique),
--    signal_anciennete_jours, signal_verifie. Les signalements anonymes ne masquent jamais.
-- 2. Le propriétaire est prévenu par un message du Marché de Gros, et peut contester (signalement_contester, mes_annonces_masquees).
-- 3. L'équipe rétablit (admin_annonce_retablir) ou maintient (admin_annonce_maintenir) : les signalements sont marqués traités
--    (plus effacés), le propriétaire est prévenu. Un rétablissement fait autrement (ancien écran) marque aussi les signalements traités.
-- 4. Signalements limités : un seul par personne et par annonce ; 20 par jour pour un membre ; sans compte, 5 par jour et par
--    téléphone (adresse IP, gardée seulement sous forme d'un numéro de case, jamais en clair) et 200 par heure au total.
-- 5. Le nombre public de signalements d'une annonce ne compte que les membres connectés et les signalements pas encore traités.

alter table public.signalements add column if not exists traite boolean not null default false;
alter table public.signalements add column if not exists traite_le timestamptz;
alter table public.signalements add column if not exists ip_case integer;
create index if not exists signal_auteur_jour on public.signalements (user_id, created_at);
create index if not exists signal_ip_jour on public.signalements (ip_case, created_at) where user_id is null;

insert into public.reglages (cle, valeur) values ('confiance',
  jsonb_build_object('signal_seuil', 3, 'signal_anciennete_jours', 30, 'signal_verifie', true,
                     'signal_membre_jour', 20, 'signal_anonyme_jour', 5, 'signal_anonyme_heure_total', 200))
on conflict (cle) do nothing;

create or replace function public._confiance_regle(p_cle text, p_def numeric)
returns numeric language sql stable security definer set search_path = public as $$
  select coalesce((select case jsonb_typeof(valeur -> p_cle) when 'boolean' then case when (valeur ->> p_cle)::boolean then 1 else 0 end
                               else (valeur ->> p_cle)::numeric end
                   from public.reglages where cle = 'confiance'), p_def);
$$;

create table if not exists public.signalement_masquages (
  id uuid primary key default gen_random_uuid(),
  cible text not null check (cible in ('offre', 'demande')),
  cible_id uuid not null,
  proprio uuid,
  produit text,
  masquee_le timestamptz not null default now(),
  contestation text check (contestation is null or char_length(contestation) <= 500),
  contestee_le timestamptz,
  decision text check (decision is null or decision in ('retablie', 'maintenue')),
  decide_le timestamptz,
  decide_par uuid,
  note text check (note is null or char_length(note) <= 300),
  unique (cible, cible_id)
);
alter table public.signalement_masquages enable row level security;
revoke all on public.signalement_masquages from public, anon, authenticated;
grant select on public.signalement_masquages to authenticated;
do $$ begin
  if not exists (select 1 from pg_policy where polrelid = 'public.signalement_masquages'::regclass and polname = 'voir mes masquages') then
    create policy "voir mes masquages" on public.signalement_masquages for select to authenticated
      using (proprio = (select auth.uid()) or (select public.est_admin()));
  end if;
end $$;

-- avant l'enregistrement d'un signalement : limites
create or replace function public._signalement_garde()
returns trigger language plpgsql security definer set search_path = public as $$
declare h json := nullif(current_setting('request.headers', true), '')::json;
  ip text := coalesce(nullif(trim(split_part(coalesce(h ->> 'x-forwarded-for', ''), ',', 1)), ''), h ->> 'cf-connecting-ip', 'inconnue');
begin
  new.traite := false; new.traite_le := null; new.created_at := now();
  if new.user_id is not null then
    new.ip_case := null;
    if exists (select 1 from public.signalements s where s.user_id = new.user_id and s.cible = new.cible and s.cible_id = new.cible_id) then
      raise exception 'TEXTE_REFUSE : Vous avez déjà signalé cette annonce. L’équipe la regarde.' using errcode = 'P0001';
    end if;
    if (select count(*) from public.signalements s where s.user_id = new.user_id and s.created_at > now() - interval '1 day')
       >= public._confiance_regle('signal_membre_jour', 20) then
      raise exception 'TEXTE_REFUSE : Trop de signalements aujourd’hui. Réessayez demain, ou écrivez au Marché de Gros.' using errcode = 'P0001';
    end if;
  else
    new.ip_case := hashtext(ip) & 4095;
    if exists (select 1 from public.signalements s where s.user_id is null and s.ip_case = new.ip_case and s.cible = new.cible
                and s.cible_id = new.cible_id and s.created_at > now() - interval '1 day')
       or (select count(*) from public.signalements s where s.user_id is null and s.ip_case = new.ip_case and s.created_at > now() - interval '1 day')
          >= public._confiance_regle('signal_anonyme_jour', 5)
       or (select count(*) from public.signalements s where s.user_id is null and s.created_at > now() - interval '1 hour')
          >= public._confiance_regle('signal_anonyme_heure_total', 200) then
      raise exception 'TEXTE_REFUSE : Trop de signalements depuis ce téléphone. Connectez-vous pour signaler.' using errcode = 'P0001';
    end if;
  end if;
  return new;
end $$;
create or replace trigger signalement_garde before insert on public.signalements
  for each row execute function public._signalement_garde();

-- après un signalement : masquage seulement par des signaleurs fiables (identité vérifiée, compte ancien)
create or replace function public.apres_signalement()
returns trigger language plpgsql security definer set search_path = public as $$
declare n int; seuil int := public._confiance_regle('signal_seuil', 3)::int;
  anc int := public._confiance_regle('signal_anciennete_jours', 30)::int; verif boolean := public._confiance_regle('signal_verifie', 1) > 0;
  v_prop uuid; v_prod text; v_status text;
begin
  if seuil <= 0 or new.user_id is null then return new; end if;
  if new.cible = 'offre' then select user_id, product_label, status into v_prop, v_prod, v_status from public.offres where id = new.cible_id;
  else select user_id, product_label, status into v_prop, v_prod, v_status from public.demandes where id = new.cible_id; end if;
  if v_prop is null or v_status <> 'active' or public.est_admin_id(v_prop) then return new; end if;
  select count(distinct s.user_id) into n from public.signalements s join auth.users u on u.id = s.user_id
  where s.cible = new.cible and s.cible_id = new.cible_id and s.user_id is not null and not s.traite and s.user_id <> v_prop
    and u.created_at <= now() - make_interval(days => anc)
    and (not verif or public.identite_ok(s.user_id));
  if n < seuil then return new; end if;
  if new.cible = 'offre' then update public.offres set status = 'masquee' where id = new.cible_id and status = 'active';
  else update public.demandes set status = 'masquee' where id = new.cible_id and status = 'active'; end if;
  insert into public.signalement_masquages (cible, cible_id, proprio, produit, masquee_le)
  values (new.cible, new.cible_id, v_prop, v_prod, now())
  on conflict (cible, cible_id) do update set masquee_le = now(), proprio = excluded.proprio, produit = excluded.produit,
    contestation = null, contestee_le = null, decision = null, decide_le = null, decide_par = null, note = null;
  perform public._equipe_ecrire(v_prop, 'Votre annonce « ' || coalesce(v_prod, 'sans nom') || ' » est cachée pour l’instant : plusieurs membres vérifiés l’ont signalée. L’équipe va la regarder. Si c’est une erreur, ouvrez Mon compte, puis « Annonce cachée », et touchez « Contester ».');
  return new;
end $$;

-- le propriétaire voit ses annonces cachées après signalement, et peut contester une fois
create or replace function public.mes_annonces_masquees()
returns json language sql stable security definer set search_path = public as $$
  select coalesce(json_agg(json_build_object('cible', m.cible, 'cible_id', m.cible_id, 'produit', m.produit, 'masquee_le', m.masquee_le,
           'contestee', m.contestation is not null, 'contestee_le', m.contestee_le) order by m.masquee_le desc), '[]'::json)
  from public.signalement_masquages m
  where m.proprio = auth.uid() and m.decision is null;
$$;

create or replace function public.signalement_contester(p_cible text, p_id uuid, p_texte text)
returns json language plpgsql security definer set search_path = public as $$
declare m public.signalement_masquages; t text := btrim(coalesce(p_texte, '')); r text;
begin
  if auth.uid() is null then raise exception 'Connectez-vous d''abord.'; end if;
  select * into m from public.signalement_masquages where cible = p_cible and cible_id = p_id for update;
  if m.id is null or m.proprio is distinct from auth.uid() or m.decision is not null then raise exception 'TEXTE_REFUSE : Cette annonce n’est pas cachée.' using errcode = 'P0001'; end if;
  if m.contestation is not null then raise exception 'TEXTE_REFUSE : Vous avez déjà contesté. L’équipe vous répond dans Messages.' using errcode = 'P0001'; end if;
  if char_length(t) < 10 or char_length(t) > 500 then raise exception 'TEXTE_REFUSE : Expliquez en quelques mots (10 à 500 caractères).' using errcode = 'P0001'; end if;
  r := public.texte_refus(t);
  if r is not null then raise exception 'TEXTE_REFUSE : %', r using errcode = 'P0001'; end if;
  update public.signalement_masquages set contestation = t, contestee_le = now() where id = m.id;
  return json_build_object('ok', true);
end $$;

-- l'équipe rétablit ou maintient ; les signalements sont marqués traités (rien n'est effacé) ; le propriétaire est prévenu
create or replace function public._signalements_traiter(p_cible text, p_id uuid)
returns void language sql security definer set search_path = public as $$
  update public.signalements set traite = true, traite_le = now() where cible = p_cible and cible_id = p_id and not traite;
$$;

create or replace function public.admin_annonce_retablir(p_cible text, p_id uuid, p_note text default null)
returns void language plpgsql security definer set search_path = public as $$
declare v_prop uuid; v_prod text; n int;
begin
  if not public.est_admin() then raise exception 'Accès réservé à l''administrateur.'; end if;
  if p_cible not in ('offre', 'demande') then raise exception 'Annonce inconnue.'; end if;
  if p_cible = 'offre' then
    update public.offres set status = 'active' where id = p_id and status = 'masquee' and suspension_id is null returning user_id, product_label into v_prop, v_prod;
  else
    update public.demandes set status = 'active' where id = p_id and status = 'masquee' and suspension_id is null returning user_id, product_label into v_prop, v_prod;
  end if;
  get diagnostics n = row_count;
  if n = 0 then raise exception 'Annonce introuvable, pas cachée, ou cachée par une suspension (voir Fiabilité).'; end if;
  perform public._signalements_traiter(p_cible, p_id);
  update public.signalement_masquages set decision = 'retablie', decide_le = now(), decide_par = auth.uid(), note = left(nullif(btrim(coalesce(p_note, '')), ''), 300)
   where cible = p_cible and cible_id = p_id and decision is null;
  insert into public.admin_journal (admin_id, action, cible_id, motif, detail)
  values (auth.uid(), 'annonce_retablie', p_id, left(nullif(btrim(coalesce(p_note, '')), ''), 300), jsonb_build_object('cible', p_cible, 'proprio', v_prop));
  perform public._equipe_ecrire(v_prop, 'Votre annonce « ' || coalesce(v_prod, 'sans nom') || ' » est de nouveau visible : l’équipe l’a vérifiée.');
end $$;

create or replace function public.admin_annonce_maintenir(p_cible text, p_id uuid, p_note text)
returns void language plpgsql security definer set search_path = public as $$
declare m public.signalement_masquages; nt text := nullif(btrim(coalesce(p_note, '')), '');
begin
  if not public.est_admin() then raise exception 'Accès réservé à l''administrateur.'; end if;
  if nt is null or char_length(nt) > 300 then raise exception 'Expliquez la décision au membre (300 caractères au plus).'; end if;
  select * into m from public.signalement_masquages where cible = p_cible and cible_id = p_id and decision is null for update;
  if m.id is null then raise exception 'Aucun masquage en attente pour cette annonce.'; end if;
  perform public._signalements_traiter(p_cible, p_id);
  update public.signalement_masquages set decision = 'maintenue', decide_le = now(), decide_par = auth.uid(), note = nt where id = m.id;
  insert into public.admin_journal (admin_id, action, cible_id, motif, detail)
  values (auth.uid(), 'annonce_maintenue', p_id, nt, jsonb_build_object('cible', p_cible, 'proprio', m.proprio));
  perform public._equipe_ecrire(m.proprio, 'Votre annonce « ' || coalesce(m.produit, 'sans nom') || ' » reste cachée après vérification par l’équipe. ' || nt);
end $$;

create or replace function public.admin_masquages()
returns json language plpgsql stable security definer set search_path = public as $$
begin
  if not public.est_admin() then raise exception 'Accès réservé à l''administrateur.'; end if;
  return coalesce((select json_agg(json_build_object('cible', m.cible, 'cible_id', m.cible_id, 'produit', m.produit, 'masquee_le', m.masquee_le,
      'contestation', m.contestation, 'contestee_le', m.contestee_le, 'qui', public._fiab_qui(m.proprio)) order by m.contestee_le nulls last, m.masquee_le)
    from public.signalement_masquages m where m.decision is null), '[]'::json);
end $$;

-- une annonce cachée remise en ligne autrement (ancien écran de l'équipe) : signalements marqués traités, masquage clos
create or replace function public._annonce_signal_retablie()
returns trigger language plpgsql security definer set search_path = public as $$
declare c text := case tg_table_name when 'offres' then 'offre' else 'demande' end;
begin
  if old.status = 'masquee' and new.status = 'active' and public.est_admin() then
    perform public._signalements_traiter(c, new.id);
    update public.signalement_masquages set decision = 'retablie', decide_le = now(), decide_par = auth.uid()
     where cible = c and cible_id = new.id and decision is null;
  end if;
  return new;
end $$;
create or replace trigger offres_signal_retablie after update of status on public.offres
  for each row execute function public._annonce_signal_retablie();
create or replace trigger demandes_signal_retablie after update of status on public.demandes
  for each row execute function public._annonce_signal_retablie();

-- nombre public : membres connectés, signalements pas encore traités
create or replace function public.signalements_publics(ids uuid[])
returns table(cible_id uuid, nombre integer, raisons text[])
language sql stable security definer set search_path = public as $$
  select s.cible_id, count(distinct s.user_id)::int, (array_agg(distinct split_part(s.motif, ' — ', 1)) filter (where s.motif is not null))[1:4]
  from public.signalements s where s.cible_id = any (ids[1:300]) and s.user_id is not null and not s.traite group by s.cible_id;
$$;

revoke execute on function public._signalement_garde() from public, anon, authenticated;
revoke execute on function public._signalements_traiter(text, uuid) from public, anon, authenticated;
revoke execute on function public._annonce_signal_retablie() from public, anon, authenticated;
revoke execute on function public._confiance_regle(text, numeric) from public, anon;
revoke execute on function public.mes_annonces_masquees() from public, anon;
revoke execute on function public.signalement_contester(text, uuid, text) from public, anon;
revoke execute on function public.admin_annonce_retablir(text, uuid, text) from public, anon;
revoke execute on function public.admin_annonce_maintenir(text, uuid, text) from public, anon;
revoke execute on function public.admin_masquages() from public, anon;
grant execute on function public.mes_annonces_masquees() to authenticated;
grant execute on function public.signalement_contester(text, uuid, text) to authenticated;
grant execute on function public.admin_annonce_retablir(text, uuid, text) to authenticated;
grant execute on function public.admin_annonce_maintenir(text, uuid, text) to authenticated;
grant execute on function public.admin_masquages() to authenticated;
