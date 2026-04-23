# K9 — Backlog produit

_Dernière mise à jour : 23 avril 2026_

État actuel : **v2.0 en cours de déploiement** (backend complet prêt sur Vercel — `https://k9-one.vercel.app`).

---

## ✅ Livré

- **v1.0–v1.4** : prototype mobile-first, 4 onglets, 12 sous-écrans, bilingue FR+EN, multi-chiens
- **v1.5** : Claude API branché (K9 Coach FAB + CTA contextuels, mode chat + mode plan)
- **v1.6** : 11 quick-wins (nom propriétaire, stats à 0, auto-lang nav, mini-tags exemple, journal rescue, etc.)
- **v1.7** : écran Paramètres centralisé, accessibilité (grande police/contraste), unités km/mi, upload photo réelle, mode "IA discrète"
- **v1.8** : calendrier unifié véto/vermifuge/anniversaire + Web Notifications, plans IA personnalisés (12 plans structurés 3 phases)
- **v1.9** : **persistance localStorage complète** (profil, chiens, calendrier, balades, rescue, paramètres), export/import/reset JSON, enregistrement balade chrono, squelette backend Supabase + cron rappels
- **v1.9.5–1.9.8** : panel post-déploiement (10 items), lost/found alerts + carte géoloc
- **v2.0** : **backend complet opérationnel** (voir section ci-dessous)

---

## 🚀 v2.0 — Backend complet (shipped)

Inspiré de l'architecture Adventurer (API découplée + Supabase-centric + RLS strict + bootstrap non-bloquant).

### Ce qui est en place côté code

**Base de données** (`db/schema.sql` v2)
- `profiles` (plan free/plus/pro, stripe, geo approximative)
- `dogs`, `events`, `walks` (+ `track_points` GPS), `rescue_entries`
- `lost_found_alerts` (photos, géoloc, statut)
- `posts`, `friendships`, `playdates`, `playdate_attendees`
- `share_tokens` (TTL 1-168h, accès signé au carnet véto)
- `push_subscriptions` (Web Push endpoints + VAPID)
- `ai_quotas` (free: 3 req/j, plus/pro: illimité)
- `audit_logs` (accès au carnet partagé, etc.)
- Extensions : `pgcrypto`, `pg_trgm` (search friends/dogs)
- RPCs : `ai_quota_increment(p_limit)`, `alerts_nearby(lat, lon, radius, limit)` (haversine)
- Trigger `handle_new_user` → auto-création du profile à l'inscription
- RLS strict partout (`auth.uid() = user_id`)

**API serverless** (`api/`)
- `config.js` — bootstrap public (non-auth) : renvoie `{supabaseUrl, supabaseAnonKey, vapidPublicKey, cloudEnabled}`
- `me.js` — GET profil + config, PATCH profil
- `sync.js` — GET/POST snapshot complet K9Store ↔ Supabase
- `alerts.js` — CRUD lost/found + géo-search + upload photo bucket
- `share-link.js` — POST token signé, GET lecture seule par token (logs)
- `export-pdf.js` — streaming PDF via pdfkit (profil, véto, historique santé)
- `scan-carnet.js` — Claude Vision sur image → extraction JSON stricte (quota)
- `quotas.js` — lecture/incrément quota IA
- `push-subscribe.js` — abonnement/désabonnement Web Push
- `feed.js` — posts communauté (join profiles + dogs + upload photo)
- `cron-reminders.js` — scan J+0/J+3, envoi Resend + web-push, marque `reminded_at`
- `_lib/supabase.js` — helpers partagés (createAdminClient, createUserClient, getUser, CORS, json, mockResponse)

**Client** (`index.html`)
- Module `K9Cloud` : ESM dynamic import depuis esm.sh, gère session Supabase Auth, magic link, push, pull, subscribePush, createShareLink, scanCarnet, exportPDF
- Écran "K9 Cloud" dans Réglages : email → magic link → synchro multi-device
- "📸 Scanner mon carnet" → caméra → IA → pré-remplissage calendrier
- "🩺 Partager avec mon véto" → génère lien TTL
- "📄 Exporter le carnet PDF" → download direct
- Mode share (`?share=token`) : overlay lecture seule sans auth
- Auto-push toutes les 2min si des données ont changé

**PWA**
- `manifest.json` (K9, orange, standalone)
- `service-worker.js` : push event, notificationclick, skipWaiting + claim
- Enregistrement automatique au load
- `vercel.json` avec headers `Service-Worker-Allowed: /` + crons

**Graceful degradation**
- Tant que les env vars Supabase ne sont pas posées, **tous les endpoints renvoient `{ok:true, mock:true}`** → l'app continue de fonctionner en mode local-only (exactement comme v1.9). Zéro régression.

### Ce qu'il reste à configurer (hors code)

1. Créer un projet **Supabase** (gratuit, ~5 min)
2. Copier-coller `db/schema.sql` dans SQL Editor → Run
3. Créer les buckets Storage : `alert-photos`, `post-photos`, `dog-photos` (tous public)
4. Ajouter les env vars Vercel :
   ```
   SUPABASE_URL=https://xxx.supabase.co
   SUPABASE_ANON_KEY=eyJ...
   SUPABASE_SERVICE_KEY=eyJ...            # service-role, GARDER SECRET
   ```
