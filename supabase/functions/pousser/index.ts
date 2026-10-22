// ═════════ Marché de Gros CI — fonction Edge « pousser » : envoie les notifications sur les téléphones (Web Push) ═════════
// Trois façons de l'appeler :
//  1. par la base (déclencheur public.push_message, via pg_net) à chaque nouveau message de négociation,
//     avec l'en-tête x-mdg-cle (clé partagée rangée dans le coffre) et { message_id } ;
//  2. par l'application, connectée, pour vérifier que les notifications marchent : { test: true } + le jeton de la session.
//  3. par la base (déclencheur public.push_dm) à chaque message direct, avec { dm_id } (schema-8) ;
//     un message d'un administrateur s'affiche au nom du « Marché de Gros » (schema-10) ;
//  4. par la base (déclencheur public.push_alerte) quand quelqu'un essaie de sortir de l'application, avec { alerte_id } :
//     tous les administrateurs sont prévenus (schema-10) ;
//  5. par la base (déclencheur public.push_annonce) à chaque nouvelle annonce, avec { annonce: 'offres' | 'demandes', id } :
//     ceux qui suivent ce produit (table alertes_produits) sont prévenus (schema-12) ;
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
//     ceux qui suivent ses produits, les vendeurs de ces produits, puis les comptes à identité vérifiée (annonce du marché).
// 13. par la base (pg_cron « mdg-marketing », public.marketing_tick, schema-45) avec { marketing: true, numero } :
//     une notification régulière à tous (30 par jour au plus, réglable), tirée des VRAIES données du moment ou présentant
//     une vraie fonction de l'application. Jamais de message faux. Étiquette « marche-pub » : elle remplace la précédente.
// Annonces du marché (schema-43) : achat groupé ouvert, besoin pro, nouvelle offre ou demande → tous les comptes qui ont activé
// les notifications, sauf ceux qui les ont coupées ; au plus 10 par personne et par jour (push_diffusion_cible).
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

