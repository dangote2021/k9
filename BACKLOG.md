# K9 — Backlog produit

_Dernière mise à jour : 22 avril 2026_

État actuel : **v1.9 déployée** (prototype fonctionnel sur Vercel — `https://k9-one.vercel.app`).

---

## ✅ Livré

- **v1.0–v1.4** : prototype mobile-first, 4 onglets, 12 sous-écrans, bilingue FR+EN, multi-chiens
- **v1.5** : Claude API brancher (K9 Coach FAB + CTA contextuels, mode chat + mode plan)
- **v1.6** : 11 quick-wins (nom propriétaire, stats à 0, auto-lang nav, mini-tags exemple, journal rescue, etc.)
- **v1.7** : écran Paramètres centralisé, accessibilité (grande police/contraste), unités km/mi, upload photo réelle, mode "IA discrète"
- **v1.8** : calendrier unifié véto/vermifuge/anniversaire + Web Notifications, plans IA personnalisés (12 plans structurés 3 phases)
- **v1.9** : **persistance localStorage complète** (profil, chiens, calendrier, balades, rescue, paramètres), export/import/reset JSON, enregistrement balade chrono, squelette backend Supabase + cron rappels

---

## 🔜 Prochaines priorités (v2.0)

### 1. Comptes utilisateurs + sync multi-device

**Pourquoi** : aujourd'hui tout est en localStorage. Si l'utilisateur change de téléphone, perd son cache, ou veut partager le carnet avec son·sa conjoint·e → perte de données.

**Ce qui est prêt** :
- `db/schema.sql` — schéma Supabase complet avec RLS
- `api/sync.js` — endpoint stub (répond mock:true tant que les env vars ne sont pas là)

**Reste à faire** :
1. Créer un projet Supabase (gratuit, < 5 min)
2. Exécuter `db/schema.sql` dans le SQL editor
3. Ajouter env vars Vercel : `SUPABASE_URL`, `SUPABASE_SERVICE_KEY`, `SUPABASE_ANON_KEY`
4. Décommenter la section `// --- Supabase mode ---` dans `api/sync.js`
5. Côté front : ajouter un flow "Se connecter" qui appelle Supabase Auth (magic link email)
6. Brancher `K9Store.sync()` pour POST localStorage → /api/sync après login

**Estimation** : 1 jour dev.

### 2. Rappels email (pas juste navigateur)

**Pourquoi** : les Web Notifications ne marchent que si l'utilisateur a l'app ouverte ou installée en PWA. Un email est plus fiable (et dispo sur smartwatch, tablette, PC).

**Ce qui est prêt** :
- `api/cron-reminders.js` — scan quotidien + envoi Resend (stub)
- Colonne `reminded_at` dans la DB pour éviter les doublons

**Reste à faire** :
1. Créer compte Resend (3000 emails gratuits/mois)
2. Configurer domaine `k9.app` (ou `send.k9.app`) pour éviter spam
3. Ajouter env vars Vercel : `RESEND_API_KEY`, `RESEND_FROM_EMAIL`
4. Ajouter dans `vercel.json` :
   ```json
   "crons": [{ "path": "/api/cron-reminders", "schedule": "0 7 * * *" }]
   ```
5. Décommenter la section production dans `api/cron-reminders.js`

**Estimation** : 0.5 jour dev + 1 jour vérif délivrabilité (SPF, DKIM, DMARC).

### 3. PWA + installation écran d'accueil

**Pourquoi** : les Notifications navigateur sont bien plus fiables si l'app est "installée" (PWA). Aussi donne l'impression d'une vraie app, avec icône sur l'écran d'accueil.

**Reste à faire** :
1. Créer `manifest.json` avec nom, icônes (192px, 512px), couleurs, `display: standalone`
2. Créer `service-worker.js` (cache basique + background notifications)
3. Ajouter `<link rel="manifest">` et `navigator.serviceWorker.register()` dans index.html
4. Générer les icônes (logo K9 sur fond orange)

**Estimation** : 0.5 jour.

### 4. GPS temps réel pendant les balades

**Pourquoi** : actuellement le chrono `mockStartWalk` estime la distance à partir du temps (4 km/h moyenne). Un tracé GPS réel permettrait :
- Distance & dénivelé exacts
- Carte du parcours partageable
- Stats hebdomadaires crédibles

**Reste à faire** :
1. Demander `navigator.geolocation.watchPosition` au start
2. Stocker les points {lat, lon, ts} dans la walk entry
3. Calculer distance via formule de Haversine
4. Afficher le tracé avec Leaflet ou MapLibre GL