5. (Optionnel mais recommandé) :
   ```
   RESEND_API_KEY=re_...                  # rappels email
   RESEND_FROM_EMAIL=rappels@k9.app
   VAPID_PUBLIC_KEY=B...                  # npx web-push generate-vapid-keys
   VAPID_PRIVATE_KEY=...
   VAPID_SUBJECT=mailto:contact@k9.app
   PUBLIC_APP_URL=https://k9-one.vercel.app
   CRON_SECRET=…                          # sécurise /api/cron-reminders
   ANTHROPIC_API_KEY=sk-ant-…             # déjà posé pour /api/chat, sert aussi au scan carnet
   ```
6. Redéployer → K9 Cloud apparaît dans l'app, magic link fonctionne, sync multi-device active.

---

## 🔜 Prochaines priorités (v2.1+)

### 1. GPS temps réel pendant les balades

**Pourquoi** : actuellement le chrono `mockStartWalk` estime la distance à partir du temps (4 km/h moyenne). Un tracé GPS réel permettrait :
- Distance & dénivelé exacts
- Carte du parcours partageable
- Stats hebdomadaires crédibles

La colonne `track_points jsonb` est déjà en DB (schema v2).

**Reste à faire** :
1. `navigator.geolocation.watchPosition` au start de balade
2. Stocker les points {lat, lon, ts, alt} dans la walk entry
3. Haversine côté client pour la distance live
4. Afficher le tracé avec Leaflet (déjà utilisé pour les alertes)

**Estimation** : 1 jour.

### 2. Community feed (activer les vraies features sociales)

**Pourquoi** : aujourd'hui le feed home montre 2 posts "Exemple" codés en dur. Le backend (`/api/feed`, tables `posts` + `friendships` + `playdates`) est prêt. Il manque l'UI client.

**Reste à faire** :
1. Bouton ➕ sur le feed home (création post avec photo)
2. Flow invitation ami par QR / lien
3. Playdates (proposer un rendez-vous au parc)
4. Modération basique (signaler/bloquer)

**Estimation** : 3-4 jours.

### 3. Monétisation Plus / Pro

**Pourquoi** : infra Stripe déjà branchée (`/api/stripe-checkout`, `/api/stripe-portal`, `/api/stripe-webhook`). Les quotas IA sont déjà différenciés (free 3/j, plus illimité).

**Reste à faire** :
1. Configurer les prix Stripe (voir `STRIPE-SETUP.md`)
2. UI d'upsell quand quota IA atteint
3. Paywall sur scan carnet (plus) et export PDF illimité (pro)
4. Portail de gestion abonnement

**Estimation** : 1 jour.

### 4. Mode éleveur / multi-chiens >10

**Pourquoi** : un éleveur, une pension, un refuge gère 10-50 chiens. Le modèle actuel (1 compte = 1 foyer) ne scale pas.

**Reste à faire** :
1. Table `organizations` + `organization_members`
2. Switcher d'orga dans le header
3. Dashboard multi-chiens avec alertes groupées
4. Rôles (admin, soigneur, véto)

**Estimation** : 4 jours.

---

## 💡 Idées long terme (v3+)

- **Achat de services intégrés** : croquettes, booking véto, pet-sitting (partenariats affiliés)
- **IA multimodale** : photo gamelle → portion ; photo tique → espèce ; photo selle → diagnostic
- **Apple Watch / Wear OS** : rappels au poignet, chrono balade
- **Intégration iCal / Google Cal** : export des rappels dans le calendrier natif
- **Défis mensuels communauté** : "100 km ce mois", "20 balades"
- **Voice mode** : l'utilisateur parle à l'IA en balade sans sortir le téléphone
- **Match santé race** : détection précoce de pathologies raciales (dysplasie Labrador, luxation rotule Yorkshire)
- **Mode "premier chien"** : onboarding pédagogique complet pour les nouveaux propriétaires (checklist 7 jours / 3 mois / 1 an)

---

## 🐛 Dette technique

- Le tracé GPS `mockStartWalk` n'est pas un vrai tracker (colonne `track_points` prête côté DB — voir v2.1 #1)
- `currentWalk` n'est pas persisté — si l'utilisateur refresh en pleine balade, elle est perdue
- Les photos base64 gonflent le localStorage (~50-100KB/photo) — quand Supabase actif, migration vers bucket automatique via `/api/sync`
- i18n EN incomplet sur quelques textes (rescue 3-3-3 notamment)
- Pas encore de tests (ajouter vitest + playwright sur 3-4 flows critiques une fois Supabase live)
- Quota IA côté client est encore basé sur localStorage — bascule serveur via `/api/quotas` à câbler côté UI

---

## 🔐 Sécurité / conformité

Une fois Supabase actif :
- RLS activé partout (✓ dans schema.sql v2)
- RGPD : bouton "Exporter toutes mes données" (✓ local, à étendre via `/api/sync` GET)
- "Supprimer mon compte" : à ajouter côté UI (DELETE /api/me + cascade supabase)
- Mentions légales + politique de confidentialité (page statique) — **à écrire**
- Aucune donnée de santé **propriétaire** (juste chien) — l'IA est instruite de ne rien collecter côté humain
- Chiffrement au repos : Supabase par défaut
- Pas de tracking tiers (ni GA, Plausible envisagé plus tard)
- `CRON_SECRET` protège `/api/cron-reminders` contre les exécutions externes
- `SUPABASE_SERVICE_KEY` est **service-role**, ne jamais l'exposer côté client (utilisée uniquement dans `/api/`)
