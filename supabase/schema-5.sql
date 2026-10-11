-- ═════════ Marché de Gros CI — étape 5 : photo de profil (12 octobre 2026) ═════════
-- À coller dans Supabase (SQL Editor → New query → coller → Run), APRÈS les étapes 1 à 4. Peut être relancé sans danger.
-- Un dossier public « avatars » : chaque compte n'y écrit qu'un seul fichier, <son identifiant>.jpg (≤ 300 Ko, JPEG ou WebP).
-- Tout le monde peut voir la photo (elle s'affiche à côté des annonces et des négociations) ; seul son propriétaire peut la remplacer ou la retirer.
-- Le profil garde un code court « ph:u=<id>;v=<version>;f=<fond> » (colonne avatar, ≤ 200 caractères, inchangée).

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('avatars', 'avatars', true, 307200, array['image/jpeg', 'image/webp'])
on conflict (id) do update set public = true, file_size_limit = 307200, allowed_mime_types = array['image/jpeg', 'image/webp'];

drop policy if exists "avatars : lecture" on storage.objects;
drop policy if exists "avatars : déposer la mienne" on storage.objects;
drop policy if exists "avatars : remplacer la mienne" on storage.objects;
drop policy if exists "avatars : retirer la mienne" on storage.objects;

create policy "avatars : lecture" on storage.objects for select
  using (bucket_id = 'avatars');
create policy "avatars : déposer la mienne" on storage.objects for insert to authenticated
  with check (bucket_id = 'avatars' and name = auth.uid()::text || '.jpg');
create policy "avatars : remplacer la mienne" on storage.objects for update to authenticated
  using (bucket_id = 'avatars' and name = auth.uid()::text || '.jpg')
  with check (bucket_id = 'avatars' and name = auth.uid()::text || '.jpg');
create policy "avatars : retirer la mienne" on storage.objects for delete to authenticated
  using (bucket_id = 'avatars' and name = auth.uid()::text || '.jpg');
