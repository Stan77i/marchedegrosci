-- Schéma 83e : corrections de relecture du chantier 1 (transport). Appliqué sur le projet de TEST le 24/10/2026. Pas encore en production.
-- À appliquer après 83a, 83b, 83c, 83d.
-- 1. _num_motif : un numéro ne commence pas juste après un chiffre. Avant, « 3 000 / 4 500 / 6 000 / 8 000 », deux dates
--    « 15/10/2026 - 20/10/2026 » ou un numéro de commande étaient masqués (et refusés dans une annonce par texte_refus).
-- 2. controle_sortie : un numéro coupé en plusieurs messages doit former exactement un numéro avec les derniers morceaux.
--    Avant, trois prix envoyés seuls (« 15000 », « 25000 », « 30000 ») étaient pris pour un numéro.
-- 3. _nego_transport_poser : ne touche que la proposition de la personne qui vient de l'envoyer.

create or replace function public._num_motif()
 returns text
 language sql
 immutable
 set search_path to 'public'
as $function$
  select '(?<![0-9])((\+|00)\s*225([\s.\-_/·]{0,4}[0-9]){8,10}|(\+?\s*225[\s.\-_/·]*)?0[\s.\-_/·]{0,4}[1-9]([\s.\-_/·]{0,4}[0-9]){8})'
$function$;

create or replace function public.controle_sortie()
 returns trigger
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
declare m text; v_ref uuid; src text; frag text; morceaux text[]; s text := ''; i int;
begin
  if new.texte is null or public.est_admin_id(new.auteur_id) then return new; end if;
  src := case tg_table_name when 'dm' then 'dm' when 'litige_messages' then 'litige' else 'negociation' end;
  v_ref := (to_jsonb(new) ->> case tg_table_name when 'dm' then 'discussion_id' when 'litige_messages' then 'commande_id' else 'negociation_id' end)::uuid;
  m := public.sortie_motif(new.texte);
  if m is null then
    -- numéro coupé en plusieurs messages : les derniers morceaux du même auteur, dans la même discussion, depuis 15 minutes,
    -- mis bout à bout depuis le message envoyé, doivent former exactement un numéro
    frag := public._num_morceau(new.texte);
    if frag is not null then
      if tg_table_name = 'dm' then
        select array_agg(k order by le) into morceaux from (select public._num_morceau(d.texte) k, d.created_at le from public.dm d
          where d.discussion_id = v_ref and d.auteur_id = new.auteur_id and d.created_at > now() - interval '15 minutes' order by d.created_at desc limit 5) z where k is not null;
      elsif tg_table_name = 'litige_messages' then
        select array_agg(k order by le) into morceaux from (select public._num_morceau(l.texte) k, l.at le from public.litige_messages l
          where l.commande_id = v_ref and l.auteur_id = new.auteur_id and l.at > now() - interval '15 minutes' order by l.at desc limit 5) z where k is not null;
      else
        select array_agg(k order by le) into morceaux from (select public._num_morceau(g.texte) k, g.created_at le from public.messages g
          where g.negociation_id = v_ref and g.auteur_id = new.auteur_id and g.created_at > now() - interval '15 minutes' order by g.created_at desc limit 5) z where k is not null;
      end if;
      morceaux := coalesce(morceaux, '{}'::text[]) || frag;
      for i in reverse array_length(morceaux, 1)..1 loop
        s := morceaux[i] || s;
        if s ~ '^((00)?225)?0[1-9][0-9]{8}$' or s ~ '^(00)?225[0-9]{8,10}$' then m := 'numéro coupé en plusieurs messages'; exit; end if;
      end loop;
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
  if n.dernier_msg is null or n.dernier_par is distinct from auth.uid() then return; end if;
  tr := p_transport = 'inclus';
  update public.messages set transport_inclus = tr, prix_transport = p_pt
  where id = n.dernier_msg and genre = 'prix' and issue = 'en_attente' and auteur_id = auth.uid();
  if found then
    update public.negociations set dernier_transport = tr, dernier_prix_transport = p_pt where id = p_nego;
  end if;
end $function$;
revoke execute on function public._nego_transport_poser(uuid, text, numeric) from public, anon, authenticated;
