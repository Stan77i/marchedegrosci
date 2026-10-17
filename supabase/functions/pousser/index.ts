// ═════════ Marché de Gros CI — fonction Edge « pousser » : envoie les notifications sur les téléphones (Web Push) ═════════
// Trois façons de l'appeler :
//  1. par la base (déclencheur public.push_message, via pg_net) à chaque nouveau message de négociation,
//     avec l'en-tête x-mdg-cle (clé partagée rangée dans le coffre) et { message_id } ;
//  2. par l'application, connectée, pour vérifier que les notifications marchent : { test: true } + le jeton de la session.
//  3. par la base (déclencheur public.push_dm) à chaque message direct, avec { dm_id } (schema-8) ;
//     un message d'un administrateur s'affiche au nom du « Marché de Gros » (schema-10) ;
//  4. par la base (déclencheur public.push_alerte) quand quelqu'un essaie de sortir de l'application, avec { alerte_id } :
//     tous les administrateurs sont prévenus (schema-10).
// Les clés VAPID et la clé partagée sont lues dans le coffre Supabase (push_config(), réservée au rôle service) — jamais dans le code.
import webpush from "npm:web-push@3.6.7";
import { createClient } from "npm:@supabase/supabase-js@2.45.4";

const sb = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, { auth: { persistSession: false } });
const CORS = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "authorization, apikey, content-type", "Access-Control-Allow-Methods": "POST, OPTIONS" };
const json = (o: unknown, status = 200) => new Response(JSON.stringify(o), { status, headers: { ...CORS, "Content-Type": "application/json" } });

let cfg: Record<string, string> | null = null;
async function config() {
  if (cfg) return cfg;
  const { data, error } = await sb.rpc("push_config");
  if (error || !data) throw new Error("configuration introuvable");
  cfg = data as Record<string, string>;
  webpush.setVapidDetails("https://stan77i.github.io/marchedegrosci/", cfg.mdg_vapid_public, cfg.mdg_vapid_prive);
  return cfg;
}

const F = (n: number | null | undefined) => n == null ? "" : new Intl.NumberFormat("fr-FR").format(Number(n)).replace(/ | /g, " ") + " F";
const coupe = (t: string, n: number) => t.length > n ? t.slice(0, n - 1) + "…" : t;

async function estAdmin(uid: string) {
  const { data } = await sb.from("admins").select("user_id").eq("user_id", uid).maybeSingle();
  return !!data;
}

async function nomDe(uid: string) {
  const { data } = await sb.from("profils").select("pseudo, prenom, nom, nom_public, supprime_le").eq("user_id", uid).maybeSingle();
  if (!data || data.supprime_le) return "Votre interlocuteur";
  if (data.pseudo) return data.pseudo;
  if (data.prenom) return data.prenom + (data.nom ? " " + (data.nom_public ? data.nom : data.nom[0] + ".") : "");
  return "Votre interlocuteur";
}

