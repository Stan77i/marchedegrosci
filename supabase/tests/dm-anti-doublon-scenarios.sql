-- Schémas 96c et 97a : scénarios (projet de TEST seulement ; tout est annulé par l'exception finale).
-- T1 (test de l'audit rejoué, avec identifiant) : le même message envoyé 2 fois → 1 seule ligne, le 2e appel dit « deja ».
-- T2 : ancien téléphone (sans identifiant) → comportement d'avant (2 lignes), rien ne casse.
-- T3 (97a) : même identifiant dans une autre conversation → le message est bien écrit dans cette conversation (avant 97a : rien n'était écrit
--   et l'ancien message de l'autre conversation était rendu).
-- T3b (97a) : ce 2e message renvoyé une fois de plus → « deja », même ligne.
-- T4 : identifiant invalide → refusé.
do $$
declare a uuid; b uuid; c uuid; d uuid; d2 uuid; r1 json; r2 json; r3 json; r4 json; n1 int; n2 int; n3 int; t4 text := 'accepte';
begin
  select user_id into a from public.profils where supprime_le is null order by user_id limit 1;
  select user_id into b from public.profils where supprime_le is null and user_id <> a order by user_id limit 1;
  select user_id into c from public.profils where supprime_le is null and user_id not in (a, b) order by user_id limit 1;
  perform set_config('request.jwt.claims', json_build_object('sub', a, 'role', 'authenticated')::text, true);
  execute 'set local role authenticated';
  d := public.dm_ouvrir(b);
  d2 := public.dm_ouvrir(c);
  r1 := public.dm_envoyer(d, 'Bonjour, 10 sacs d''igname ?', 'test96c-abc123');
  r2 := public.dm_envoyer(d, 'Bonjour, 10 sacs d''igname ?', 'test96c-abc123');
  perform public.dm_envoyer(d, 'Message sans identifiant', null);
  perform public.dm_envoyer(d, 'Message sans identifiant');
  r3 := public.dm_envoyer(d2, 'Autre texte', 'test96c-abc123');
  r4 := public.dm_envoyer(d2, 'Autre texte', 'test96c-abc123');
  begin perform public.dm_envoyer(d, 'x', 'mauvais id !'); exception when others then t4 := 'refuse : ' || sqlerrm; end;
  execute 'reset role';   -- compter les lignes (la table n'est pas lisible directement par un membre)
  select count(*) into n1 from public.dm where discussion_id = d and texte = 'Bonjour, 10 sacs d''igname ?';
  select count(*) into n2 from public.dm where discussion_id = d and texte = 'Message sans identifiant';
  select count(*) into n3 from public.dm where discussion_id = d2;
  raise exception 'TEST: T1 lignes=% meme_id=% deja=% | T2 sans identifiant lignes=% | T3 autre conv lignes=% rendu=% | T3b renvoi autre conv deja=% meme_id=% | T4 %',
    n1, (r1->>'id') = (r2->>'id'), r2->>'deja', n2, n3, r3->>'texte', r4->>'deja', (r3->>'id') = (r4->>'id'), t4;
end $$;
-- Résultat (25/10/2026, après 97a) : T1 lignes=1 meme_id=t deja=true | T2 sans identifiant lignes=2 | T3 autre conv lignes=1 rendu=Autre texte
-- | T3b renvoi autre conv deja=true meme_id=t | T4 refuse : Identifiant de message invalide. (droits inchangés : anon non, authenticated oui)
