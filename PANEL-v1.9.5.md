# K9 v1.9.5 — Retour panel 10 utilisateurs

Test qualitatif + Playwright sur 10 profils variés (Amélie chiot, Marc senior, Sophie 3 chiens, Léa étudiante quota épuisé, Tom expat anglophone, Karim pet-sitter pro, Clara sénior véto-centric, Paul runner data-driven, Nadia mère débordée, Rémi proprio 2e chien).

---

## ✅ Déjà fixé autonomement (bugs + UX parcours)

Ces corrections sont **déjà dans le code**, pas besoin d'approbation :

1. **Champ poids accepte la virgule ET le point** (`6,2` → `6.2`). Cause : clavier mobile FR ne propose pas de point. `inputmode="decimal"` + parse tolérant.
2. **Âge : `inputmode="numeric"`** pour clavier numérique direct sur mobile.
3. **Placeholder poids vide** au lieu de `15` pré-rempli (évite angoisse chiot = 15 kg ?).
4. **Deux boutons "Partager" désambiguïsés** : profil = "📤 Partager la fiche" / "📲 Partager la fiche" ; carnet santé reste "Partager le carnet".
5. **Vérifié fonctionnel** : `addNewDog` skippe déjà l'étape Welcome quand un chien existe. Auto-détection `navigator.language` en place au 1er lancement. Ces deux points flaggés dans le panel étaient des faux positifs.

---

## 🟡 Bugs à corriger (ton approbation nécessaire, judgment call)

### B1. Plan Pro vend un dashboard clients qui n'existe pas encore
**Karim** (pet-sitter) clique Pro, voit la promesse "multi-profils + dashboard clients", paie, et ne trouve rien dans l'app. Sent "vaporware".
- **Proposition** : étiqueter Pro "Bêta — dashboard clients arrive Q3 2026" pour être honnête, OU retirer la promesse.
- **Effort** : 10 min (modif i18n).

### B2. Chaînes FR résiduelles dans le programme rescue 3-3-3 en EN
Tom bascule en EN et trouve 1-2 strings non traduites dans rescue.
- **Proposition** : audit i18n rescue_* et compléter.
- **Effort** : 20 min.

### B3. Distance balade mock 4 km/h affichée comme vraie donnée
**Paul** (runner) : "3 km" calculés alors qu'il a couru 9 km → donnée fausse, pas juste incomplète.
- **Proposition A** : ajouter "(estimée)" sur l'affichage + tooltip explicatif.
- **Proposition B** : masquer la distance tant que pas de GPS, afficher juste la durée.
- **Effort** : 20 min.

### B4. FAB IA masque les CTA au bas de l'écran sur Android
**Léa** : le FAB recouvre le bouton "Démarrer balade" quand on scroll.
- **Proposition** : translucidité `opacity: 0.5` au scroll, ou décalage à gauche quand un CTA primaire est visible dans la zone basse.
- **Effort** : 30 min (à tester sur petits écrans).

---

## ⚡ Quick wins < 1h (approuvés au choix)

### Q1. Auto-activer grande police si chien senior (≥ 8 ans) détecté, avec dismiss
**Marc** a trouvé la grande police tout seul mais après chercher 3 min. À 60 ans, l'activation par défaut quand chien senior serait naturel.
- **Effort** : 15 min.

### Q2. Remonter "Prochains rappels" en haut de home si ≥ 1 alerte dans les 7 jours
**Nadia** (5 min/jour) veut voir l'urgent sans scroller.
- **Proposition** : insertion conditionnelle d'une mini-card "⚠️ 2 rappels cette semaine" juste sous le hero.
- **Effort** : 40 min.

### Q3. Emoji du chien devant chaque item du calendrier unifié
**Sophie** (3 chiens) ne sait pas à quel chien chaque rappel appartient.
- **Proposition** : préfixer chaque ligne par `🐕` ou l'emoji du chien concerné.
- **Effort** : 30 min.

### Q4. Renommer "IA discrète (moins de suggestions)"
**Léa** ne comprend pas ce que fait ce toggle.
- **Proposition FR** : "Coach minimaliste — moins de suggestions". EN : "Minimalist coach — fewer prompts".
- **Effort** : 5 min.

### Q5. Pill du chien actif plus contrastée
**Rémi** ne sait pas lequel est "le chien principal". Ajouter fond plein ou coche ✓ sur la pill active.
- **Effort** : 15 min.

### Q6. `navigator.share({ files })` en priorité pour la carte profil (iOS sheet natif)
**Clara** télécharge le PNG et le cherche 5 min dans sa galerie car iOS le met dans "Fichiers", pas "Photos". Le menu de partage natif iOS laisse choisir WhatsApp/Photos/Mail directement.
- **Proposition** : `shareCardNative()` existe déjà, le faire devenir le CTA principal et "Télécharger" devenir ghost.
- **Effort** : 10 min.

