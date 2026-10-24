# À faire par le propriétaire

Les petites choses que seul le propriétaire peut faire (réglages de comptes, décisions). Claude les rappelle au début d'une discussion ; une ligne faite est cochée puis retirée.

## 1. Autoriser le serveur de l'application dans l'environnement Claude (2 minutes, gratuit)

**Pourquoi** : aujourd'hui, l'ordinateur de travail de Claude ne peut pas joindre le serveur de l'application (Supabase). Il voit donc l'application sans données et sans compte, et ne peut vérifier à l'écran ni les commandes, ni les négociations, ni les messages : seulement dans le code.

**Comment** :
1. Dans une discussion Claude Code, en haut de l'écran, touchez le **nom de l'environnement**, puis **Modifier**.
2. Dans **Accès réseau**, choisissez **Limité** (ou **Personnalisé** si c'est ce qui est proposé).
3. Dans **Domaines autorisés**, ajoutez exactement : `catmsypctymgkjkfzdkt.supabase.co`
4. Laissez cochée la case « Autoriser les gestionnaires de paquets ». Enregistrez.
5. Ouvrez une **nouvelle** discussion et écrivez « serveur autorisé » : Claude vérifiera que ça répond.

Guide officiel (en anglais) : https://code.claude.com/docs/en/cloud-environments#network-access

- [ ] Fait

## 2. Un compte de test pour que Claude se connecte (après l'étape 1)

**Pourquoi** : pour ouvrir les écrans avec compte et finir l'audit à l'écran (point n° 59 et les fenêtres vérifiées seulement dans le code : `docs/anti-slop/audit-001-2026-10-24.md`).

**Comment** : on le décide ensemble le jour venu, de la façon la plus sûre (un compte créé exprès, jamais votre compte à vous). **Ne jamais écrire un code secret dans la discussion.**

- [ ] Fait

## 3. Coller une ligne dans Supabase (notifications, 1 minute)

**Pourquoi** : retirer un droit inutile sur trois tables (alertes, alertes_produits, zones). L'outil de Claude refuse ce mot (« truncate »), il faut le coller à la main. Rien n'est effacé.

**Comment** : Supabase → projet de production `catmsypctymgkjkfzdkt` → **SQL Editor** → coller la ligne ci-dessous → **Run**. Puis dire « 88c collé » : Claude vérifiera.

```
revoke truncate on public.alertes, public.alertes_produits, public.zones from authenticated;
```

- [x] Fait (24/10/2026, vérifié par Claude : la permission est retirée sur les trois tables)