**Estimation** : 1 jour.

### 5. Community feed (vraies features sociales)

**Pourquoi** : aujourd'hui le feed home montre 2 posts "Exemple" codés en dur. Pour qu'une communauté se forme, il faut :
- Création de post (photo + texte + lieu)
- Friends (invitation par lien, géoloc de balade commune)
- Playdates (proposer un rendez-vous au parc)
- Modération basique

**Dépendance** : Supabase actif (auth + storage pour photos).

**Reste à faire** :
1. Tables `posts`, `friendships`, `playdates` (voir schema.sql à étendre)
2. Storage bucket `post-photos` avec RLS
3. Endpoint `/api/feed` qui retourne les posts des friends + géoloc proche
4. UI : bouton ➕ sur feed, formulaire post, modal photo
5. Système d'invitation par QR / lien

**Estimation** : 4-5 jours.

### 6. Scan du carnet vétérinaire (import auto)

**Pourquoi** : recopier manuellement 5 ans d'historique vaccins/vermifuges est le point de friction #1 à l'onboarding chez les panel testeurs.

**Reste à faire** :
1. Bouton "📸 Scanner mon carnet" sur étape onboarding optionnelle
2. Upload page par page au Claude Vision API (via `/api/chat.js` enrichi)
3. Claude extrait : vaccins + dates + type, vermifuges + dates, poids historique
4. Pré-remplissage du calendrier + timeline santé

**Estimation** : 2 jours (y compris vérif des parsings).

### 7. Mode "vet pro" (partage lecture seule)

**Pourquoi** : le QR de partage de carnet existe déjà mais mène à rien. Un vet pourrait scanner et voir tout l'historique sans compte.

**Reste à faire** :
1. Endpoint `/api/share-link` qui génère un token signé TTL 24h
2. Route `/share/[token]` en mode lecture seule (pas de nav, pas de bouton d'édition)
3. Log des accès (qui a consulté, quand)

**Estimation** : 1 jour.

### 8. Export PDF du carnet de santé

**Pourquoi** : les vets et pensions demandent souvent un PDF. Plus pratique que le QR.

**Reste à faire** :
1. Endpoint `/api/export-pdf` qui génère un PDF avec pdfkit ou react-pdf
2. Bouton "Télécharger PDF" dans l'écran santé

**Estimation** : 0.5 jour.

---

## 💡 Idées long terme (v3+)

- **Achat de services intégrés** : commande de croquettes, booking véto, pet-sitting (partenariats affiliés)
- **IA multimodale** : photo d'une gamelle → IA valide la portion ; photo d'une tique → IA identifie
- **Apple Watch / Wear OS companion** : rappels au poignet, chrono balade
- **Intégration iCal / Google Cal** : export des rappels dans le calendrier natif
- **Défis mensuels communauté** : "100 km ce mois", "20 balades"
- **Mode éleveur / refuge** : dashboard multi-chiens > 10, délégation de suivi
- **Voice mode** : l'utilisateur parle à l'IA en balade sans sortir le téléphone
- **Match santé race** : détection précoce de pathologies raciales (ex. dysplasie chez Labrador, luxation rotule chez Yorkshire)

---

## 🐛 Dette technique

- Le tracé GPS `mockStartWalk` n'est pas un vrai tracker — remplacer quand GPS live activé
- `recherche_3_3_3` entries ne sont pas encore rattachées à un programme spécifique (champ `program` dans la DB sera utile quand multi-programmes)
- Pas encore de tests (une fois Supabase actif, ajouter vitest + playwright sur 3-4 flows critiques)
- `currentWalk` n'est pas persisté — si l'utilisateur refresh en pleine balade, elle est perdue
- Les photos base64 gonflent le localStorage (~50-100KB par photo) — quand Supabase actif, passer au bucket
- i18n EN incomplet sur quelques textes de programmes (rescue 3-3-3 notamment)

---

## 🔐 Sécurité / conformité

Rien à faire tant que pas de comptes. Une fois Supabase actif :
- RLS activé partout (déjà dans schema.sql ✓)
- RGPD : bouton "Exporter toutes mes données" (on l'a ✓) + "Supprimer mon compte" (à faire)
- Mentions légales + politique de confidentialité (page statique)
- Ne stocker AUCUNE donnée de santé propriétaire (juste du chien) — attention à ce que l'IA ne collecte pas
- Chiffrement au repos : Supabase le fait par défaut
- Pas de tracking tiers (pas de Google Analytics ; utiliser Plausible si besoin)
