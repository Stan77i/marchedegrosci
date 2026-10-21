// ═════════ Marché de Gros CI — fonction Edge « itineraire » : le trajet d'une commande, calculé une seule fois ═════════
// Appelée par l'application, connectée, avec { commande_id } et le jeton de la session.
// • vérifie que la personne est le vendeur, l'acheteur, le chauffeur de la commande, ou un administrateur ;
// • si l'itinéraire est déjà rangé (table commande_itineraires, schéma 29), le renvoie sans rien recalculer ;
// • sinon : géocode le lieu de départ et le lieu de livraison en Côte d'Ivoire (openrouteservice, Pelias),
//   puis calcule le trajet routier pour un camion (driving-hgv) et le range, simplifié (400 points au plus) ;
// • si le trajet routier échoue : une ligne « à vol d'oiseau », clairement marquée comme telle (source 'vol_oiseau') ;
// • si un lieu est introuvable : source 'introuvable' (nouvel essai possible après 24 h).
// La clé ORS_API_KEY est lue dans les secrets Supabase (Edge Functions → Secrets) : jamais dans le code ni dans l'application.
// Offre gratuite openrouteservice : 2 000 trajets et 1 000 géocodages par jour ; ici, 1 trajet et 2 géocodages par commande.
import { createClient } from "npm:@supabase/supabase-js@2.45.4";

const sb = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, { auth: { persistSession: false } });
const ORS = Deno.env.get("ORS_API_KEY") || "";
const CORS = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "authorization, apikey, content-type", "Access-Control-Allow-Methods": "POST, OPTIONS" };
const json = (o: unknown, status = 200) => new Response(JSON.stringify(o), { status, headers: { ...CORS, "Content-Type": "application/json" } });

type Pt = [number, number]; // [lon, lat]
const km = (a: Pt, b: Pt) => { const r = Math.PI / 180, dLa = (b[1] - a[1]) * r, dLo = (b[0] - a[0]) * r;
  const x = Math.sin(dLa / 2) ** 2 + Math.cos(a[1] * r) * Math.cos(b[1] * r) * Math.sin(dLo / 2) ** 2; return 2 * 6371 * Math.asin(Math.sqrt(x)); };

async function geocode(t: string | null): Promise<Pt | null> {
  if (!t || !ORS) return null;
  const u = "https://api.openrouteservice.org/geocode/search?" + new URLSearchParams({ api_key: ORS, text: t + ", Côte d'Ivoire", "boundary.country": "CI", size: "1" });
  try {
    const r = await fetch(u, { signal: AbortSignal.timeout(8000) });
    if (!r.ok) return null;
    const j = await r.json(); const c = j?.features?.[0]?.geometry?.coordinates;
    return Array.isArray(c) && c.length >= 2 ? [Number(c[0]), Number(c[1])] : null;
  } catch (_) { return null; }
}

async function trajet(a: Pt, b: Pt) {
  if (!ORS) return null;
  try {
    const r = await fetch("https://api.openrouteservice.org/v2/directions/driving-hgv/geojson", {
      method: "POST", headers: { Authorization: ORS, "Content-Type": "application/json" }, body: JSON.stringify({ coordinates: [a, b] }), signal: AbortSignal.timeout(12000) });
    if (!r.ok) return null;
    const j = await r.json(); const f = j?.features?.[0];
    const L: Pt[] = f?.geometry?.coordinates || []; if (L.length < 2) return null;
    const pas = Math.max(1, Math.ceil(L.length / 400));
    const ligne = L.filter((_, i) => i % pas === 0 || i === L.length - 1).map(p => [Math.round(p[0] * 1e5) / 1e5, Math.round(p[1] * 1e5) / 1e5]);
    return { ligne, distance_m: f?.properties?.summary?.distance ?? null, duree_s: f?.properties?.summary?.duration ?? null };
  } catch (_) { return null; }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: CORS });
  if (req.method !== "POST") return json({ erreur: "méthode" }, 405);
  try {
    const jeton = (req.headers.get("authorization") || "").replace(/^Bearer\s+/i, "");
    const { data: u } = await sb.auth.getUser(jeton);
    if (!u?.user) return json({ erreur: "connexion" }, 401);
    let corps: Record<string, unknown> = {}; try { corps = await req.json(); } catch (_) { /* vide */ }
    const id = String(corps.commande_id || "");
    if (!/^[0-9a-f-]{36}$/.test(id)) return json({ erreur: "commande" }, 400);
    const { data: c } = await sb.from("commandes").select("id, vendeur_id, acheteur_id, transporteur_id, ville_depart, lieu_livraison").eq("id", id).maybeSingle();
    if (!c) return json({ erreur: "introuvable" }, 404);
    let ok = u.user.id === c.vendeur_id || u.user.id === c.acheteur_id;
    if (!ok && c.transporteur_id) { const { data: t } = await sb.from("transporteurs").select("user_id").eq("id", c.transporteur_id).maybeSingle(); ok = t?.user_id === u.user.id; }
    if (!ok) { const { data: a } = await sb.from("admins").select("user_id").eq("user_id", u.user.id).maybeSingle(); ok = !!a; }
    if (!ok) return json({ erreur: "introuvable" }, 404);

    const { data: deja } = await sb.from("commande_itineraires").select("*").eq("commande_id", id).maybeSingle();
    const vieux = deja && deja.source === "introuvable" && Date.now() - Date.parse(deja.calcule_le) > 864e5;
    if (deja && !vieux) return json(deja);
    if (!ORS) return json({ erreur: "La clé openrouteservice n'est pas configurée (secret ORS_API_KEY)." }, 503);

    const [a, b] = await Promise.all([geocode(c.ville_depart), geocode(c.lieu_livraison)]);
    let ligne: unknown = null, source = "introuvable", distance_m: number | null = null, duree_s: number | null = null;
    if (a && b) {
      const t = await trajet(a, b);
      if (t) { ligne = t.ligne; source = "ors"; distance_m = t.distance_m; duree_s = t.duree_s; }
      else { ligne = [a, b]; source = "vol_oiseau"; distance_m = Math.round(km(a, b) * 1000); }
    }
    const ligneRangee = { commande_id: id, source, depart: a, arrivee: b, ligne, distance_m, duree_s, calcule_le: new Date().toISOString() };
    await sb.from("commande_itineraires").upsert(ligneRangee);
    return json(ligneRangee);
  } catch (e) {
    return json({ erreur: String((e as Error).message || e) }, 500);
  }
});