// annonce du marché : les destinataires sont choisis et comptés par la base (plafond du jour, réglage, bannis exclus) ;
// envoi par paquets de 40 en parallèle, pour tenir même avec des milliers de comptes
const PLAFOND_JOUR = 10;
async function diffuser(type: string, exclure: string[], charge: Record<string, unknown>) {
  const { data, error } = await sb.rpc("push_diffusion_cible", { p_type: type, p_exclure: exclure, p_max_jour: PLAFOND_JOUR });
  if (error) return { erreur: error.message };
  const ids = ((data || []) as unknown[]).map((x) => typeof x === "string" ? x : String((x as Record<string, unknown>).push_diffusion_cible ?? ""));
  let envoyees = 0;
  for (let i = 0; i < ids.length; i += 40) {
    const r = await Promise.all(ids.slice(i, i + 40).filter(Boolean).map((u) => envoyer(u, charge).catch(() => ({ envoyees: 0 }))));
    envoyees += r.reduce((n, x) => n + ((x as { envoyees?: number }).envoyees || 0), 0);
  }
  return { comptes: ids.length, envoyees };
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

    // 6. un dossier d'identité vient d'être envoyé ({ identite_id }, déclencheur public.push_identite), ou le résumé du matin
    //    ({ resume_identites: true }, tâche pg_cron « mdg-identites-matin ») : tous les administrateurs, sans aucune donnée personnelle.
    //    Même étiquette « identite » : une nouvelle notification remplace la précédente (regroupement quand beaucoup arrivent d'un coup).
    if (corps.identite_id || corps.resume_identites) {
      const { count } = await sb.from("verifications").select("id", { count: "exact", head: true }).eq("statut", "en_attente");
      const n = count || 0;
      if (!n) return json({ rien: true });
      const { data: ads } = await sb.from("admins").select("user_id");
      const res = [];
      for (const ad of ads || []) res.push(await envoyer(ad.user_id, {
        title: corps.resume_identites ? "Dossiers d'identité en attente" : "Nouveau dossier d'identité",
        body: n + (n > 1 ? " dossiers" : " dossier") + " à examiner" + (corps.resume_identites ? " ce matin" : ""),
        tag: "identite", url: "admin.html#identites" }));
      return json({ admins: res.length, dossiers: n, res });
    }

    // 7. une étape de commande ({ commande_etape_id }, déclencheur public.push_commande, schema-26) : l'autre partie est prévenue
    if (corps.commande_etape_id) {
      const { data: e } = await sb.from("commande_etapes").select("id, commande_id, evenement, par, lieu").eq("id", String(corps.commande_etape_id)).maybeSingle();
      if (!e) return json({ erreur: "étape introuvable" }, 404);
      const { data: k } = await sb.from("commandes").select("id, numero, vendeur_id, acheteur_id, produit, validation").eq("id", e.commande_id).maybeSingle();
      if (!k) return json({ erreur: "commande introuvable" }, 404);
      const dests = [k.vendeur_id, k.acheteur_id].filter((u: string) => u && u !== e.par);
      const qui = e.par ? await nomDe(e.par) : "Marché de Gros", produit = k.produit || "votre commande";
      const T: Record<string, [string, string]> = {
        creee: [`${qui} vous propose une commande`, `${produit} — touchez pour confirmer`],
        confirmee: ["Commande confirmée", `${produit} · ${qui} a confirmé`],
        refusee: ["Commande refusée", `${produit} · ${qui} a refusé`],
        preparation: ["Marchandise en préparation", produit],
        chargement: ["Chargement confirmé, transport en cours", produit],
        transbordement: ["Transbordement", `${produit}${e.lieu ? " · " + e.lieu : ""}`],
        arrivee: ["Le chauffeur est arrivé", produit],
        reception: ["Réception confirmée, commande terminée", produit],
        annulation_demandee: [`${qui} demande l'annulation`, `${produit} — touchez pour répondre`],
        annulation_refusee: ["Annulation refusée", produit],
        annulee: ["Commande annulée", produit],
        litige: [`${qui} a ouvert un litige`, `${produit} — l'équipe va examiner`],
      };
      const [title, body] = T[e.evenement] || ["Votre commande avance", produit];
      const res = [];
      // commande « avec codes » (schéma 28) : on rappelle à celui qui détient le code de le garder et de le présenter au bon moment
      const rappel = (d: string): [string, string] | null => {
        if (k.validation !== "code") return null;
        if (d === k.acheteur_id && ["chargement", "transbordement"].includes(e.evenement)) return [title, `${produit} · 🔐 Gardez bien votre code de réception : vous aurez à le présenter au chauffeur, après avoir vérifié la marchandise.`];
        if (d === k.acheteur_id && e.evenement === "arrivee") return ["🔐 Le chauffeur est arrivé : préparez votre code", `${produit} · Vérifiez la marchandise, puis donnez votre code de réception au chauffeur. Il est dans Accueil → Alertes.`];
        if (d === k.vendeur_id && e.evenement === "confirmee") return [title, `${produit} · 🔐 Gardez bien votre code de prise en charge : vous le donnerez au chauffeur au chargement.`];
        return null;
      };
      for (const d of dests) { const [t2, b2] = rappel(d) || [title, body]; res.push(await envoyer(d, { title: t2, body: b2, tag: "cmd-" + k.id, url: "application.dc.html#/?commande=" + k.id })); }
      return json({ res });
    }

    // 8. une mission de transport ({ mission_id }, déclencheur public.push_mission, schema-27) :
    //    proposée → le chauffeur est prévenu ; acceptée ou refusée → l'acheteur et le vendeur sont prévenus
    if (corps.mission_id) {
      const { data: m } = await sb.from("transport_missions").select("id, commande_id, transporteur_id, statut").eq("id", String(corps.mission_id)).maybeSingle();
      if (!m) return json({ erreur: "mission introuvable" }, 404);
      const { data: t } = await sb.from("transporteurs").select("user_id, nom").eq("id", m.transporteur_id).maybeSingle();
      const { data: k } = await sb.from("commandes").select("id, vendeur_id, acheteur_id, produit, ville_depart, lieu_livraison").eq("id", m.commande_id).maybeSingle();
      if (!t || !k) return json({ rien: true });
      const produit = k.produit || "une commande";
      if (m.statut === "proposee") {
        if (!t.user_id) return json({ rien: true });
        return json(await envoyer(t.user_id, { title: "Nouvelle mission de transport", body: `${produit} · ${k.ville_depart || "départ à préciser"} → ${k.lieu_livraison || "livraison à préciser"}`, tag: "mission-" + m.id, url: "application.dc.html#/?chauffeur=1" }));
      }
      if (m.statut !== "acceptee" && m.statut !== "refusee") return json({ rien: true });
      const res = [];
      for (const d of [k.vendeur_id, k.acheteur_id]) res.push(await envoyer(d, {
        title: m.statut === "acceptee" ? `${t.nom} transportera votre commande` : `${t.nom} a refusé la mission`,
        body: m.statut === "acceptee" ? produit : `${produit} — choisissez un autre transporteur`, tag: "cmd-" + k.id, url: "application.dc.html#/?commande=" + k.id }));
      return json({ res });
    }

    // 9. décision de l'équipe sur un profil de transporteur ({ transporteur_id }, déclencheur public.push_transporteur, schema-27)
    if (corps.transporteur_id) {
      const { data: t } = await sb.from("transporteurs").select("user_id, statut").eq("id", String(corps.transporteur_id)).maybeSingle();
      if (!t || !t.user_id) return json({ rien: true });
      const T: Record<string, [string, string]> = {
        verifie: ["Votre profil de transporteur est vérifié", "Vous pouvez vous dire disponible et recevoir des missions."],
        refuse: ["Profil de transporteur refusé", "Touchez pour voir le motif."],
        suspendu: ["Profil de transporteur suspendu", "Touchez pour voir le motif."],
      };
      const [title, body] = T[t.statut] || ["Votre profil de transporteur a changé", "Touchez pour voir."];
      return json(await envoyer(t.user_id, { title, body, tag: "transporteur", url: "application.dc.html#/?chauffeur=1" }));
    }

    // 10. un rappel d'achat ({ rappel_id }, pg_cron public.rappels_envoyer, schema-33) : il ouvre l'écran « Racheter », rien n'est envoyé au vendeur
    if (corps.rappel_id) {
      const { data: r } = await sb.from("rappels_achat").select("id, user_id, commande_id, produit, actif").eq("id", String(corps.rappel_id)).maybeSingle();
      if (!r || !r.actif) return json({ rien: true });
      return json(await envoyer(r.user_id, { title: `Racheter ${coupe(r.produit || "votre produit", 40)} ?`,
        body: "Touchez pour voir le prix et le stock du jour. Rien n'est commandé sans votre accord.", tag: "rappel-" + r.id,
        url: "application.dc.html#/?racheter=" + r.commande_id }));
    }

    // 11. un achat groupé change de statut, ou un participant doit reconfirmer (le prix a changé)
    if (corps.groupe_id) {
      const { data: g } = await sb.from("groupes_achat").select("id, vendeur_id, createur_id, produit, statut, prix_final, confirmer_avant").eq("id", String(corps.groupe_id)).maybeSingle();
      if (!g) return json({ rien: true });
      const url = "application.dc.html#/?groupe=" + g.id, tag = "groupe-" + g.id, produit = coupe(g.produit || "Achat groupé", 40);
      if (corps.reconfirmer) return json(await envoyer(String(corps.reconfirmer), { title: `${produit} : le prix a changé`, body: `Nouveau prix ${F(g.prix_final)} — reconfirmez ou retirez-vous.`, tag, url }));
      const { data: ps } = await sb.from("groupe_participants").select("user_id").eq("groupe_id", g.id).neq("statut", "retire");
      const parts = (ps || []).map((p: { user_id: string }) => p.user_id);
      // un acheteur rejoint : le créateur et le vendeur (la notification remplace la précédente, même étiquette)
      if (corps.rejoint) {
        if (g.statut === "propose") return json({ rien: true });   // le créateur s'inscrit en proposant : le vendeur reçoit déjà « proposé »
        const qui = String(corps.rejoint), res = [];
        for (const d of [...new Set([g.createur_id, g.vendeur_id])].filter((u) => u && u !== qui))
          res.push(await envoyer(d, { title: `${produit} : un acheteur a rejoint le groupe`, body: `${parts.length} participant${parts.length > 1 ? "s" : ""} pour l'instant. Touchez pour suivre le groupe.`, tag, url }));
        return json({ res });
      }
      // le groupe s'ouvre : le créateur, et ceux qui suivent ce produit (alertes produit sur les offres) peuvent le rejoindre
      if (corps.statut === "ouvert") {
        const res = [];
        if (g.createur_id && g.createur_id !== g.vendeur_id) res.push(await envoyer(g.createur_id, { title: `${produit} : le groupe est ouvert`, body: "Le vendeur a fixé ses conditions. Partagez le groupe pour atteindre le seuil.", tag, url }));
        const { data: g2 } = await sb.from("groupes_achat").select("offre_id").eq("id", g.id).maybeSingle();
        const { data: o } = g2 ? await sb.from("offres").select("product_slug").eq("id", g2.offre_id).maybeSingle() : { data: null };
        if (o?.product_slug) {
          const { data: abos } = await sb.from("alertes_produits").select("user_id").eq("product_slug", o.product_slug).eq("offres", true);
          const deja = new Set([g.vendeur_id, g.createur_id, ...parts]);
          for (const ab of abos || []) if (!deja.has(ab.user_id)) { deja.add(ab.user_id); res.push(await envoyer(ab.user_id, { title: `Achat groupé ouvert : ${produit}`, body: "Rejoignez d'autres acheteurs pour payer moins cher. Rien n'est commandé sans votre confirmation.", tag, url })); }
          // annonce du marché : tous les comptes
          const tous = await diffuser("groupe", [...deja].filter(Boolean) as string[], { title: `Achat groupé : ${produit}`, body: "Des acheteurs se regroupent pour payer moins cher. Rejoignez-les : rien n'est commandé sans votre confirmation.", tag, url });
          return json({ res, tous });
        }
        return json({ res });
      }
      const T: Record<string, [string[], string, string]> = {
        propose: [[g.vendeur_id], `Achat groupé proposé : ${produit}`, "Un acheteur propose un groupe sur votre offre. Fixez vos conditions ou refusez."],
        seuil_atteint: [[g.vendeur_id], `${produit} : seuil atteint`, "Lancez la confirmation : chaque participant confirmera sa quantité."],
        en_attente_confirmation: [parts, `${produit} : confirmez votre participation`, `Prix final ${F(g.prix_final)}. Rien n'est commandé sans votre confirmation.`],
        confirme: [[g.vendeur_id, ...parts], `${produit} : achat groupé confirmé`, "Les commandes sont créées. Suivez-les dans Mes commandes."],
        expire: [[g.vendeur_id, ...parts], `${produit} : achat groupé expiré`, "Le seuil n'a pas été atteint. Vous pouvez acheter seul si vous le souhaitez."],
        annule: [[g.vendeur_id, ...parts].filter((u) => u !== g.createur_id), `${produit} : achat groupé annulé`, "Aucune commande n'a été créée."],
      };
      const t = T[String(corps.statut)]; if (!t) return json({ rien: true });
      const res = [];
      for (const d of [...new Set(t[0])]) res.push(await envoyer(d, { title: t[1], body: t[2], tag, url }));
      return json({ res });
    }

    // 5. une nouvelle annonce : ceux qui suivent ce produit sont prévenus
    if (corps.annonce && corps.id) {
      const t = corps.annonce === "demandes" ? "demandes" : "offres";
      const { data: a } = await sb.from(t).select("*").eq("id", String(corps.id)).maybeSingle();
      if (!a || a.status !== "active") return json({ rien: true });
      if (t === "demandes" && a.besoin_id) return json({ rien: true, besoin: true });   // le besoin entier est annoncé une fois (cas 12)
      const { data: abos } = await sb.from("alertes_produits").select("user_id").eq("product_slug", a.product_slug).eq(t, true).neq("user_id", a.user_id);
      const nom = a.product_label || a.product_slug, u = a.unit || "kg", px = t === "offres" ? a.price : a.budget;
      const corpsTxt = [a.quantity ? new Intl.NumberFormat("fr-FR").format(a.quantity) + " " + u : "", a.city || "", px ? (t === "offres" ? "" : "budget ") + F(px) + " / " + u : ""].filter(Boolean).join(" · ");
      const res = [];
      const prevenus = new Set<string>();
      for (const ab of abos || []) { prevenus.add(ab.user_id); res.push(await envoyer(ab.user_id, { title: (t === "offres" ? "Nouvelle offre : " : "Nouvelle demande : ") + nom, body: corpsTxt || "Touchez pour voir", tag: "annonce-" + a.id, url: "application.dc.html#/produits/" + a.product_slug })); }
      // annonce du marché : tous les autres comptes ; une seule notification d'annonce à la fois sur le téléphone (même étiquette)
      const tous = await diffuser("annonce", [a.user_id, ...prevenus], { title: (t === "offres" ? "Nouvelle offre : " : "Nouvelle demande : ") + nom, body: corpsTxt || "Touchez pour voir", tag: "marche-annonce", url: "application.dc.html#/produits/" + a.product_slug });
      return json({ abonnes: res.length, res, tous });
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
      const charge = { title: `${qui} s'approvisionne${quand}`, body: `${noms.slice(0, 3).join(", ")}${noms.length > 3 ? "…" : ""}${lieu ? " · " + lieu : ""} — proposez vos prix.`, tag: "besoin-" + b.id, url: "application.dc.html#/?besoin=" + b.id };
      const prevenus = new Set<string>([b.user_id]), res = [];
      // personnel : ceux qui suivent ces produits, et les vendeurs qui en ont en stock
      const { data: abos } = await sb.from("alertes_produits").select("user_id").in("product_slug", slugs).eq("demandes", true);
      const { data: vs } = await sb.from("offres").select("user_id").in("product_slug", slugs).eq("status", "active").limit(500);
      for (const u of [...new Set([...(abos || []), ...(vs || [])].map((x: { user_id: string }) => x.user_id))]) if (!prevenus.has(u)) { prevenus.add(u); res.push(await envoyer(u, charge)); }
      // annonce du marché : les comptes à identité vérifiée
      const tous = await diffuser("besoin", [...prevenus], charge);
      return json({ personnels: res.length, tous });
    }

    // 13. notification marketing régulière : vraies données ou vraie fonction, à tour de rôle
    if (corps.marketing) {
      const k = Math.max(0, Number(corps.numero || 0)), jour = new Date(Date.now() - 24 * 3600e3).toISOString(), semaine = new Date(Date.now() - 7 * 24 * 3600e3).toISOString();
      const nf = (n: number) => new Intl.NumberFormat("fr-FR").format(n).replace(/ | /g, " ");
      const { data: of } = await sb.from("offres").select("product_slug, product_label, city, price, unit, created_at").eq("status", "active").order("created_at", { ascending: false }).limit(300);
      const { data: de } = await sb.from("demandes").select("product_slug, product_label, city, created_at").eq("status", "active").gte("created_at", semaine).order("created_at", { ascending: false }).limit(300);
      const { count: grp } = await sb.from("groupes_achat").select("id", { count: "exact", head: true }).in("statut", ["ouvert", "seuil_atteint"]);
      const { count: bes } = await sb.from("besoins").select("id", { count: "exact", head: true }).eq("statut", "ouvert");
      const nom = (x: { product_label?: string; product_slug: string }) => x.product_label || x.product_slug;
      const of24 = (of || []).filter((x: { created_at: string }) => x.created_at >= jour);
      const donnees: { title: string; body: string; url: string }[] = [];
      if (of24.length) donnees.push({ title: `🧺 ${nf(of24.length)} nouvelle${of24.length > 1 ? "s" : ""} offre${of24.length > 1 ? "s" : ""} aujourd'hui`, body: `Dont ${nom(of24[0])}${of24[0].city ? " à " + of24[0].city : ""}. Négociez le prix directement avec le vendeur.`, url: "application.dc.html#/catalogue" });
      if ((de || []).length) { const ps = [...new Set((de || []).map(nom))]; donnees.push({ title: `🛒 Des acheteurs cherchent : ${ps.slice(0, 3).join(", ")}${ps.length > 3 ? "…" : ""}`, body: "Vous en avez ? Publiez votre offre : ils sont prévenus tout de suite.", url: "application.dc.html#/vendre" }); }
      if (grp) donnees.push({ title: `👥 ${nf(grp)} achat${grp > 1 ? "s" : ""} groupé${grp > 1 ? "s" : ""} ouvert${grp > 1 ? "s" : ""}`, body: "Achetez à plusieurs, payez moins cher. Rien n'est commandé sans votre confirmation.", url: "application.dc.html#/catalogue" });
      if (bes) donnees.push({ title: `🏪 ${nf(bes)} professionnel${bes > 1 ? "s" : ""} s'approvisionne${bes > 1 ? "nt" : ""}`, body: "Restaurants, hôtels, cantines cherchent des fournisseurs. Proposez vos prix.", url: "application.dc.html#/catalogue" });
      { const par: Record<string, number[]> = {}, lab: Record<string, string> = {}, un: Record<string, string> = {};
        for (const o of of || []) if (o.price) { (par[o.product_slug] = par[o.product_slug] || []).push(Number(o.price)); lab[o.product_slug] = nom(o); un[o.product_slug] = o.unit || "kg"; }
        const top = Object.keys(par).filter((p) => par[p].length >= 2).sort((a, b) => par[b].length - par[a].length)[0];
        if (top) { const v = par[top]; donnees.push({ title: `📊 ${lab[top]} : de ${nf(Math.min(...v))} à ${nf(Math.max(...v))} F / ${un[top]}`, body: "Comparez les prix des vendeurs avant d'acheter, dans Prix du marché.", url: "application.dc.html#/prix" }); } }
      const CONSEILS = [
        { title: "🤝 Négociez le prix", body: "Proposez votre prix au vendeur, il vous répond dans l'application. C'est gratuit.", url: "application.dc.html#/catalogue" },
        { title: "🧺 Vendez en direct", body: "Publiez votre récolte en une minute : les acheteurs sont prévenus tout de suite.", url: "application.dc.html#/vendre" },
        { title: "🔒 Votre numéro reste caché", body: "On vous écrit dans l'application : pas d'appels de gens inconnus.", url: "application.dc.html#/" },
        { title: "👥 Achetez à plusieurs", body: "Regroupez-vous avec d'autres acheteurs pour atteindre le gros volume et payer moins cher.", url: "application.dc.html#/catalogue" },
        { title: "💵 Payez à la livraison", body: "Voyez la marchandise d'abord : rien n'est payé dans l'application.", url: "application.dc.html#/" },
        { title: "🔔 Suivez vos produits", body: "Activez une alerte produit : on vous prévient dès qu'une offre arrive.", url: "application.dc.html#/catalogue" },
        { title: "🏪 Approvisionnement pro", body: "Restaurant, hôtel, cantine : publiez votre liste une fois, les vendeurs vous répondent.", url: "application.dc.html#/demande" },
        { title: "🚚 Transporteurs vérifiés", body: "Faites livrer par un chauffeur vérifié par l'équipe, et suivez la livraison en direct.", url: "application.dc.html#/" },
        { title: "📅 Le calendrier des récoltes", body: "Achetez au bon moment : la saison de chaque produit, mois par mois.", url: "application.dc.html#/annee" },
        { title: "✅ Faites vérifier votre identité", body: "Un profil vérifié inspire confiance : vous vendez et achetez plus facilement.", url: "application.dc.html#/" },
        { title: "🗺️ Qui a quoi, et où ?", body: "La carte montre les offres et les demandes près de chez vous.", url: "application.dc.html#/carte" },
        { title: "📈 Le juste prix", body: "Ce que demandent les vendeurs, partout en Côte d'Ivoire : consultez Prix du marché.", url: "application.dc.html#/prix" },
      ];
      // une notification sur quatre donne une donnée du moment (sans répéter la même trop souvent), les autres un conseil
      const m = donnees.length && k % 4 === 0 ? donnees[(k / 4) % donnees.length] : CONSEILS[(k - Math.floor(k / 4) - 1 + CONSEILS.length * 9) % CONSEILS.length];
      const { data: ids, error } = await sb.rpc("push_marketing_cible");
      if (error) return json({ erreur: error.message }, 500);
      const L = ((ids || []) as unknown[]).map((x) => typeof x === "string" ? x : String((x as Record<string, unknown>).push_marketing_cible ?? "")).filter(Boolean);
      let envoyees = 0;
      for (let i = 0; i < L.length; i += 40) {
        const r = await Promise.all(L.slice(i, i + 40).map((u) => envoyer(u, { ...m, tag: "marche-pub" }).catch(() => ({ envoyees: 0 }))));
        envoyees += r.reduce((n, x) => n + ((x as { envoyees?: number }).envoyees || 0), 0);
      }
      return json({ message: m.title, comptes: L.length, envoyees });
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
