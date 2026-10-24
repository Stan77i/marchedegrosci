// ═════════ Marché de Gros CI — fonction Edge « pousser » : envoie les notifications sur les téléphones (Web Push) ═════════
// Façons de l'appeler :
//  1. par la base (déclencheur public.push_message, via pg_net) à chaque nouveau message de négociation,
//     avec l'en-tête x-mdg-cle (clé partagée rangée dans le coffre) et { message_id } ;
//  2. par l'application, connectée, pour vérifier que les notifications marchent : { test: true } + le jeton de la session.
//  3. par la base (déclencheur public.push_dm) à chaque message direct, avec { dm_id } (schema-8) ;
//     un message d'un administrateur s'affiche au nom du « Marché de Gros » (schema-10) ;
//  4. par la base (déclencheur public.push_alerte) quand quelqu'un essaie de sortir de l'application, avec { alerte_id } :
//     tous les administrateurs sont prévenus (schema-10) ;
//  5. ancien appel { annonce: 'offres' | 'demandes', id } (schema-12), gardé : depuis le schéma 88, les annonces passent par la
//     file d'attente (cas 18) ;
//  6. par la base (déclencheur public.push_identite) quand un dossier d'identité est envoyé, avec { identite_id },
//     et chaque matin (pg_cron) avec { resume_identites: true } : les administrateurs sont prévenus (schema-19) ;
//  7. par la base (déclencheur public.push_commande) à chaque étape d'une commande, avec { commande_etape_id } :
//     l'autre partie est prévenue (schema-26) ;
//  8. par la base (déclencheur public.push_mission) pour une mission de transport, avec { mission_id } (schema-27) ;
//  9. par la base (déclencheur public.push_transporteur) quand l'équipe décide d'un profil de transporteur, avec { transporteur_id }.
// 10. par la base (pg_cron, public.rappels_envoyer) pour un rappel d'achat, avec { rappel_id } (schema-33) : rien n'est acheté.
// 11. par la base (déclencheur public.push_groupe) pour un achat groupé, avec { groupe_id, statut }, { groupe_id, reconfirmer }
//     ou { groupe_id, rejoint } (schema-35, complété au schema-41 : groupe ouvert, nouvel acheteur).
// 12. par la base (déclencheur public.push_besoin) pour un besoin professionnel publié, avec { besoin_id } (schema-43) :
//     ceux qui suivent ses produits, les vendeurs de ces produits, puis les comptes à identité vérifiée.
// 13. par la base (pg_cron « mdg-marketing », public.marketing_tick, schema-45) avec { marketing: true, numero } :
//     un conseil ou un chiffre réel du marché, choisi selon le rôle, la région et l'activité ; un par jour au plus (schéma 88).
// 14. par la base (déclencheur public.push_code_demande, schéma 51) quand le chauffeur demande le code, avec { code_demande_id }.
//  7 bis (schéma 57) : refus de la marchandise après réception → le vendeur et le chauffeur inscrit sont prévenus ; clôture → « Commande clôturée ».
// 15. par la base (déclencheur public.push_litige_msg, schéma 58) pour un message de la discussion à trois, avec { litige_msg_id }.
// 16. par la base (déclencheur public.push_fiabilite, schéma 84) : { sanction_id } (avertissement, suspension) ou { contestation_id } (réponse).
// 17. par la base (déclencheur public.push_niveaux, schéma 85) : { niveau_journal_id } (nouveau niveau, grâce, baisse, retrait)
//     ou { niveau_contestation_id } (réponse de l'équipe à une contestation de niveau).
// 18. par la base (pg_cron « mdg-notif », public.notif_tick, schéma 88) avec { lots: true } : les messages en file d'attente
//     (nouvelles offres et demandes, groupe bientôt complet, veille de la date limite, produit à racheter), regroupés par
//     personne et par sujet : « 3 nouvelles offres : Tomate ».
// v21 (24/10/2026, schéma 88) : chaque envoi a une catégorie (transactionnel ou commercial), passe par public.notif_preparer
//     (préférences, plafond de 6 messages commerciaux par jour dont 1 conseil, heures calmes 21 h - 7 h, clé anti-doublon,
//     journal) et porte un identifiant d'envoi « nid » que le téléphone renvoie au clic (public.notif_ouverte). Le résultat
//     réel est noté (public.notif_resultat). Transactionnel : priorité haute, 24 h ; commercial : normale ou basse, 6 h.
//     Textes courts (titre 45, texte 80 caractères au plus), sans promesse non vérifiée.
// v19 (23/10/2026) : « Le camion est parti » (schéma 65), chargement sans « transport en cours ».
// v18 (22/10/2026) : titres sans emoji, phrases sans tiret long.
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

const nf = (n: number | string | null | undefined) => new Intl.NumberFormat("fr-FR").format(Number(n || 0)).replace(/[  ]/g, " ");
const F = (n: number | null | undefined) => n == null ? "" : nf(n) + " F";
const coupe = (t: string, n: number) => t.length > n ? t.slice(0, n - 1).trimEnd() + "…" : t;
const TITRE = 45, TEXTE = 80;
const APP = "application.dc.html";

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

// ce que la base doit savoir d'un envoi : sa catégorie et sa clé anti-doublon (une par personne et par événement)
type Meta = { cat: string; cle?: string; type?: string; objet?: string; slug?: string };
type Res = { telephones: number; envoyees: number; retires: number; raison?: string };
// catégories transactionnelles (même liste que public.notif_categories, nature 'trans')
const TRANS = new Set(["reponses", "negociation", "commande", "litige", "securite", "essai", "fiabilite", "niveaux", "groupe_suivi", "rappel"]);