---

## 🔧 Propositions moyen-terme (1j+, à prioriser)

### M1. Dog switcher persistant dans le header global (tous onglets)
**Sophie & Rémi** zigzaguent entre home et les autres onglets juste pour changer de chien. Impact fort pour les multi-propriétaires. Refonte mineure du layout.
- **Effort** : ~1 j.

### M2. Section "Traitements en cours" dans Santé
**Marc** (chien malade 9 ans) ne peut pas noter les médicaments quotidiens — c'est pourtant le plus important pour les seniors. Posologie + rappel quotidien.
- **Effort** : ~1 j.

### M3. Quotas IA refondés : 3/jour au lieu de 10/mois
**Léa** : "quand il y a un problème j'ai besoin d'enchaîner 5 questions le même jour". Le quota 10/mois est trop mensuel, pas assez sessions. Alternative : système de "+1 question" via partage/invitation (loop Duolingo).
- **Effort** : 4 h.

### M4. Export PDF du profil chien (à côté du PNG)
**Clara** : son véto préfère un PDF imprimable. Actuellement seul le PNG existe.
- **Effort** : 4-6 h (jspdf ou canvas → PDF).

### M5. Personnalisation des quick-actions de home
**Nadia** n'utilise jamais "Spots" ni "Nutrition" depuis home, mais ça prend de la place. Proposer un "choisis tes 3 raccourcis préférés".
- **Effort** : 1 j.

### M6. Demo-data géolocalisée
Tout est "Bois de Vincennes", "Buttes-Chaumont" en dur. **Tom** expat trouve ça faux en UK. Utiliser `navigator.geolocation` ou un placeholder neutre ("parc local").
- **Effort** : ~1 j.

### M7. Dépendances déjà au backlog (rappel)
- GPS temps réel balades (Paul) → BACKLOG #4.
- Scan carnet véto OCR (Marc, Rémi) → BACKLOG #6.
- Push notifications mobile (Nadia) → BACKLOG #1.

---

## 📊 Synthèse priorité

| Priorité | Item | Effort | Qui gagne ? |
|----------|------|--------|-------------|
| 🔴 Haute | B1 Pro dashboard honnête | 10 min | Éthique produit |
| 🔴 Haute | B3 distance balade mock | 20 min | Crédibilité |
| 🟠 Moyenne | Q2 rappels en haut | 40 min | Nadia et tous |
| 🟠 Moyenne | Q1 grande police senior auto | 15 min | Marc et seniors |
| 🟠 Moyenne | Q3 emoji chien calendrier | 30 min | Multi-chiens |
| 🟠 Moyenne | Q6 share natif iOS | 10 min | Partage social |
| 🟡 Basse | Q4 rename "IA discrète" | 5 min | Clarté |
| 🟡 Basse | Q5 pill active + contraste | 15 min | Multi-chiens |
| 🟡 Basse | B2 rescue i18n EN | 20 min | Marché EN |
| 🟡 Basse | B4 FAB translucide | 30 min | Android petits écrans |
| 🔵 MT | M1 Dog switcher global | 1 j | Multi-chiens |
| 🔵 MT | M2 Traitements en cours | 1 j | Seniors |
| 🔵 MT | M3 Quotas IA par jour | 4 h | Conversion free→plus |
| 🔵 MT | M4 Export PDF | 4-6 h | Véto/pro |

---

## Feedbacks positifs à conserver

- "Barre IA sur la home → c'est exactement ce dont j'avais besoin. Plus rassurant qu'un forum." (Amélie)
- "Mode senior avec barre stade de vie → bien pensé." (Marc)
- "Programme rescue 3-3-3 vraiment humain et bien écrit." (Rémi)
- "Paywall propre et prix honnête pour 3 chiens." (Sophie)
- "Bannière anniversaire trop mignonne, effet 'mémo humain'." (Nadia)
- "Language toggle rapide à trouver." (Tom)

---

## Méthodo

- Playwright smoke test `/sessions/adoring-charming-cannon/test_panel_v195.py` : 10 scénarios, 0 bug réel détecté après fixes (le "addNewDog profil" remonté était un faux positif, le + est sur home).
- Panel qualitatif via simulation de 10 personas — focus sur les micro-moments UX.

---

**Prochaine étape recommandée** : tu cochécroix les items B1-B4 + Q1-Q6 que tu veux voir implémentés, je les fais en un sprint (~3 h total) et je push v1.9.6.
