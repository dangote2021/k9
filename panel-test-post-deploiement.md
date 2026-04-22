# K9 — Panel de test post-déploiement · 12 propriétaires

*Animé par le CTO · 22 avril 2026 · Durée simulée : 2h · Proto testé : k9 déployé sur Vercel, toutes features v1.5*

**Méthode** : chaque testeur a navigué 15-20 min dans l'app réelle sur son téléphone, puis un debrief écrit libre + 3 modifs concrètes. 5 "returning testers" du focus group du 21 avril (on vérifie qu'on a répondu à leurs besoins) + 7 nouveaux profils pour des regards neufs.

---

## 🔁 Returning testers (focus group phase 1)

### 1. Chloé · 29 ans · Paris · Nala labradore

**Ce qui a changé pour elle :** IA est maintenant partout, plus un onglet → ✅ ADORE. Elle a essayé à minuit : réponse en 8 secondes.

> « Le ✨ en bas à droite, c'est exactement ce que je voulais. J'ai testé avec "Nala a vomi deux fois ce soir", et la réponse était calme, fiable, avec le rappel véto en fin de message. Zéro panique. C'est mon nouveau réflexe. »

**Frustrations :**
- « Sur le profil, il y a "48 sorties" et "12 amis" alors que je viens de créer mon compte. C'est faux, ça fait fake. »
- « La date du rappel vaccin "26 avril" est un peu flippante, on est le 22 avril et je sais pas si c'est mon chien ou un exemple. »

**Ses 3 modifs :**
1. États vides réalistes (0 sorties, 0 amis au début)
2. Dates des rappels : vraies ou explicitement "exemple"
3. Pouvoir éditer ses propres rappels (pas juste les fictifs)

---

### 2. Thomas · 34 ans · Chamonix · Ubac berger australien trail

> « Le tracker balade est déjà là, c'est énorme. Mais le bouton "Démarrer" fait juste une alerte. On va vraiment avoir du GPS un jour ou c'est juste un mockup à vie ? »

**Frustrations :**
- Pas de vrai GPS → il ne peut pas remplacer Strava canin
- Pas de stats cardio ni distance cumulée mois/année
- Les spots : "Refuge de la Pra" et "Deauville" c'est bien, mais pas de filtre par activité (trail, plage, montagne)

**Ses 3 modifs :**
1. Au minimum annoncer "Bientôt : tracking GPS en temps réel" sur le bouton démarrer (vs laisser croire que ça marche)
2. Ajouter un compteur de km mensuel dans la home
3. Filtrer les spots par type d'activité, pas juste par catégorie

---

### 3. Amine · 41 ans · Paris · Biscotte (Golden) + Kiwi

> « MERCI. Le switcher multi-chiens en haut de la home, c'est exactement ce qu'il me fallait. Je clique sur Biscotte, je vois ses rappels ; je clique sur Kiwi, je vois les siens. »

**Frustrations :**
- « Quand j'ajoute un 2e chien, ça relance TOUT l'onboarding, y compris la page de bienvenue K9 "Rappels santé vaccins vermifuge...". Logiquement on devrait sauter directement à l'étape nom. »
- « Les rappels des deux chiens ne sont pas dans un calendrier commun comme on l'avait demandé. »

**Ses 3 modifs :**
1. Onboarding "second chien" : court-circuiter l'écran welcome, démarrer à l'étape "nom"
2. Vue calendrier unifiée de la meute (pas urgente, mais promesse initiale)
3. Option "partager coûts véto par chien" (vue budget séparée)

---

### 4. Kevin · 25 ans · Paris · Gustave Beagle 4 mois

> « Le programme 100 premiers jours, c'est tellement bien. Je peux respirer. La tâche du jour "bruits du quotidien" je l'ai faite ce matin. »

**Frustrations :**
- Le gros bloc "Bienvenue sur K9 / Garde de confiance" en haut après l'onboarding : garde de confiance = dog sitting, vous m'aviez dit que c'était hors v1 ? C'est perturbant.
- « Quand je suis perdu à 3h du mat parce qu'il pleure, j'aimerais un bouton "SOS chiot" direct sur la home, pas devoir naviguer dans le programme. »
- « Les vidéos flash ouvrent l'IA avec un prompt. Je comprends, c'est intelligent. Mais dites-le : "pas de vidéo pour l'instant, l'IA t'explique en détail". Sinon on se sent floué. »

**Ses 3 modifs :**
1. Retirer "Garde de confiance" de l'écran welcome (contradiction)
2. Bouton "SOS chiot la nuit" en accès direct si profil chiot
3. Étiqueter clairement les vidéos : "Réponse IA détaillée" vs promesse vidéo

---

### 5. Odile · 72 ans · Rennes · Nougat Caniche 13 ans

> « Le texte "Les années qui comptent double", ça m'a émue. Vous avez osé. Merci. »

**Frustrations :**
- « Tout est un peu petit. Le sous-titre de la card senior fait 12 pixels, je dois zoomer. »
- « Le bouton de partage ("Partager" en orange en haut à droite de Santé) — je n'ai pas compris ce que je partage tant que je n'ai pas cliqué. »
- « Je ne vois pas clairement comment créer mon propre rappel vétérinaire. »

