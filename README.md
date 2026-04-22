# K9

Porte d'entrée unique pour les propriétaires de chiens.
Santé, éducation positive, programmes par stade de vie, communauté, IA Claude intégrée.

## Stack

- Front : HTML/CSS/JS single-file (`index.html`)
- Back : Vercel serverless function (`api/chat.js`) vers l'API Claude
- Modèle : `claude-sonnet-4-6`
- Langues : FR (par défaut) + EN

## Développement local

```bash
npx vercel dev
```

## Variables d'environnement (Vercel)

- `ANTHROPIC_API_KEY` : clé Claude depuis https://console.anthropic.com

## Features

- Onboarding 5 étapes (nom, race, âge, avatar, morphologie)
- Multi-chiens par compte
- IA K9 Coach (FAB + CTA contextuels — jamais un onglet dédié, par choix UX)
- Carnet santé avec QR de partage (véto, pension, proches)
- Tracker balades avec historique
- Programmes "100 premiers jours chiot", "Rescue 3-3-3", "Vieillir ensemble"
- Vidéos flash d'éducation < 60s
- Spots dog-friendly cartographiés
- Bilingue FR / EN natif

## Disclaimer IA

L'IA valide les contenus santé avec des garde-fous explicites : pour tout symptôme inquiétant, douleur, saignement, convulsion ou intoxication suspectée, le conseil renvoie vers un vétérinaire. Pas de diagnostic médical.
