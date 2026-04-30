# K9 — Activation Supabase (mode schéma partagé)

K9 partage le **projet Supabase `ravito`** pour rester sur le plan Free
(limite : 2 projets/orga). Pour éviter toute collision avec les tables de
ravito, **tout K9 vit dans un schéma dédié `k9`** : tables, RPC,
triggers, et même les buckets Storage (préfixe `k9-`).

## Statut côté Supabase

| Item | Valeur |
|------|--------|
| Projet | `ravito` (org `juhwpvkywuhxdvcmayex`) |
| Project ref | `kymhcdxcyrpwyxbtgrdt` |
| URL | `https://kymhcdxcyrpwyxbtgrdt.supabase.co` |
| Région | `eu-west-3` (Paris) |
| Schéma K9 | `k9` (16 tables, RLS active partout) |
| Migrations appliquées | `k9_isolated_schema_v2_1`, `k9_rls_policies_and_triggers`, `k9_rpc_functions`, `k9_lock_function_search_paths` |

---

## Variables d'environnement Vercel — à poser

Dashboard Vercel → Project `k9-one` → Settings → Environment Variables :

```bash
SUPABASE_URL=https://kymhcdxcyrpwyxbtgrdt.supabase.co
SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imt5bWhjZHhjeXJwd3l4YnRncmR0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzY4ODgxNDcsImV4cCI6MjA5MjQ2NDE0N30.nVQH_LVjw44W1BdnhbJHvGQaqOKCvG3kQVd2-FPuFhk

# Service role key — la même que celle utilisée pour ravito
# (elle donne accès à TOUT le projet, pas seulement au schéma k9 — à manipuler avec soin)
SUPABASE_SERVICE_KEY=<copier depuis Supabase Dashboard → ravito → Settings → API → service_role>

# Recommandées (sinon dégradation propre)
ANTHROPIC_API_KEY=...                # pour /api/chat et /api/scan-carnet
RESEND_API_KEY=re_...                # pour /api/cron-reminders (emails)
RESEND_FROM=K9 <noreply@k9-one.vercel.app>
VAPID_PUBLIC_KEY=...                 # web push (cf. plus bas)
VAPID_PRIVATE_KEY=...
VAPID_SUBJECT=mailto:guillaumecoulon1@gmail.com
CRON_SECRET=<long-random-string>     # protège /api/cron-reminders

# Stripe (optionnel — Plus/Pro)
STRIPE_SECRET_KEY=sk_live_...
STRIPE_PUBLISHABLE_KEY=pk_live_...
STRIPE_WEBHOOK_SECRET=whsec_...
STRIPE_PRICE_PLUS=price_...
STRIPE_PRICE_PRO=price_...
PUBLIC_APP_URL=https://k9-one.vercel.app
```

Une fois posées : **redéployer** (Vercel → Deployments → ⋯ → Redeploy)
ou pousser un nouveau commit.

---

## Étapes manuelles à faire (1 fois) côté Supabase

> **Bonne nouvelle :** beaucoup d'étapes ont été automatisées via SQL/MCP.
> Il ne reste que **3 actions dashboard** + les env vars Vercel.

### ✅ Déjà fait automatiquement (via MCP)

- ✅ Schéma `k9` créé, 16 tables, RLS, triggers, RPCs
- ✅ Schéma `k9` exposé via PostgREST (`alter role authenticator set pgrst.db_schemas` + reload)
- ✅ 4 Storage buckets créés (`k9-dog-photos`, `k9-alert-photos`, `k9-post-photos`, `k9-vet-scans`)
- ✅ 13 RLS policies sur `storage.objects` (insert/update/delete par owner, lecture vet-scans owner-only)
- ✅ `search_path` verrouillé sur les fonctions K9 (advisor lint = 0 warning)

### 🔴 Reste à faire (manuel, ~3 minutes)

#### 1. Récupérer la Service Role Key

Dashboard `ravito` → **Settings** → **API** → **Project API Keys** →
copier la valeur `service_role` (⚠️ secret, garde-la confidentielle).
À coller dans `SUPABASE_SERVICE_KEY` côté Vercel.

#### 2. Configurer Auth Email (magic link)

Dashboard `ravito` → **Authentication** → **URL Configuration** :
- Site URL : `https://k9-one.vercel.app`
- Redirect URLs : ajouter `https://k9-one.vercel.app/*`

(Email magic link est activé par défaut ; pas besoin de toucher aux providers.)

⚠️ Auth est partagé entre K9 et ravito : un même email = un même
`auth.users.id` partout. Mais chaque produit a son propre profil
(`k9.profiles` vs `public.profiles` côté ravito), créés par triggers
distincts (`_on_auth_user_created_k9` vs trigger ravito). Aucune
collision possible.

#### 3. (Recommandé) Activer la protection mots de passe leakés

Dashboard `ravito` → **Authentication** → **Sign In / Up** →
"Leaked password protection" → ON.

C'est la seule recommandation Supabase Advisors restante côté K9.

---

## Variables Web Push (VAPID) — local

```bash
# une fois, sur ta machine :
npx web-push generate-vapid-keys
```

Copie `publicKey` → `VAPID_PUBLIC_KEY` et `privateKey` →
`VAPID_PRIVATE_KEY` dans Vercel.

---

## Vérification finale

Une fois les env vars posées et le redéploiement terminé :

```bash
# 1. config publique
curl https://k9-one.vercel.app/api/config
# → { "supabaseUrl": "https://kymhcdxcyrpwyxbtgrdt.supabase.co",
#     "supabaseAnonKey": "...",
#     "vapidPublicKey": "...",
#     "cloudEnabled": true }

# 2. Login magic link → ouvrir l'app, "Activer le cloud", mettre son
# email, cliquer le lien reçu, retour app : ☁ Connecté

# 3. Vérifier qu'une ligne k9.profiles a bien été créée :
# Dashboard ravito → Table Editor → Schema selector → k9 → profiles
```

---

## Notes architecture (schéma partagé)

**Ce qui est isolé (zéro collision possible) :**
- Toutes les tables → `k9.*`
- Tous les indexes → préfixe `k9_`
- Toutes les RLS policies → préfixe `k9_`
- Tous les triggers updated_at → préfixe `_k9_touch_*`
- Trigger sur `auth.users` → nom unique `_on_auth_user_created_k9`,
  fonction `k9.handle_new_user()`
- Tous les RPC → `k9.ai_quota_increment`, `k9.alerts_nearby`
- Tous les buckets Storage → préfixe `k9-`

**Ce qui est partagé (volontairement) :**
- `auth.users` → 1 user = 1 user_id partout
- `auth.sessions` → idem
- Service role key → unique pour le projet entier

**Si demain on veut migrer K9 vers son propre projet Supabase :**
- Dump du schéma `k9` (`pg_dump --schema=k9`)
- Créer nouveau projet, restore
- Changer `SUPABASE_URL` + `SUPABASE_ANON_KEY` côté Vercel
- Re-créer les 4 buckets `k9-*`
- Migrer les users via Auth admin export/import (auth.users séparée)

Migration coût : ~30 min côté ops.
