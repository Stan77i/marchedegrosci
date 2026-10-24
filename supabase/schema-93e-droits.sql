-- Schéma 93e : les fonctions internes des schémas 93a et 93d ne sont pas appelables par les membres ni sans compte.
revoke all on function public._ann_regle(text, numeric) from public, anon, authenticated;
revoke all on function public._ann_fin(timestamptz, timestamptz) from public, anon, authenticated;
revoke all on function public._ann_ville_ok(text, text) from public, anon, authenticated;
revoke all on function public._annonce_regles() from public, anon, authenticated;
revoke all on function public._groupe_offre_sortie() from public, anon, authenticated;