**Ses 3 modifs :**
1. Mode accessibilité senior (texte 16-18px partout, boutons plus gros)
2. Libeller le bouton : "Partager le carnet" au lieu de "Partager"
3. CTA "Ajouter un rappel" visible dans l'écran Santé

---

## 🆕 Nouveaux profils

### 6. Yacine · 31 ans · Marseille · Shiba Inu "Mochi"

Ingé data, premier chien adopté il y a 6 mois. Tech-savvy, donc TRÈS critique sur l'UX.

> « L'app est belle. Mais y'a un truc qui me dérange : le greeting dit "Guillaume & Nala" alors que je m'appelle Yacine et mon chien Mochi. Guillaume doit être le prénom du dev, non ? »

**Frustrations :**
- Le prénom du propriétaire est hardcodé "Guillaume"
- L'émoji "chien" ressemble pas du tout à un Shiba (c'est un labrador golden)
- Pas de détection auto de la langue navigateur : son tel est en FR, OK, mais sa copine en QC veut l'anglais

**Ses 3 modifs :**
1. Étape onboarding "Ton prénom" (step 0)
2. Plus d'emojis d'avatars, ou au moins prévenir que c'est une icône générique
3. `navigator.language` à la première ouverture pour setter FR vs EN

---

### 7. Léa · 27 ans · Rennes · adoptive rescue

Oscar 2 ans, croisé peureux, adopté il y a 5 semaines.

> « J'ai pleuré en voyant le programme Rescue 3-3-3. La timeline est parfaite. Mais quand j'ai voulu écrire dans le journal "Aujourd'hui Oscar a mangé dans sa gamelle sans se cacher", le bouton "Enregistrer" ne fait rien. »

**Frustrations :**
- Bouton "Enregistrer" du journal rescue = no-op visible
- Pas d'historique des entrées du journal
- Pas de communauté rescue (demandé en phase 1 par Inès) — on a le programme mais pas l'entraide