// envoie à tous les téléphones d'un compte ; retire ceux que le service de notification ne connaît plus
async function envoyer(uid: string, charge: Record<string, unknown>) {
  const { data: subs } = await sb.from("push_abonnements").select("endpoint, p256dh, auth").eq("user_id", uid);
  let ok = 0, retires = 0;
  for (const s of subs || []) {
    try {
      await webpush.sendNotification({ endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } }, JSON.stringify(charge), { TTL: 86400, urgency: "high" });
      ok++;
    } catch (e) {
      const code = (e as { statusCode?: number }).statusCode;
      if (code === 404 || code === 410) { await sb.from("push_abonnements").delete().eq("endpoint", s.endpoint); retires++; }
    }
  }
  return { telephones: (subs || []).length, envoyees: ok, retires };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: CORS });
  if (req.method !== "POST") return json({ erreur: "méthode" }, 405);
  let corps: Record<string, unknown> = {};
  try { corps = await req.json(); } catch (_) { /* vide */ }
  try {
    const c = await config();

    // 2. l'application vérifie ses notifications
    if (corps.test) {
      const jeton = (req.headers.get("authorization") || "").replace(/^Bearer\s+/i, "");
      const { data: u } = await sb.auth.getUser(jeton);
      if (!u?.user) return json({ erreur: "connexion" }, 401);
      const badge = (await sb.rpc("push_badge", { uid: u.user.id })).data ?? 0;
      return json(await envoyer(u.user.id, { title: "Les notifications sont activées", body: "Vous serez prévenu ici dès qu'on vous répond, même application fermée.", tag: "mdg-test", url: "application.dc.html#/", badge }));
    }

    // 1. un nouveau message de négociation
    if (req.headers.get("x-mdg-cle") !== c.mdg_push_cle) return json({ erreur: "refusé" }, 401);

    // 3. un message direct (messagerie, schema-8) : « Awa » · le texte
    if (corps.dm_id) {
      const { data: m } = await sb.from("dm").select("id, discussion_id, auteur_id, texte").eq("id", String(corps.dm_id)).maybeSingle();
      if (!m) return json({ erreur: "message introuvable" }, 404);
      const { data: d } = await sb.from("discussions").select("id, a_id, b_id").eq("id", m.discussion_id).maybeSingle();
      if (!d) return json({ erreur: "conversation introuvable" }, 404);
      const dest = m.auteur_id === d.a_id ? d.b_id : d.a_id;
      const badge = (await sb.rpc("push_badge", { uid: dest })).data ?? 0;
      const titre = (await estAdmin(m.auteur_id)) ? "Marché de Gros" : await nomDe(m.auteur_id);
      return json(await envoyer(dest, { title: titre, body: coupe(String(m.texte || ""), 140), tag: "dm-" + d.id, url: "application.dc.html#/?dm=" + d.id, dm: d.id, badge }));
    }

    // 4. une tentative de sortir de l'application : tous les administrateurs sont prévenus
    if (corps.alerte_id) {
      const { data: a } = await sb.from("alertes").select("id, user_id, motif, source, extrait").eq("id", String(corps.alerte_id)).maybeSingle();
      if (!a) return json({ erreur: "alerte introuvable" }, 404);
      const qui = a.user_id ? await nomDe(a.user_id) : "Un membre";
      const { data: ads } = await sb.from("admins").select("user_id");
      const res = [];
      for (const ad of ads || []) res.push(await envoyer(ad.user_id, { title: `Alerte : ${qui} veut sortir de l'application`, body: `${a.motif} dans ${a.source === "dm" ? "un message" : "une négociation"} — « ${coupe(String(a.extrait || ""), 90)} »`, tag: "alerte-" + a.id, url: "admin.html#messages" }));
      return json({ admins: res.length, res });
    }

    const id = String(corps.message_id || "");
    const { data: m } = await sb.from("messages").select("*").eq("id", id).maybeSingle();
    if (!m) return json({ erreur: "message introuvable" }, 404);
    const { data: n } = await sb.from("negociations").select("*").eq("id", m.negociation_id).maybeSingle();
    if (!n) return json({ erreur: "négociation introuvable" }, 404);
    const dest = m.auteur_id === n.auteur_id ? n.proprio_id : n.auteur_id;
    if (!dest || dest === m.auteur_id) return json({ rien: true });
    const qui = await nomDe(m.auteur_id), produit = n.produit || "votre annonce", u = n.unite || "kg";
    let title = qui, body = produit;
    if (m.genre === "prix") { title = `${qui} propose ${F(m.prix)} / ${u}`; body = `${produit}${m.quantite ? ` · ${new Intl.NumberFormat("fr-FR").format(m.quantite)} ${u}` : ""} — touchez pour répondre`; }
    else if (m.genre === "accord") { title = `Accord conclu avec ${qui}`; body = `${produit} à ${F(n.prix_final ?? m.prix)} / ${u}`; }
    else if (m.genre === "refus") { title = `${qui} a refusé votre proposition`; body = `${produit} — vous pouvez proposer un autre prix`; }
    else if (m.genre === "retrait") { title = `${qui} a retiré sa proposition`; body = produit; }
    else if (m.genre === "fin") { title = "Négociation terminée"; body = `${produit} avec ${qui}`; }
    else if (m.genre === "texte") { title = `${qui} · ${produit}`; body = coupe(String(m.texte || ""), 140); }
    const badge = (await sb.rpc("push_badge", { uid: dest })).data ?? 0;
    return json(await envoyer(dest, { title, body, tag: "nego-" + n.id, url: "application.dc.html#/?nego=" + n.id, nego: n.id, badge }));
  } catch (e) {
    return json({ erreur: String((e as Error).message || e) }, 500);
  }
});
