// Généré par tools/extract-themes.mjs à partir des images de DG (v2/img/produit-*.webp) — ne pas modifier à la main.
// src = couleur du produit (OKLCH [L, C, h]) extraite du tiers supérieur opaque de l'image, toile de jute écartée.
// override = surcharge manuelle (themeOverride), prioritaire sur src. Les palettes sont dérivées au chargement par MDG.color.derive().
window.MDG = window.MDG || {};
MDG.themes = {
 "ail": {
  "src": [
   0.6608,
   0.0548,
   359.84
  ]
 },
 "ananas": {
  "src": [
   0.6418,
   0.1029,
   66.85
  ]
 },
 "aubergine": {
  "src": [
   0.4224,
   0.0857,
   347.61
  ],
  "override": [
   0.4224,
   0.12,
   318
  ],
  "note": "L'extraction donne un magenta (h 348, reflets) ; DG veut un violet."
 },
 "avocat": {
  "src": [
   0.4805,
   0.0765,
   112.48
  ]
 },
 "banane-douce": {
  "src": [
   0.7198,
   0.1119,
   77.71
  ]
 },
 "banane-plantain": {
  "src": [
   0.739,
   0.1047,
   90.7
  ]
 },
 "chou": {
  "src": [
   0.7096,
   0.0838,
   119.29
  ]
 },
 "citron": {
  "src": [
   0.7186,
   0.1371,
   109.39
  ]
 },
 "concombre": {
  "src": [
   0.6748,
   0.1174,
   114.69
  ]
 },
 "gombo": {
  "src": [
   0.6155,
   0.097,
   119.04
  ]
 },
 "oignon": {
  "src": [
   0.4833,
   0.0956,
   10.63
  ]
 },
 "orange": {
  "src": [
   0.7393,
   0.1361,
   88.17
  ]
 },
 "papaye": {
  "src": [
   0.7346,
   0.1345,
   79.44
  ]
 },
 "pasteque": {
  "src": [
   0.6746,
   0.0924,
   114.57
  ]
 },
 "patate-douce": {
  "src": [
   0.6577,
   0.0972,
   47.35
  ]
 },
 "piment-frais": {
  "src": [
   0.609,
   0.1188,
   121.64
  ]
 },
 "piment-garba": {
  "src": [
   0.6814,
   0.1374,
   115.58
  ]
 },
 "poivron": {
  "src": [
   0.5361,
   0.0954,
   123.2
  ]
 },
 "pomme-de-terre": {
  "src": [
   0.7489,
   0.0917,
   68.37
  ]
 },
 "tomate": {
  "src": [
   0.5511,
   0.163,
   34.99
  ]
 }
};