// envoie à tous les téléphones d'un compte, après l'accord de la base (préférences, plafonds, heures calmes, doublons) ;
// retire les téléphones que le service de notification ne connaît plus et le note comme désactivation
async function envoyer(uid: string, charge: Record<string, unknown>, meta: Meta): Promise<Res> {
  const title = coupe(String(charge.title || ""), TITRE), body = coupe(String(charge.body || ""), TEXTE);
  const { data: p, error } = await sb.rpc("notif_preparer", {
    p_user: uid, p_cat: meta.cat, p_cle: meta.cle || null, p_type: meta.type || null, p_objet: meta.objet || null,
    p_slug: meta.slug || null, p_url: String(charge.url || ""), p_titre: title, p_corps: body });
  // schéma 88a absent (fonction déployée trop tôt) : les échanges en cours partent quand même, comme avant (sans journal) ;
  // le commercial attend le schéma. Toute autre erreur de la base : rien ne part.
  const absent = !!error && (error.code === "PGRST202" || /notif_preparer/.test(String(error.message || "")));
  if (error && !(absent && TRANS.has(meta.cat))) return { telephones: 0, envoyees: 0, retires: 0, raison: "erreur : " + error.message };
  const d = (error ? { envoyer: true, nature: "trans" } : p) as { envoyer: boolean; nid?: string; nature?: string; raison?: string };
  if (!d?.envoyer) return { telephones: 0, envoyees: 0, retires: 0, raison: d?.raison || "refus" };
  const trans = d.nature !== "com";
  const opts = trans ? { TTL: 86400, urgency: "high" as const } : { TTL: 21600, urgency: (meta.cat === "conseils" ? "low" : "normal") as "low" | "normal" };
  const contenu = JSON.stringify({ ...charge, title, body, nid: d.nid, cat: meta.cat });
  const { data: subs } = await sb.from("push_abonnements").select("endpoint, p256dh, auth").eq("user_id", uid);
  let ok = 0, retires = 0;
  for (const s of subs || []) {
    try {
      await webpush.sendNotification({ endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } }, contenu, opts);
      ok++;
    } catch (e) {
      const code = (e as { statusCode?: number }).statusCode;
      if (code === 404 || code === 410) {
        await sb.from("push_abonnements").delete().eq("endpoint", s.endpoint);
        await sb.rpc("notif_desactivation_noter", { p_user: uid, p_origine: "expire", p_cat: null });
        retires++;
      }
    }
  }
  if (d.nid) await sb.rpc("notif_resultat", { p_nid: d.nid, p_telephones: (subs || []).length, p_envoyees: ok });
  return { telephones: (subs || []).length, envoyees: ok, retires };
}

// envoi à beaucoup de comptes : paquets de 40 en parallèle
async function envoyerTous(ids: string[], fabrique: (u: string) => [Record<string, unknown>, Meta] | null) {
  let envoyees = 0, comptes = 0;
  const L = ids.filter(Boolean);
  for (let i = 0; i < L.length; i += 40) {
    const r = await Promise.all(L.slice(i, i + 40).map((u) => {
      const x = fabrique(u);
      return x ? envoyer(u, x[0], x[1]).catch(() => ({ envoyees: 0 } as Res)) : Promise.resolve({ envoyees: 0 } as Res);
    }));
    for (const x of r) { envoyees += x.envoyees || 0; if (x.envoyees) comptes++; }
  }
  return { cibles: L.length, comptes, envoyees };
}

const uuids = (data: unknown) => ((data || []) as unknown[]).map((x) => typeof x === "string" ? x : String(Object.values(x as Record<string, unknown>)[0] ?? "")).filter(Boolean);

// une annonce à tous (achat groupé ouvert, besoin professionnel) : préférence, plafond et région vus par la base
async function diffuser(cat: string, exclure: string[], region: string | null, identite: boolean, charge: Record<string, unknown>, cle: (u: string) => string, slug?: string) {
  const { data, error } = await sb.rpc("notif_cible_marche", { p_cat: cat, p_exclure: exclure, p_region: region, p_identite: identite, p_limite: 300 });
  if (error) return { erreur: error.message };
  return await envoyerTous(uuids(data), (u) => [charge, { cat, cle: cle(u), slug }]);
}

