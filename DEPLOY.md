# K9 — Déploiement Vercel (5 minutes)

Tout est prêt dans le dossier. Il ne reste qu'à pousser sur Vercel et ajouter la clé Claude.

## Option A — Drag & drop (le plus rapide)

1. Va sur **https://vercel.com/new**
2. Clique sur **"deploy"** → **"Browse files"** (ou glisse-dépose le dossier `K9/`)
3. Nomme le projet **`k9`**, laisse Framework Preset = `Other`
4. Clique **Deploy**
5. Une fois déployé, ouvre le projet → **Settings → Environment Variables**
6. Ajoute :
   - Key : `ANTHROPIC_API_KEY`
   - Value : ta clé `sk-ant-…` depuis https://console.anthropic.com
   - Scope : Production + Preview
7. Onglet **Deployments** → `…` → **Redeploy** pour que la clé soit prise en compte

## Option B — CLI (si tu es dev)

```bash
cd chemin/vers/K9
npx vercel login     # une seule fois
npx vercel --prod
# Puis :
npx vercel env add ANTHROPIC_API_KEY production
# Colle ta clé Claude, puis :
npx vercel --prod    # redeploy avec la clé
```

## Option C — GitHub auto-deploy

```bash
cd chemin/vers/K9
git init && git add . && git commit -m "K9 v1.5"
gh repo create k9 --private --source=. --push
# Sur Vercel, "Import Git Repository" → sélectionner k9
# Puis ajouter ANTHROPIC_API_KEY comme en Option A step 5-7
```

## Vérification

- `https://k9-xxx.vercel.app/` doit afficher l'onboarding Nala
- Ouvre l'IA (✨ en bas à droite) → pose une question → si `ANTHROPIC_API_KEY` est bien set, la réponse vient en direct de Claude
- Sinon, un message explicite dit que la clé manque (sans casser le proto)

## Structure

```
K9/
├── index.html       ← app complète (single-page)
├── api/chat.js      ← endpoint serverless Claude
├── vercel.json      ← routing + cache headers
├── package.json     ← meta projet
└── DEPLOY.md        ← ce fichier
```

L'endpoint `/api/chat` attend un POST JSON :
```json
{ "message": "...", "history": [...], "dog": { "name":"Nala", ... }, "lang": "fr" }
```

Modèle utilisé : `claude-sonnet-4-6`, max_tokens 600, prompt système bilingue K9 Coach avec garde-fous véto.