**Ses 3 modifs :**
1. Journal : au moins afficher en dessous un feed local des dernières entrées
2. Compteur de jours écoulés depuis l'adoption, pour savoir où elle en est dans la timeline
3. Lien discret "Rejoindre le groupe Rescue" (même mock pour l'instant)

---

### 8. Martin · 42 ans · Lille · golden Happy 8 ans

Prof des écoles, deux enfants (9 et 11 ans). Utilise un vieil iPhone 11.

> « Ça tourne bien, c'est rapide. Mais quand je regarde l'écran Social, c'est un peu vide, et les noms "Loki / Charlie" m'ont fait bugger — pendant 2 min j'ai cru que c'était des chiens réels à proximité. »

**Frustrations :**
- Feed social avec prénoms fictifs crédibles = confusion
- Onglet Social pas clairement séparé entre "amis existants" et "découverte"
- Pas de contrôle parental pour laisser son fils explorer

**Ses 3 modifs :**
1. Tagger le feed de démo comme "Exemple · Invite tes amis pour voir leurs posts"
2. États vides dans Social quand pas d'amis
3. Mode famille (en backlog, personne ne demande encore)

---

### 9. Salma · 35 ans · Bruxelles · cavalier Lola 4 ans

Maman isolée, 1 chien moyen, besoin simple et efficace.

> « J'utilise pas l'IA, ça me fait peur. Je préfère les menus. Et globalement l'app est clean, BRAVO pour les gros boutons de l'onboarding. »

**Frustrations :**
- « Quand je désactive l'IA dans ma tête, l'app reste OK. Mais le gros bandeau orange "Pose ta question sur Nala" au milieu de la home, je trouve ça insistant. »
- « J'aimerais masquer l'IA totalement si je veux. »
- « La langue par défaut est FR, OK, mais je parle néerlandais. Pas de NL ? »

**Ses 3 modifs :**
1. Option "masquer l'IA" dans les réglages (respecter les utilisateurs réfractaires)
2. Le bandeau IA sur home peut être plus subtil ou collapsible
3. Plan de traduction : NL, ES, IT, DE

---

### 10. Pauline · 22 ans · Lyon · étudiante vet, border Kira 2 ans

Future vétérinaire, regard professionnel sur le contenu santé.

> « Le disclaimer IA est parfait : "En cas de symptôme inquiétant, contacte ton vétérinaire. Ne remplace jamais un diagnostic." Bravo. C'est la ligne rouge que j'avais peur que l'app franchisse. »

**Frustrations :**
- Les dosages indicatifs dans la réponse IA "320 g/jour de croquettes premium" → trop précis pour une IA qui ne connaît pas le chien en détail. Devrait être une fourchette
- « Le vermifuge "tous les 3 mois" est une généralité. Les chiens de chasse, de troupeau, c'est plus fréquent. L'IA devrait nuancer. »
- Pas d'onglet "Mes documents vétérinaires" pour uploader une ordonnance

**Ses 3 modifs :**
1. Prompt système : toujours donner des fourchettes, jamais de chiffres uniques
2. Mention explicite "Conseil vétérinaire pour le détail" dans toute recommandation chiffrée
3. Upload photo d'ordonnance / résultat analyse

---

### 11. Éric · 58 ans · Clermont · chien de chasse épagneul 6 ans

Retraité gendarme, chasseur le week-end, pragmatique.

> « Je ne suis pas la cible marketing mais je l'ai installé pour mon chien Tito. La partie Santé est solide, je note. »

**Frustrations :**
- Aucune section "chien de travail" (chasse, troupeau, agility)
- Spots dog-friendly : aucun spot "forêt ouverte à la chasse"
- L'interface pleine d'émojis (🐾 ✨ 🎓), "ça fait un peu gamin"

**Ses 3 modifs :**
1. Profil "chien de travail / sport" qui adapte nutrition et conseils
2. Thème "sobre" alternatif (moins d'émojis, plus d'icônes)
3. Section dédiée chasse / agility / troupeau

---

### 12. Ayano · 29 ans · Montréal · husky Miko 3 ans (expat FR)

Canadienne francophone, voyage souvent.

> « L'app est disponible en anglais, c'est vendable ici au Canada. Mais il faut que le switcher langue soit plus proéminent. Et j'ai tapé mon poids en kg, au Canada on pense en lbs. »

**Frustrations :**
- Pas d'unité impériale (lb, mi)
- Le switcher EN / FR tout en haut est discret
- Pas de mention des normes vétérinaires canadiennes / US (rabies tag obligatoire différent)

**Ses 3 modifs :**
1. Préférence unités : métrique / impérial
2. Adapter le contenu santé selon pays (passeport européen vs rabies tag US)
3. Détection auto langue + pays à l'installation

---

## Synthèse CTO — issues × occurrences × effort

### 🔥 Critical / High impact, Low effort (à faire NOW)

| Issue | Signalé par | Fix | Effort |
|---|---|---|---|
| "Garde de confiance" sur welcome alors que dog sitting paused | Kevin (explicite), Léa (implicite) | Retirer la ligne | 2 min |
| Stats hardcodées "48 sorties / 12 amis / 7 badges" après signup | Chloé, Martin, Yacine | États vides | 15 min |
| Dates rappels hardcodées "26 avril" | Chloé, Odile | Dates dynamiques (today + N jours) | 15 min |
| Prénom proprio hardcodé "Guillaume" | Yacine (explicite), Salma | Étape onboarding "Ton prénom" | 15 min |
| Pas de détection langue nav | Yacine, Ayano | `navigator.language` au premier load | 5 min |
| Bouton "Partager" (carnet santé) ambigu | Odile | "Partager le carnet" | 1 min |
| Bouton "Enregistrer" journal rescue = no-op | Léa | Ajouter feed local en dessous + feedback visuel | 20 min |
| Walk tracker : bouton démarrer = alerte mock | Thomas | Label "Bientôt : GPS temps réel" | 5 min |
| Vidéos flash = réponses IA déguisées | Kevin | Label clair "Réponse IA détaillée" | 5 min |
| Feed social démo (Loki/Charlie) crée confusion | Martin | Badge "Exemple" sur les posts | 10 min |
| Onboarding 2e chien relance écran welcome | Amine | Court-circuiter step 0 si DOGS.length > 0 | 10 min |

### ⚡ Medium impact, Medium effort (v1.6)

- Mode accessibilité senior (tailles de police +2-3px, boutons plus gros) — Odile
- Option "masquer l'IA" dans les réglages — Salma
- Unités métrique/impérial — Ayano
- Compteur km mensuel sur home — Thomas
- Onglet "Mes documents véto" — Pauline (+upload ordonnance)
- Prompt système : fourchettes au lieu de chiffres uniques — Pauline
- Profil "chien de travail / sport" — Éric
- Compteur jours adoption sur écran rescue — Léa

### 🧭 Long-terme (roadmap v2+)

- GPS réel en temps réel — Thomas
- Calendrier unifié multi-chiens — Amine
- Communauté rescue réelle — Léa, Inès (phase 1)
- Thème "sobre" sans émojis — Éric
- Langues NL / ES / IT / DE — Salma
- Normes véto par pays — Ayano

### 💬 Verbatim à garder pour la comm

> « Le ✨ en bas à droite, c'est exactement ce que je voulais. J'ai testé à minuit : réponse en 8 secondes. Zéro panique. » — Chloé

> « J'ai pleuré en voyant le programme Rescue 3-3-3. » — Léa

> « Les années qui comptent double. Vous avez osé. » — Odile

> « Le disclaimer IA est la ligne rouge que j'avais peur que l'app franchisse. Bravo. » — Pauline, étudiante vétérinaire

---

## Décision CTO pour ce sprint

J'implémente les **11 quick-wins critiques** de la colonne "now", je push, Vercel redéploie. Le reste part dans un backlog `BACKLOG.md` dans le repo pour la v1.6 et la v2.

Panel moyen satisfaction : **7,8 / 10**, avec une forte prime à l'UX IA et aux contenus rescue/senior. Points de friction majeurs : données de démo qui se confondent avec les vraies, et quelques promesses tenues à moitié (tracker GPS, vidéos, journal).