const jourUTC = () => new Date().toISOString().slice(0, 10);

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: CORS });
  if (req.method !== "POST") return json({ erreur: "méthode" }, 405);
  let corps: Record<string, unknown> = {};
  try { corps = await req.json(); } catch (_) { /* vide */ }
  try {
    const c = await config();

    // 2. l'application vérifie ses notifications : la réponse dit combien de téléphones ont accepté l'envoi
    if (corps.test) {
      const jeton = (req.headers.get("authorization") || "").replace(/^Bearer\s+/i, "");
      const { data: u } = await sb.auth.getUser(jeton);
      if (!u?.user) return json({ erreur: "connexion" }, 401);
      const badge = (await sb.rpc("push_badge", { uid: u.user.id })).data ?? 0;
      return json(await envoyer(u.user.id, { title: "Essai de notification", body: "Si vous lisez ceci, les notifications marchent sur ce téléphone.", tag: "mdg-test", url: APP + "#/", badge },
        { cat: "essai", cle: "essai:" + crypto.randomUUID() }));
    }

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
      return json(await envoyer(dest, { title: titre, body: String(m.texte || ""), tag: "dm-" + d.id, url: APP + "#/?dm=" + d.id, dm: d.id, badge },
        { cat: "reponses", cle: `dm:${m.id}:${dest}`, type: "dm", objet: d.id }));
    }

    // 4. une tentative de sortir de l'application : tous les administrateurs sont prévenus
    if (corps.alerte_id) {
      const { data: a } = await sb.from("alertes").select("id, user_id, motif, source, extrait").eq("id", String(corps.alerte_id)).maybeSingle();
      if (!a) return json({ erreur: "alerte introuvable" }, 404);
      const qui = a.user_id ? await nomDe(a.user_id) : "Un membre";
      const ou = a.source === "dm" ? "message" : a.source === "litige" ? "litige" : "négociation";
      const { data: ads } = await sb.from("admins").select("user_id");
      const res = [];
      for (const ad of ads || []) res.push(await envoyer(ad.user_id, { title: `Alerte : ${qui}`, body: `${a.motif} (${ou}) : « ${coupe(String(a.extrait || ""), 40)} »`, tag: "alerte-" + a.id, url: "admin.html#messages" },
        { cat: "securite", cle: `alerte:${a.id}:${ad.user_id}`, type: "alerte", objet: String(a.id) }));
      return json({ admins: res.length, res });
    }

    // 6. un dossier d'identité vient d'être envoyé, ou le résumé du matin : tous les administrateurs, sans donnée personnelle.
    //    Même étiquette « identite » : une nouvelle notification remplace la précédente.
    if (corps.identite_id || corps.resume_identites) {
      const { count } = await sb.from("verifications").select("id", { count: "exact", head: true }).eq("statut", "en_attente");
      const n = count || 0;
      if (!n) return json({ rien: true });
      const { data: ads } = await sb.from("admins").select("user_id");
      const res = [], quoi = corps.identite_id ? String(corps.identite_id) : "matin-" + jourUTC();
      for (const ad of ads || []) res.push(await envoyer(ad.user_id, {
        title: corps.resume_identites ? "Dossiers d'identité en attente" : "Nouveau dossier d'identité",
        body: n + (n > 1 ? " dossiers" : " dossier") + " à examiner" + (corps.resume_identites ? " ce matin" : ""),
        tag: "identite", url: "admin.html#identites" }, { cat: "securite", cle: `identite:${quoi}:${ad.user_id}`, type: "identite" }));
      return json({ admins: res.length, dossiers: n, res });
    }

    // 7. une étape de commande ({ commande_etape_id }, schema-26) : l'autre partie est prévenue
    if (corps.commande_etape_id) {
      const { data: e } = await sb.from("commande_etapes").select("id, commande_id, evenement, par, lieu, note").eq("id", String(corps.commande_etape_id)).maybeSingle();
      if (!e) return json({ erreur: "étape introuvable" }, 404);
      const { data: k } = await sb.from("commandes").select("id, numero, vendeur_id, acheteur_id, produit, validation, transporteur_id, refus_le, etat").eq("id", e.commande_id).maybeSingle();
      if (!k) return json({ erreur: "commande introuvable" }, 404);
      const dests = [k.vendeur_id, k.acheteur_id].filter((u: string) => u && u !== e.par);
      const qui = e.par ? await nomDe(e.par) : "Marché de Gros", produit = coupe(k.produit || "votre commande", 30);
      const T: Record<string, [string, string]> = {
        creee: [`${qui} vous propose une commande`, `${produit}. Touchez pour confirmer.`],
        confirmee: ["Commande confirmée", `${produit} · ${qui} a confirmé`],
        refusee: ["Commande refusée", `${produit} · ${qui} a refusé`],
        preparation: ["Marchandise en préparation", produit],
        chargement: ["Chargement confirmé", produit],
        transport: e.par ? [`${qui} : le camion est parti`, `${produit} · en route vers la livraison`] : ["Le camion est parti", `${produit} · départ vu par le lien de suivi du chauffeur`],
        transbordement: ["Transbordement", `${produit}${e.lieu ? " · " + e.lieu : ""}`],
        arrivee: ["Le chauffeur est arrivé", produit],
        reception: ["Réception confirmée, commande terminée", produit],
        annulation_demandee: [`${qui} demande l'annulation`, `${produit}. Touchez pour répondre.`],
        annulation_refusee: ["Annulation refusée", produit],
        annulee: ["Commande annulée", produit],
        litige: [`${qui} a ouvert un litige`, `${produit}. L'équipe va examiner.`],
        terminee: ["Commande clôturée", `${produit}${e.note ? " · " + String(e.note) : ""}`],
      };
      // schéma 57 : l'acheteur refuse la marchandise après réception (photos) → le vendeur doit répondre
      if (e.evenement === "litige" && k.refus_le) T.litige = [`${qui} refuse la marchandise`, `${produit}. Voyez les photos et répondez.`];
      const [title, body] = T[e.evenement] || ["Votre commande avance", produit];
      const res = [];
      // commande « avec codes » (schéma 28) : on rappelle à celui qui détient le code de le garder et de le présenter au bon moment
      const rappel = (d: string): [string, string] | null => {
        if (k.validation !== "code") return null;
        if (d === k.acheteur_id && ["chargement", "transbordement"].includes(e.evenement)) return [title, `${produit} · Gardez votre code de réception pour la livraison.`];
        if (d === k.acheteur_id && e.evenement === "arrivee") return ["Chauffeur arrivé : préparez votre code", `${produit} · Son code d'abord, puis la marchandise, puis le vôtre.`];
        if (d === k.vendeur_id && e.evenement === "confirmee") return [title, `${produit} · Gardez votre code de prise en charge pour le chargement.`];
        return null;
      };
      const meta = (d: string): Meta => ({ cat: e.evenement === "litige" ? "litige" : "commande", cle: `cmd:${e.id}:${d}`, type: e.evenement, objet: k.id });
      for (const d of dests) { const [t2, b2] = rappel(d) || [title, body]; res.push(await envoyer(d, { title: t2, body: b2, tag: "cmd-" + k.id, url: APP + "#/?commande=" + k.id }, meta(d))); }
      // schéma 57 : le chauffeur inscrit est prévenu du refus, pour dire ce qu'il a vu à la livraison
      if (e.evenement === "litige" && k.refus_le && k.transporteur_id) {
        const { data: t } = await sb.from("transporteurs").select("user_id").eq("id", k.transporteur_id).maybeSingle();
        if (t?.user_id && t.user_id !== e.par) res.push(await envoyer(t.user_id, { title: "L'acheteur refuse la marchandise", body: `${produit} · Répondez dans l'Espace chauffeur. Le transport reste dû.`, tag: "mission-cmd-" + k.id, url: APP + "#/?chauffeur=1" },
          { cat: "litige", cle: `cmd:${e.id}:chauffeur:${t.user_id}`, type: "refus", objet: k.id }));
      }
      // le chauffeur inscrit (schéma 51) : on lui rappelle d'exiger le code au bon moment
      if (k.validation === "code" && k.transporteur_id) {
        const { data: t } = await sb.from("transporteurs").select("user_id").eq("id", k.transporteur_id).maybeSingle();
        const C: Record<string, [string, string]> = {
          preparation: ["Marchandise en préparation", `${produit} · Au chargement, exigez le code du vendeur.`],
          chargement: ["Chargement confirmé", `${produit} · À la livraison, exigez le code de l'acheteur.`],
          arrivee: ["Exigez le code de réception", `${produit} · L'acheteur vérifie, puis vous montre son code.`],
        };
        if (t?.user_id && t.user_id !== e.par && C[e.evenement]) res.push(await envoyer(t.user_id, { title: C[e.evenement][0], body: C[e.evenement][1], tag: "mission-cmd-" + k.id, url: APP + "#/?chauffeur=1" },
          { cat: "commande", cle: `cmd:${e.id}:chauffeur:${t.user_id}`, type: e.evenement, objet: k.id }));
        // arrivée signalée par le chauffeur lui-même : le rappel lui est donné dans l'application, pas en notification
      }
      return json({ res });
    }

    // 15. un message dans la discussion à trois d'un litige (schéma 58) : l'acheteur, le vendeur et les administrateurs, sauf l'auteur
    if (corps.litige_msg_id) {
      const { data: lm } = await sb.from("litige_messages").select("id, commande_id, auteur_id, role, texte").eq("id", Number(corps.litige_msg_id)).maybeSingle();
      if (!lm) return json({ rien: true });
      const { data: k } = await sb.from("commandes").select("id, numero, vendeur_id, acheteur_id, produit").eq("id", lm.commande_id).maybeSingle();
      if (!k) return json({ rien: true });
      const qui = lm.role === "admin" ? "Marché de Gros" : lm.role === "vendeur" ? "Le vendeur" : "L'acheteur";
      const { data: ads } = await sb.from("admins").select("user_id");
      const res = [], vus = new Set<string>([lm.auteur_id]);
      for (const d of [k.vendeur_id, k.acheteur_id]) if (d && !vus.has(d)) { vus.add(d); res.push(await envoyer(d, { title: `${qui} · litige ${k.produit || ""}`.trim(), body: String(lm.texte || ""), tag: "litige-" + k.id, url: APP + "#/?commande=" + k.id }, { cat: "litige", cle: `litige:${lm.id}:${d}`, type: "litige_msg", objet: k.id })); }
      for (const ad of ads || []) if (!vus.has(ad.user_id)) { vus.add(ad.user_id); res.push(await envoyer(ad.user_id, { title: `${qui} · litige n° ${k.numero}`, body: String(lm.texte || ""), tag: "litige-" + k.id, url: "admin.html#commandes" }, { cat: "litige", cle: `litige:${lm.id}:${ad.user_id}`, type: "litige_msg", objet: k.id })); }
      return json({ res });
    }

    // 14. le chauffeur demande le code dans l'application (schéma 51). Le code n'est jamais dans la notification : il se montre
    //     sur place. On rappelle d'exiger d'abord le code transporteur du chauffeur. Étiquette à part : rien ne l'efface.
    if (corps.code_demande_id) {
      const { data: q } = await sb.from("code_demandes").select("id, commande_id, quoi").eq("id", String(corps.code_demande_id)).maybeSingle();
      if (!q) return json({ rien: true });
      const { data: k } = await sb.from("commandes").select("id, vendeur_id, acheteur_id, produit, transporteur_id").eq("id", q.commande_id).maybeSingle();
      if (!k) return json({ rien: true });
      const { data: t } = k.transporteur_id ? await sb.from("transporteurs").select("nom, code").eq("id", k.transporteur_id).maybeSingle() : { data: null };
      const produit = coupe(k.produit || "votre commande", 24), tc = t?.code ? ` (${t.code})` : "";
      const pec = q.quoi === "prise_en_charge", dest = pec ? k.vendeur_id : k.acheteur_id;
      return json(await envoyer(dest, {
        title: pec ? "Code de prise en charge demandé" : "Code de réception demandé",
        body: pec ? `${produit} · Exigez son code${tc}, chargez, puis montrez le vôtre.` : `${produit} · Exigez son code${tc}, vérifiez, puis montrez le vôtre.`,
        tag: "cmd-" + k.id + "-code", url: APP + "#/?commande=" + k.id }, { cat: "commande", cle: `code:${q.id}:${dest}`, type: "code", objet: k.id }));
    }

    // 8. une mission de transport (schema-27) : proposée → le chauffeur ; acceptée ou refusée → l'acheteur et le vendeur
    if (corps.mission_id) {
      const { data: m } = await sb.from("transport_missions").select("id, commande_id, transporteur_id, statut").eq("id", String(corps.mission_id)).maybeSingle();
      if (!m) return json({ erreur: "mission introuvable" }, 404);
      const { data: t } = await sb.from("transporteurs").select("user_id, nom").eq("id", m.transporteur_id).maybeSingle();
      const { data: k } = await sb.from("commandes").select("id, vendeur_id, acheteur_id, produit, ville_depart, lieu_livraison").eq("id", m.commande_id).maybeSingle();
      if (!t || !k) return json({ rien: true });
      const produit = coupe(k.produit || "une commande", 24);
      if (m.statut === "proposee") {
        if (!t.user_id) return json({ rien: true });
        return json(await envoyer(t.user_id, { title: "Nouvelle mission de transport", body: `${produit} · ${k.ville_depart || "départ à préciser"} → ${k.lieu_livraison || "livraison à préciser"}`, tag: "mission-" + m.id, url: APP + "#/?chauffeur=1" },
          { cat: "commande", cle: `mission:${m.id}:proposee:${t.user_id}`, type: "mission", objet: k.id }));
      }
      if (m.statut !== "acceptee" && m.statut !== "refusee") return json({ rien: true });
      const res = [];
      for (const d of [k.vendeur_id, k.acheteur_id]) res.push(await envoyer(d, {
        title: m.statut === "acceptee" ? `${t.nom} transportera votre commande` : `${t.nom} a refusé la mission`,
        body: m.statut === "acceptee" ? produit : `${produit}. Choisissez un autre transporteur.`, tag: "cmd-" + k.id + "-mission", url: APP + "#/?commande=" + k.id },
        { cat: "commande", cle: `mission:${m.id}:${m.statut}:${d}`, type: "mission", objet: k.id }));
      return json({ res });
    }

    // 9. décision de l'équipe sur un profil de transporteur (schema-27)
    if (corps.transporteur_id) {
      const { data: t } = await sb.from("transporteurs").select("user_id, statut").eq("id", String(corps.transporteur_id)).maybeSingle();
      if (!t || !t.user_id) return json({ rien: true });
      const T: Record<string, [string, string]> = {
        verifie: ["Profil de transporteur vérifié", "Vous pouvez vous dire disponible et recevoir des missions."],
        refuse: ["Profil de transporteur refusé", "Touchez pour voir le motif."],
        suspendu: ["Profil de transporteur suspendu", "Touchez pour voir le motif."],
      };
      const [title, body] = T[t.statut] || ["Votre profil de transporteur a changé", "Touchez pour voir."];
      return json(await envoyer(t.user_id, { title, body, tag: "transporteur", url: APP + "#/?chauffeur=1" }, { cat: "securite", type: "transporteur" }));
    }

    // 16. fiabilité (schéma 84) : seul le membre concerné est prévenu ; le détail reste dans « Ma fiabilité ».
    if (corps.sanction_id) {
      const { data: s } = await sb.from("sanctions").select("id, user_id, type, nb_90j, fin").eq("id", String(corps.sanction_id)).maybeSingle();
      if (!s) return json({ rien: true });
      const fin = s.fin ? new Date(s.fin).toLocaleDateString("fr-FR", { day: "numeric", month: "long", timeZone: "Africa/Abidjan" }) : "";
      const T: Record<string, [string, string]> = {
        avertissement: ["Une annulation compte contre vous", "Touchez pour voir le détail. Vous pouvez la contester pendant 7 jours."],
        baisse: ["Votre score de fiabilité baisse", `${s.nb_90j} annulations comptent contre vous sur 90 jours. Touchez pour voir.`],
        examen: ["Votre compte va être examiné", `${s.nb_90j} annulations sur 90 jours : l'équipe va regarder votre compte.`],
        suspension: ["Votre compte est suspendu", `Jusqu'au ${fin}. Vos annonces sont cachées, vos commandes continuent.`],
      };
      const [title, body] = T[s.type] || ["Votre fiabilité a changé", "Touchez pour voir le détail."];
      // une suspension se signale toujours (catégorie sécurité, qui ne se coupe pas)
      return json(await envoyer(s.user_id, { title, body, tag: "fiabilite", url: APP + "#/?fiabilite=1" }, { cat: s.type === "suspension" ? "securite" : "fiabilite", cle: `sanction:${s.id}`, type: s.type }));
    }
    if (corps.contestation_id) {
      const { data: t } = await sb.from("contestations").select("id, auteur_id, statut").eq("id", String(corps.contestation_id)).maybeSingle();
      if (!t || t.statut === "ouverte") return json({ rien: true });
      return json(await envoyer(t.auteur_id, { title: t.statut === "acceptee" ? "Contestation acceptée" : "Contestation refusée",
        body: t.statut === "acceptee" ? "L'annulation ne compte plus contre vous." : "L'annulation compte toujours. Touchez pour lire la réponse.", tag: "fiabilite", url: APP + "#/?fiabilite=1" },
        { cat: "fiabilite", cle: `contestation:${t.id}:${t.statut}`, type: "contestation" }));
    }

    // 17. niveaux (schéma 85) : seul le membre concerné est prévenu ; le détail est dans « Mes niveaux ».
    if (corps.niveau_journal_id) {
      const { data: j } = await sb.from("niveaux_journal").select("id, user_id, role, evenement, ancien, nouveau, raison").eq("id", String(corps.niveau_journal_id)).maybeSingle();
      if (!j) return json({ rien: true });
      const { data: rg } = await sb.from("niveaux_regles").select("cle, libelle").eq("role", j.role);
      const lib = (k: string | null) => (rg || []).find((x: { cle: string }) => x.cle === k)?.libelle || "";
      const T: Record<string, [string, string]> = {
        monte: [`Nouveau niveau : ${lib(j.nouveau)}`, "Bravo. Il s'affiche maintenant sur votre profil et vos annonces."],
        grace: [`Votre niveau ${lib(j.ancien)} est en sursis`, `${j.raison || ""} pour retrouver les critères. Touchez pour voir.`],
        descend: [`Votre niveau passe à ${lib(j.nouveau)}`, `Critères de ${lib(j.ancien)} non remplis. Contestation possible 7 jours.`],
        retire: [`Votre niveau ${lib(j.ancien)} est retiré`, "Les critères ne sont plus remplis. Contestation possible 7 jours."],
        gros: ["Nouveau badge : Acheteur en gros", "Il s'affiche maintenant sur votre profil."],
        gros_grace: ["Badge Acheteur en gros en sursis", `${j.raison || ""} pour retrouver les critères.`],
        gros_retire: ["Badge Acheteur en gros retiré", "Les critères ne sont plus remplis. Contestation possible 7 jours."],
      };
      const t = T[j.evenement];
      if (!t) return json({ rien: true });
      return json(await envoyer(j.user_id, { title: t[0], body: t[1], tag: "niveaux", url: APP + "#/?niveaux=1" }, { cat: "niveaux", cle: `niveau:${j.id}`, type: j.evenement }));
    }
    if (corps.niveau_contestation_id) {
      const { data: c2 } = await sb.from("niveaux_contestations").select("id, user_id, statut").eq("id", String(corps.niveau_contestation_id)).maybeSingle();
      if (!c2 || c2.statut === "ouverte") return json({ rien: true });
      return json(await envoyer(c2.user_id, { title: c2.statut === "acceptee" ? "Contestation de niveau acceptée" : "Contestation de niveau refusée",
        body: c2.statut === "acceptee" ? "L'équipe vous rend votre niveau. Touchez pour voir." : "Votre niveau ne change pas. Touchez pour lire la réponse.", tag: "niveaux", url: APP + "#/?niveaux=1" },
        { cat: "niveaux", cle: `niveau_contestation:${c2.id}:${c2.statut}`, type: "contestation" }));
    }

    // 10. un rappel d'achat choisi par l'acheteur (schema-33) : il ouvre l'écran « Racheter », rien n'est commandé
    if (corps.rappel_id) {
      const { data: r } = await sb.from("rappels_achat").select("id, user_id, commande_id, produit, actif").eq("id", String(corps.rappel_id)).maybeSingle();
      if (!r || !r.actif) return json({ rien: true });
      return json(await envoyer(r.user_id, { title: `Racheter ${coupe(r.produit || "votre produit", 30)} ?`,
        body: "Voyez le prix et le stock du jour. Rien n'est commandé sans vous.", tag: "rappel-" + r.id,
        url: APP + "#/?racheter=" + r.commande_id }, { cat: "rappel", cle: `rappel:${r.id}:${String(corps.prevu || jourUTC())}`, type: "rappel", objet: r.commande_id }));
    }

    // 11. un achat groupé change de statut, ou un participant doit reconfirmer (le prix a changé)
    if (corps.groupe_id) {
      const { data: g } = await sb.from("groupes_achat").select("id, vendeur_id, createur_id, produit, statut, prix_final, confirmer_avant, offre_id, region_slug, updated_at").eq("id", String(corps.groupe_id)).maybeSingle();
      if (!g) return json({ rien: true });
      const url = APP + "#/?groupe=" + g.id, tag = "groupe-" + g.id, produit = coupe(g.produit || "Achat groupé", 28), v = String(g.updated_at || "");
      const suivi = (u: string, quoi: string): Meta => ({ cat: "groupe_suivi", cle: `groupe:${g.id}:${quoi}:${v}:${u}`, type: quoi, objet: g.id });
      if (corps.reconfirmer) { const u = String(corps.reconfirmer); return json(await envoyer(u, { title: `${produit} : le prix a changé`, body: `Nouveau prix ${F(g.prix_final)}. Reconfirmez, ou retirez-vous.`, tag, url }, suivi(u, "reconfirmer"))); }
      const { data: ps } = await sb.from("groupe_participants").select("user_id").eq("groupe_id", g.id).neq("statut", "retire");
      const parts = (ps || []).map((p: { user_id: string }) => p.user_id);
      // un acheteur rejoint : le créateur et le vendeur (la notification remplace la précédente, même étiquette)
      if (corps.rejoint) {
        if (g.statut === "propose") return json({ rien: true });   // le créateur s'inscrit en proposant : le vendeur reçoit déjà « proposé »
        const qui = String(corps.rejoint), res = [];
        for (const d of [...new Set([g.createur_id, g.vendeur_id])].filter((u) => u && u !== qui))
          res.push(await envoyer(d, { title: `${produit} : un acheteur a rejoint`, body: `${parts.length} participant${parts.length > 1 ? "s" : ""} pour l'instant. Touchez pour suivre le groupe.`, tag, url },
            { cat: "groupe_suivi", cle: `groupe:${g.id}:rejoint:${qui}:${d}`, type: "rejoint", objet: g.id }));
        return json({ res });
      }
      // le groupe s'ouvre : le créateur ; ceux qui suivent ce produit ; puis les autres comptes, même région d'abord
      if (corps.statut === "ouvert") {
        const res = [];
        if (g.createur_id && g.createur_id !== g.vendeur_id) res.push(await envoyer(g.createur_id, { title: `${produit} : le groupe est ouvert`, body: "Le vendeur a fixé ses conditions. Partagez le groupe pour atteindre le seuil.", tag, url }, suivi(g.createur_id, "ouvert")));
        const { data: o } = g.offre_id ? await sb.from("offres").select("product_slug").eq("id", g.offre_id).maybeSingle() : { data: null };
        if (o?.product_slug) {
          const { data: abos } = await sb.from("alertes_produits").select("user_id").eq("product_slug", o.product_slug).eq("offres", true);
          const deja = new Set([g.vendeur_id, g.createur_id, ...parts]);
          const charge = { title: `Achat groupé : ${produit}`, body: "Achetez à plusieurs. Rien n'est commandé sans votre confirmation.", tag, url: APP + "#/?groupe=" + g.id };
          for (const ab of abos || []) if (!deja.has(ab.user_id)) { deja.add(ab.user_id); res.push(await envoyer(ab.user_id, charge, { cat: "groupes", cle: `groupe:${g.id}:ouvert:${ab.user_id}`, type: "groupe_ouvert", objet: g.id, slug: o.product_slug })); }
          const tous = await diffuser("groupes", [...deja].filter(Boolean) as string[], g.region_slug || null, false, charge, (u) => `groupe:${g.id}:ouvert:${u}`, o.product_slug);
          return json({ res, tous });
        }
        return json({ res });
      }
      const T: Record<string, [string[], string, string][]> = {
        propose: [[[g.vendeur_id], `Achat groupé proposé : ${produit}`, "Un acheteur propose un groupe sur votre offre. Fixez vos conditions ou refusez."]],
        seuil_atteint: [
          [[g.vendeur_id], `${produit} : seuil atteint`, "Lancez la confirmation : chaque participant confirmera sa quantité."],
          [parts.filter((u: string) => u !== g.vendeur_id), `${produit} : seuil atteint`, "Le vendeur doit maintenant lancer la confirmation. Rien n'est commandé avant."],
        ],
        en_attente_confirmation: [[parts, `${produit} : confirmez votre part`, `Prix final ${F(g.prix_final)}. Rien n'est commandé sans votre confirmation.`]],
        confirme: [[[g.vendeur_id, ...parts], `${produit} : achat groupé confirmé`, "Les commandes sont créées. Suivez-les dans Mes commandes."]],
        expire: [[[g.vendeur_id, ...parts], `${produit} : achat groupé expiré`, "Le seuil n'a pas été atteint. Vous pouvez acheter seul si vous le souhaitez."]],
        annule: [[[g.vendeur_id, ...parts].filter((u) => u !== g.createur_id), `${produit} : achat groupé annulé`, "Aucune commande n'a été créée."]],
      };
      const t = T[String(corps.statut)]; if (!t) return json({ rien: true });
      const res = [], vus = new Set<string>();
      for (const [ds, title, body] of t) for (const d of ds) if (d && !vus.has(d)) { vus.add(d); res.push(await envoyer(d, { title, body, tag, url }, suivi(d, String(corps.statut)))); }
      return json({ res });
    }

    // 18. la file d'attente (schéma 88) : un message par personne et par sujet, regroupé
    if (corps.lots) {
      const { data, error } = await sb.rpc("notif_lots_prendre", { p_max: 300 });
      if (error) return json({ erreur: error.message }, 500);
      type Lot = { user_id: string; regroupe: string; cat: string; type: string; n: number; premier_id: number; slug: string | null; libelle: string | null; objet_id: string | null; url: string | null; donnees: Record<string, unknown> };
      const lots = (data || []) as Lot[];
      const message = (l: Lot): [Record<string, unknown>, Meta] | null => {
        const d = l.donnees || {}, lib = coupe(String(l.libelle || l.slug || "ce produit"), 24), u = String(d.unite || "kg"), n = Number(l.n || 1);
        const qte = d.quantite ? `${nf(d.quantite as number)} ${u}` : "", ville = d.ville ? String(d.ville) : "";
        const meta: Meta = { cat: l.cat, cle: "lot:" + l.premier_id, type: l.type, objet: l.objet_id || undefined, slug: l.slug || undefined };
        const tag = l.cat + "-" + (l.slug || l.regroupe);
        if (l.type === "offre") {
          if (n > 1) return [{ title: `${n} nouvelles offres : ${lib}`, body: "Touchez pour comparer les prix et les quantités.", tag, url: l.url }, meta];
          const px = d.prix ? `${F(d.prix as number)} / ${u}` : "";
          return [{ title: `Nouvelle offre : ${lib}`, body: [qte, ville, px].filter(Boolean).join(" · ") || "Touchez pour voir le prix.", tag, url: l.url }, meta];
        }
        if (l.type === "demande") {
          if (n > 1) return [{ title: `${n} acheteurs cherchent : ${lib}`, body: "Touchez pour voir leurs demandes et proposer votre prix.", tag, url: l.url }, meta];
          const bu = d.prix ? `budget ${F(d.prix as number)} / ${u}` : "";
          return [{ title: `Un acheteur cherche : ${lib}`, body: [qte, ville, bu].filter(Boolean).join(" · ") || "Touchez pour voir la demande.", tag, url: l.url }, meta];
        }
        if (l.type === "groupe_proche") {
          const manque = `${nf(d.manque as number)} ${u}`;
          return [{ title: `${lib} : groupe bientôt complet`, body: l.cat === "groupes" ? `Il manque ${manque}. Rejoignez le groupe si le prix vous va.` : `Il manque ${manque} pour atteindre l'objectif du groupe.`, tag: "groupe-" + l.objet_id, url: l.url }, meta];
        }
        if (l.type === "groupe_veille") {
          // la vraie date limite (heure d'Abidjan = UTC) : « aujourd'hui » ou « demain » selon le jour réel, jamais au hasard
          const lim = d.limite ? new Date(String(d.limite)) : null, jr = (x: Date) => x.toISOString().slice(0, 10);
          const demain = new Date(Date.now() + 86400e3);
          const quand = lim && !isNaN(+lim) ? (jr(lim) === jr(new Date()) ? "aujourd'hui" : jr(lim) === jr(demain) ? "demain" : "") : "";
          const heure = lim && !isNaN(+lim) ? ` Fin à ${lim.getUTCHours()} h${lim.getUTCMinutes() ? " " + String(lim.getUTCMinutes()).padStart(2, "0") : ""}.` : "";
          return [{ title: quand ? `${lib} : se termine ${quand}` : `${lib} : date limite proche`, body: d.statut === "seuil_atteint" ? `Seuil atteint. Le vendeur doit lancer la confirmation.` : `Il manque ${nf(d.manque as number)} ${u}.${heure}`, tag: "groupe-" + l.objet_id, url: l.url }, meta];
        }
        if (l.type === "renouveler") {
          const j = Number(d.jours || 0);
          return [{ title: `Racheter ${lib} ?`, body: `Vous en commandez environ tous les ${nf(j)} jours. Rien n'est commandé sans vous.`, tag: "renouveler-" + l.slug, url: l.url }, meta];
        }
        return null;
      };
      let envoyees = 0, refus = 0;
      for (let i = 0; i < lots.length; i += 40) {
        const r = await Promise.all(lots.slice(i, i + 40).map((l) => { const m = message(l); return m ? envoyer(l.user_id, m[0], m[1]).catch(() => ({ envoyees: 0 } as Res)) : Promise.resolve({ envoyees: 0 } as Res); }));
        for (const x of r) { envoyees += x.envoyees || 0; if (!x.envoyees) refus++; }
      }
      return json({ lots: lots.length, envoyees, sans_envoi: refus });
    }

    // 5. ancien appel : une nouvelle annonce (les annonces passent maintenant par la file d'attente, cas 18)
    if (corps.annonce && corps.id) {
      const t = corps.annonce === "demandes" ? "demandes" : "offres";
      const { data: a } = await sb.from(t).select("*").eq("id", String(corps.id)).maybeSingle();
      if (!a || a.status !== "active") return json({ rien: true });
      if (t === "demandes" && a.besoin_id) return json({ rien: true, besoin: true });
      const { data: cib } = await sb.rpc("notif_cible_annonce", { p_table: t, p_id: a.id });
      const nom = coupe(a.product_label || a.product_slug, 24), u = a.unit || "kg", px = t === "offres" ? a.price : a.budget;
      const corpsTxt = [a.quantity ? nf(a.quantity) + " " + u : "", a.city || "", px ? (t === "offres" ? "" : "budget ") + F(px) + " / " + u : ""].filter(Boolean).join(" · ");
      const charge = { title: (t === "offres" ? "Nouvelle offre : " : "Un acheteur cherche : ") + nom, body: corpsTxt || "Touchez pour voir", tag: (t === "offres" ? "offres-" : "pour_vendeur-") + a.product_slug, url: APP + "#/produits/" + a.product_slug };
      const ids = ((cib || []) as { user_id: string }[]).map((x) => x.user_id);
      return json(await envoyerTous(ids, (x) => [charge, { cat: t === "offres" ? "offres" : "pour_vendeur", cle: `annonce:${a.id}:${x}`, type: t === "offres" ? "offre" : "demande", objet: a.id, slug: a.product_slug }]));
    }

    // 12. un besoin professionnel publié (une seule notification pour tout le besoin)
    if (corps.besoin_id) {
      const { data: b } = await sb.from("besoins").select("id, user_id, titre, type_acheteur, frequence, ville, region_slug, statut").eq("id", String(corps.besoin_id)).maybeSingle();
      if (!b || b.statut !== "ouvert") return json({ rien: true });
      const { data: ds } = await sb.from("demandes").select("product_slug, product_label").eq("besoin_id", b.id);
      const slugs = [...new Set((ds || []).map((d: { product_slug: string }) => d.product_slug))];
      const noms = [...new Set((ds || []).map((d: { product_label: string; product_slug: string }) => d.product_label || d.product_slug))];
      if (!slugs.length) return json({ rien: true });
      const TYPES: Record<string, string> = { restaurant: "Un restaurant", hotel: "Un hôtel", cantine: "Une cantine", revendeur: "Un revendeur", autre: "Un professionnel" };
      const nomQ = await nomDe(b.user_id), qui = nomQ === "Votre interlocuteur" ? (TYPES[b.type_acheteur] || "Un professionnel") : nomQ;
      const quand = b.frequence === "mensuelle" ? " chaque mois" : b.frequence === "hebdomadaire" ? " chaque semaine" : "";
      const lieu = b.ville || "";
      const charge = { title: `${qui} s'approvisionne${quand}`, body: `${noms.slice(0, 3).join(", ")}${noms.length > 3 ? "…" : ""}${lieu ? " · " + lieu : ""}. Proposez vos prix.`, tag: "besoin-" + b.id, url: APP + "#/?besoin=" + b.id };
      const prevenus = new Set<string>([b.user_id]), perso: string[] = [];
      // personnel : ceux qui suivent ces produits, et les vendeurs qui en ont en stock
      const { data: abos } = await sb.from("alertes_produits").select("user_id").in("product_slug", slugs).eq("demandes", true);
      const { data: vs } = await sb.from("offres").select("user_id").in("product_slug", slugs).eq("status", "active").limit(500);
      for (const u of [...new Set([...(abos || []), ...(vs || [])].map((x: { user_id: string }) => x.user_id))]) if (!prevenus.has(u)) { prevenus.add(u); perso.push(u); }
      const cle = (u: string) => `besoin:${b.id}:${u}`;
      const personnels = await envoyerTous(perso, (u) => [charge, { cat: "pour_vendeur", cle: cle(u), type: "besoin", objet: b.id }]);
      // annonce du marché : les comptes à identité vérifiée, même région d'abord
      const tous = await diffuser("pour_vendeur", [...prevenus], b.region_slug || null, true, charge, cle);
      return json({ personnels, tous });
    }

    // 13. le conseil du jour : un seul par personne et par jour, seulement si elle n'a reçu aucun autre message commercial ;
    //     choisi selon son rôle, sa région et son activité ; chiffres réels du moment ; chaque message ouvre un écran précis.
    if (corps.marketing) {
      const k = Math.max(0, Number(corps.numero || 0)), jour = new Date(Date.now() - 24 * 3600e3).toISOString(), semaine = new Date(Date.now() - 7 * 24 * 3600e3).toISOString();
      const { data: cib, error } = await sb.rpc("notif_cible_conseils");
      if (error) return json({ erreur: error.message }, 500);
      type Cible = { user_id: string; role: string; region_slug: string | null; vend: boolean; achete: boolean; suit: string[] };
      const L = (cib || []) as Cible[];
      if (!L.length) return json({ comptes: 0, envoyees: 0 });
      const { count: of24 } = await sb.from("offres").select("id", { count: "exact", head: true }).eq("status", "active").gte("created_at", jour);
      const { data: de } = await sb.from("demandes").select("product_slug, product_label").eq("status", "active").gte("created_at", semaine).order("created_at", { ascending: false }).limit(200);
      const { count: grp } = await sb.from("groupes_achat").select("id", { count: "exact", head: true }).in("statut", ["ouvert", "seuil_atteint"]);
      const { count: bes } = await sb.from("besoins").select("id", { count: "exact", head: true }).eq("statut", "ouvert");
      const cherches: { slug: string; nom: string }[] = [];
      for (const d of de || []) if (!cherches.find((x) => x.slug === d.product_slug)) cherches.push({ slug: d.product_slug, nom: d.product_label || d.product_slug });
      type Fourchette = { slug: string; libelle: string; unite: string; nb: number; prix_min: number; prix_max: number; region: boolean };
      const fourchettes: Record<string, Fourchette[]> = {};
      const fourchetteDe = async (r: string | null) => {
        const cleR = r || "-";
        if (!fourchettes[cleR]) fourchettes[cleR] = ((await sb.rpc("notif_fourchette", { p_region: r })).data || []) as Fourchette[];
        return fourchettes[cleR];
      };
      type Msg = { title: string; body: string; url: string; slug?: string };
      const choisir = async (x: Cible, i: number): Promise<Msg> => {
        const vendeur = x.role === "vendeur" || x.role === "les_deux" || x.vend, acheteur = x.role !== "vendeur" || x.achete;
        const choix: Msg[] = [];
        if (vendeur && cherches.length) {
          const p = cherches[(k + i) % cherches.length];
          choix.push({ title: coupe(`Des acheteurs cherchent : ${p.nom}`, TITRE), body: "Touchez pour voir leurs demandes et faire une offre.", url: APP + "#/produits/" + p.slug, slug: p.slug });
        }
        if (vendeur && bes) choix.push({ title: `${nf(bes)} professionnel${bes > 1 ? "s cherchent" : " cherche"} un fournisseur`, body: "Restaurants, hôtels, cantines. Touchez pour voir leurs besoins.", url: APP + "#/appro" });
        if (acheteur) {
          const f = (await fourchetteDe(x.region_slug)).find((y) => y.nb >= 3 && (!x.suit?.length || x.suit.includes(y.slug))) || (await fourchetteDe(x.region_slug))[0];
          if (f && Number(f.prix_max) > 0) choix.push({ title: coupe(`${f.libelle} : ${nf(f.prix_min)} à ${nf(f.prix_max)} F / ${f.unite}`, TITRE),
            body: `Prix demandés dans ${f.nb} offres ${f.region ? "de votre région" : "du marché"}. Touchez pour comparer.`, url: APP + "#/produits/" + f.slug, slug: f.slug });
          if (of24) choix.push({ title: `${nf(of24)} nouvelle${of24 > 1 ? "s" : ""} offre${of24 > 1 ? "s" : ""} en 24 h`, body: "Touchez pour voir le catalogue du jour.", url: APP + "#/catalogue" });
          if (grp) choix.push({ title: `${nf(grp)} achat${grp > 1 ? "s" : ""} groupé${grp > 1 ? "s" : ""} ouvert${grp > 1 ? "s" : ""}`, body: "Achetez à plusieurs. Rien n'est commandé sans votre confirmation.", url: APP + "#/groupes" });
        }
        const CONSEILS: (Msg & { pour: "tous" | "vendeur" | "acheteur" })[] = [
          { pour: "acheteur", title: "Négociez le prix", body: "Proposez votre prix au vendeur, il vous répond dans l'application.", url: APP + "#/catalogue" },
          { pour: "vendeur", title: "Vendez en direct", body: "Publiez votre offre en une minute, dans Vendre.", url: APP + "#/vendre" },
          { pour: "acheteur", title: "Achetez à plusieurs", body: "Un achat groupé atteint le gros volume. Rien n'est commandé sans vous.", url: APP + "#/groupes" },
          { pour: "acheteur", title: "Suivez vos produits", body: "Activez une alerte produit : vous saurez quand une offre arrive.", url: APP + "#/catalogue" },
          { pour: "acheteur", title: "Approvisionnement pro", body: "Restaurant, hôtel, cantine : publiez votre liste une fois.", url: APP + "#/appro" },
          { pour: "tous", title: "Le calendrier des récoltes", body: "La saison de chaque produit, mois par mois.", url: APP + "#/annee" },
          { pour: "tous", title: "Qui a quoi, et où ?", body: "La carte montre les offres et les demandes près de chez vous.", url: APP + "#/carte" },
          { pour: "tous", title: "Les prix du marché", body: "Ce que demandent les vendeurs, partout en Côte d'Ivoire.", url: APP + "#/prix" },
        ];
        const cs = CONSEILS.filter((m) => m.pour === "tous" || (m.pour === "vendeur" ? vendeur : acheteur));
        // une fois sur deux un chiffre réel du moment s'il y en a, sinon un conseil (rotation d'un jour à l'autre)
        if (choix.length && (k + i) % 2 === 0) return choix[Math.floor((k + i) / 2) % choix.length];
        return cs[(k + i) % cs.length];
      };
      let envoyees = 0, comptes = 0;
      for (let i = 0; i < L.length; i += 40) {
        const r = await Promise.all(L.slice(i, i + 40).map(async (x, j) => {
          const m = await choisir(x, i + j);
          return envoyer(x.user_id, { title: m.title, body: m.body, url: m.url, tag: "marche-pub" }, { cat: "conseils", cle: `conseil:${jourUTC()}:${x.user_id}`, type: "conseil", slug: m.slug }).catch(() => ({ envoyees: 0 } as Res));
        }));
        for (const x of r) { envoyees += x.envoyees || 0; if (x.envoyees) comptes++; }
      }
      return json({ cibles: L.length, comptes, envoyees });
    }

    // 1. un nouveau message de négociation
    const id = String(corps.message_id || "");
    const { data: m } = await sb.from("messages").select("*").eq("id", id).maybeSingle();
    if (!m) return json({ erreur: "message introuvable" }, 404);
    const { data: n } = await sb.from("negociations").select("*").eq("id", m.negociation_id).maybeSingle();
    if (!n) return json({ erreur: "négociation introuvable" }, 404);
    const dest = m.auteur_id === n.auteur_id ? n.proprio_id : n.auteur_id;
    if (!dest || dest === m.auteur_id) return json({ rien: true });
    const qui = await nomDe(m.auteur_id), produit = coupe(n.produit || "votre annonce", 30), u = n.unite || "kg";
    let title = qui, body = produit;
    if (m.genre === "prix") { title = `${qui} propose ${F(m.prix)} / ${u}`; body = `${produit}${m.quantite ? ` · ${nf(m.quantite)} ${u}` : ""}. Touchez pour répondre.`; }
    else if (m.genre === "accord") { title = `Accord conclu avec ${qui}`; body = `${produit} à ${F(n.prix_final ?? m.prix)} / ${u}`; }
    else if (m.genre === "refus") { title = `${qui} refuse votre proposition`; body = `${produit}. Vous pouvez proposer un autre prix.`; }
    else if (m.genre === "retrait") { title = `${qui} a retiré sa proposition`; body = produit; }
    else if (m.genre === "fin") { title = "Négociation terminée"; body = `${produit} avec ${qui}`; }
    else if (m.genre === "texte") { title = `${qui} · ${produit}`; body = String(m.texte || ""); }
    const badge = (await sb.rpc("push_badge", { uid: dest })).data ?? 0;
    return json(await envoyer(dest, { title, body, tag: "nego-" + n.id, url: APP + "#/?nego=" + n.id, nego: n.id, badge },
      { cat: "negociation", cle: `msg:${m.id}:${dest}`, type: m.genre, objet: n.id }));
  } catch (e) {
    return json({ erreur: String((e as Error).message || e) }, 500);
  }
});
