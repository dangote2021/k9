# K9 — Activation du backend Supabase (v2.0)

Tant que les env vars ci-dessous ne sont pas posées, l'app fonctionne en **mode local-only** (comme v1.9) : tous les endpoints renvoient `{ok:true, mock:true}` et rien ne casse.

## 1. Créer le projet Supabase

1. https://supabase.com → new project → Europe (Frankfurt recommandé pour latence France)
2. Noter `SUPABASE_URL`, `ANON_KEY`, `SERVICE_ROLE_KEY`

## 2. Installer le schéma

- SQL Editor → New query → coller le contenu de `db/schema.sql` → Run
- Vérifier : tables créées + RLS active (Authentication → Policies)

## 3. Créer les buckets Storage

Storage → Create bucket (tous **public** pour servir les images sans auth) :
- `alert-photos` (perdus/trouvés)
- `post-photos` (feed communauté)
- `dog-photos` (avatars chiens)

Policies par défaut OK (public read, authenticated write).

## 4. Générer les clés VAPID (Web Push)

```bash
npx web-push generate-vapid-keys
```

→ Garder la public key (pour le client) et la private key (pour le serveur).

## 5. Env vars Vercel

Dans **Vercel → Project → Settings → Environment Variables** :

### Obligatoires (auth + sync)
```
SUPABASE_URL=https://xxxxx.supabase.co
SUPABASE_ANON_KEY=eyJ...
SUPABASE_SERVICE_KEY=eyJ...           # service-role, SECRET
```

### Recommandées (rappels, scan, push)
```
ANTHROPIC_API_KEY=sk-ant-...          # scan carnet + chat
RESEND_API_KEY=re_...                 # rappels email
RESEND_FROM_EMAIL=rappels@k9.app
VAPID_PUBLIC_KEY=B...
VAPID_PRIVATE_KEY=...
VAPID_SUBJECT=mailto:contact@k9.app
PUBLIC_APP_URL=https://k9-one.vercel.app
CRON_SECRET=<random-long-string>      # sécurise /api/cron-reminders
```

### Optionnelles (monétisation)
```
STRIPE_SECRET_KEY=sk_live_...
STRIPE_WEBHOOK_SECRET=whsec_...
STRIPE_PRICE_PLUS=price_...
STRIPE_PRICE_PRO=price_...
```

## 6. Redéployer

`git push` (ou "Redeploy" depuis Vercel) → à l'ouverture de l'app, `/api/config` renvoie `cloudEnabled:true` et la section "☁️ K9 Cloud" apparaît dans Réglages.

## 7. Test de bout en bout

1. Ouvrir l'app → Réglages → K9 Cloud → saisir son email
2. Cliquer "Recevoir le lien magique"
3. Vérifier l'email, cliquer le lien → retour sur l'app connecté
4. "Synchroniser maintenant" → vérifier dans Supabase Table Editor que `profiles` + `dogs` + `events` sont peuplés
5. Se déconnecter, réinstaller l'app / autre device → se reconnecter avec le même email → les données reviennent

## Dépannage

- **"cloudEnabled:false" alors que les env vars sont là** : redéployer (les env vars sont lues au build time côté API)
- **Magic link ne marche pas** : dans Supabase → Authentication → Email templates → vérifier le `SITE_URL` (doit pointer sur `https://k9-one.vercel.app`)
- **RLS errors** : vérifier qu'on utilise bien `createUserClient(req)` (JWT) et pas `createAdminClient()` pour les requêtes user-facing
- **Cron ne tourne pas** : Vercel Hobby limite à 1 cron/jour → déjà configuré à `0 7 * * *` (7h UTC). Vérifier Vercel → Cron Jobs
- **Push notif n'arrive pas** : vérifier que le service-worker est bien `/service-worker.js` (pas dans un sous-dossier) et que `Service-Worker-Allowed: /` est servi (déjà dans `vercel.json`)
