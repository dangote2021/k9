# K9 — Activation du paiement Stripe

Tout le code est déjà déployé. Il te reste ~15 minutes de config dans Stripe + Vercel pour encaisser de l'argent pour de vrai.

---

## Étape 1 — Créer ton compte Stripe (5 min)

1. Va sur https://dashboard.stripe.com/register
2. Crée ton compte (mail, password)
3. Pour l'instant reste en **mode Test** (toggle en haut à gauche, "Test mode" = ON)
4. Plus tard, pour activer le mode Live, Stripe demandera : SIREN, RIB, identité — classique KYC

## Étape 2 — Créer les 2 produits (3 min)

Dans Stripe dashboard → **Produits → Catalogue → + Ajouter un produit**

### Produit 1 : K9 Plus
- Nom : `K9 Plus`
- Description : `Abonnement mensuel — chiens illimités, IA illimitée, plans perso, export PDF véto`
- Tarification : **Prix récurrent** · `5,99 €` · `Mensuel` · devise `EUR`
- Crée → copie le **Price ID** (ex. `price_1QxxxxABCDE...`)

### Produit 2 : K9 Pro
- Nom : `K9 Pro`
- Description : `Abonnement mensuel pro — multi-profils pet-sitters/éleveurs, dashboard clients, offline`
- Tarification : **Prix récurrent** · `12,00 €` · `Mensuel` · devise `EUR`
- Crée → copie le **Price ID**

## Étape 3 — Récupérer les clés API (1 min)

Dashboard → **Développeurs → Clés API** :
- Copie la clé secrète **Test** : `sk_test_...` (commence par `sk_test_`)
- La clé publique n'est pas nécessaire côté serveur (on utilise Checkout hébergé)

## Étape 4 — Configurer les variables d'environnement Vercel (2 min)

Va sur https://vercel.com/[ton-org]/k9/settings/environment-variables

Ajoute ces 4 variables (sur tous les environnements : Production + Preview + Development) :

| Nom                 | Valeur                                |
| ------------------- | ------------------------------------- |
| `STRIPE_SECRET_KEY` | `sk_test_...` (de l'étape 3)          |
| `STRIPE_PRICE_PLUS` | `price_...` (K9 Plus, étape 2)        |
| `STRIPE_PRICE_PRO`  | `price_...` (K9 Pro, étape 2)         |
| `PUBLIC_SITE_URL`   | `https://k9-one.vercel.app` (ou ton domaine personnalisé) |

**Clique "Save" après chaque ajout.**

## Étape 5 — Brancher le webhook Stripe (3 min)

Stripe dashboard → **Développeurs → Webhooks → + Ajouter un endpoint**

- URL de l'endpoint : `https://k9-one.vercel.app/api/stripe-webhook`
- Événements à écouter (clique "Sélectionner des événements") :
  - `checkout.session.completed`
  - `customer.subscription.created`
  - `customer.subscription.updated`
  - `customer.subscription.deleted`
  - `invoice.payment_failed`
- Clique **Ajouter un endpoint**
- Sur la page du webhook, clique **"Signing secret" → "Révéler"** → copie la valeur `whsec_...`

De retour dans Vercel env vars, ajoute :

| Nom                     | Valeur                          |
| ----------------------- | ------------------------------- |
| `STRIPE_WEBHOOK_SECRET` | `whsec_...` (de cette étape)    |

## Étape 6 — Activer le Customer Portal (2 min)

Pour que tes utilisateurs puissent annuler/modifier leur abonnement depuis l'app :

Stripe dashboard → **Paramètres → Facturation → Customer portal**

- Clique **Activer**
- Active ces options :
  - ✅ Annuler l'abonnement
  - ✅ Mettre à jour la carte
  - ✅ Afficher les factures
  - ✅ Mettre à jour l'adresse de facturation
- Clique **Enregistrer**

## Étape 7 — Redéployer (1 min)

Après avoir ajouté toutes les env vars :
- Vercel dashboard → **Deployments → dernière version → ⋯ → Redeploy**
- Ou simplement push un nouveau commit

## Étape 8 — Tester (2 min)

1. Ouvre https://k9-one.vercel.app → Profil → "Plan K9" → Choisir Plus
2. Tu dois être redirigé vers Stripe Checkout
3. Utilise la carte de test Stripe : `4242 4242 4242 4242`, date future, CVC `123`
4. Après paiement → retour sur K9, alerte "🎉 Bienvenue dans K9 Plus !"
5. Dans Stripe dashboard → **Paiements** tu vois la transaction
6. Dans K9 → bouton "Gérer mon abonnement" → ouvre le Stripe Portal

Si ça marche → passe en **mode Live** (étape 9).

## Étape 9 — Passage en production (10 min)

Dans Stripe dashboard, bascule le toggle en haut à gauche sur **Live mode**. Tu vas devoir :
1. Refaire l'étape 2 (créer les 2 produits en Live) → nouveaux Price IDs
2. Refaire l'étape 3 (nouvelle clé `sk_live_...`)
3. Refaire l'étape 5 (nouveau webhook, nouveau `whsec_...`)
4. Mettre à jour les variables Vercel avec les valeurs **Live**
5. Redeploy

**Avant le mode Live, Stripe demande :**
- Identité (CNI passeport)
- SIREN / SIRET
- RIB pour les versements
- Adresse
- Description de l'activité

Compte ~24h pour validation KYC Stripe.

---

## Coûts Stripe

- **1,4 % + 0,25 €** par transaction européenne
- Sur un abonnement K9 Plus 5,99 €/mois → Stripe prend 0,33 € → tu gardes **5,66 €**
- Sur un K9 Pro 12 €/mois → Stripe prend 0,42 € → tu gardes **11,58 €**

## Ce qui est déjà codé

- `POST /api/stripe-checkout` — crée une session checkout et redirige
- `POST /api/stripe-webhook` — reçoit les events et persiste en DB (si Supabase configuré)
- `GET  /api/plan-status?sid=...` — vérifie le paiement au retour
- `POST /api/stripe-portal` — ouvre le portail client pour annuler/modifier
- UI : boutons dans l'écran "Choisis ton plan K9" + "Gérer mon abonnement"
- Retour de Stripe (query `?checkout=success`) : déverrouille le plan localement

## Persistance côté serveur (optionnelle, recommandée après 50+ abonnés)

Pour l'instant le plan est stocké en `localStorage` — si l'utilisateur change de device il perdra son accès payant. Pour régler ça :

1. Crée une table Supabase `subscriptions` :
   ```sql
   create table subscriptions (
     id uuid primary key default gen_random_uuid(),
     email text,
     plan text,
     status text,
     stripe_customer_id text,
     stripe_subscription_id text unique,
     updated_at timestamptz default now()
   );
   ```
2. Ajoute les env vars `SUPABASE_URL` + `SUPABASE_SERVICE_KEY` dans Vercel
3. Le webhook `/api/stripe-webhook` les utilisera automatiquement (code déjà prêt)

## Problèmes courants

- **"Stripe isn't wired up"** → les env vars ne sont pas présentes. Vérifie Vercel Settings.
- **Webhook signature invalide** → `STRIPE_WEBHOOK_SECRET` ne correspond pas à l'endpoint configuré dans Stripe.
- **Redirect vers Stripe qui renvoie 404** → le prix n'existe pas dans l'account (tu as copié un `price_...` du mode Test dans les env vars Live, ou inversement).
- **Après paiement, plan pas activé dans l'app** → le retour success attend `?sid={CHECKOUT_SESSION_ID}` — vérifie que `PUBLIC_SITE_URL` est bien celui de ton déploiement.
