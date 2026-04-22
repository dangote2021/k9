# K9 — Panel test v1.9.3 + Quick Wins + Monétisation

_22 avril 2026 · https://k9-one.vercel.app_

---

## TL;DR

**Note moyenne du panel : 5,8 / 10** (8 propriétaires, profils variés).

Le cœur de l'app (calendrier + multi-chiens + rescue 3-3-3 + ton chaleureux) est validé. Quatre frictions critiques reviennent systématiquement :

1. **Le Coach IA ne répond pas** (crédits Anthropic à zéro) — casse la promesse centrale.
2. **La communauté est statique** (2 faux posts) — déception au 1er tap pour 4 panélistes sur 8.
3. **Pas de notifications email** — les rappels Web Notifications ne suffisent pas à créer de la rétention.
4. **L'app parle aux urbains 25-40 ans qui ont un jeune adulte** — elle exclut de fait les seniors, les sportifs, les chiens de travail, les familles, les rescues avec besoins comportementaux fins.

Et un signal business majeur : **4 panélistes sur 8 doutent explicitement de la valeur d'un abonnement centré IA**. L'IA seule ne suffit pas à justifier un paiement récurrent. Il faut soit un bouquet de services (emails + sync + vrais humains), soit un positionnement spécialisé (sport, rescue, famille).

---

## Partie 1 — Synthèse du panel virtuel

Les 8 profils testés (détail complet dans l'output du panel) :

| # | Profil | Chien | Note | Paierait ? |
|---|--------|-------|------|------------|
| 1 | Amélie, 28, Paris | Golden chiot 4 mois | 6,5 | Oui 4,99€ si IA + visio véto |
| 2 | Jean-Marc, 62, Bordeaux | 2 Labradors seniors | 5,0 | Non à ce prix — max 2€ pour 2 chiens |
| 3 | Leïla, 35, Lyon | Malinois 3 ans (trail) | 6,0 | Oui 7-8€ si GPS réel + plans sport |
| 4 | Thomas, 42, Toulouse | Jack Russell famille | 6,0 | 3€ max pour mode famille, pas pour IA |
| 5 | Camille, 26, Nantes | Rescue 3-3-3 en cours | 7,5 | Oui 5€ si IA répond + suivi fin |
| 6 | Yann, 55, Brest | Border Collie berger | 4,0 | Non, pas adapté à son usage |
| 7 | Sophie, 31, Strasbourg | Cavalier urbain | 5,5 | Oui 4€ pour vraie communauté |
| 8 | Mehdi, 38, Marseille | Laobé-Africanis rescué | 6,0 | Peut-être 3€ si IA et arabe |

### Frictions citées par 3+ panélistes (à traiter en priorité)

| Friction | Panélistes | Sévérité |
|---|---|---|
| Coach IA ne répond pas / feedback erreur absent | Amélie, Camille, Mehdi | **Critique** |
| Communauté statique / fake / morte | Amélie, Thomas, Camille, Sophie | Haute |
| Pas d'emails / notifs limitées app ouverte | Jean-Marc, Amélie, Thomas | Haute |
| GPS balades non réel / estimation 4 km/h biaisée | Leïla, Jean-Marc, Yann | Haute |
| Pas de segmentation (senior, travail, sport, famille) | Jean-Marc, Leïla, Thomas, Yann | Haute |
| Multi-utilisateurs / famille partagée absente | Thomas, Jean-Marc | Moyenne |
| Base races / langues trop européano-centrée | Mehdi, Camille | Moyenne |
| **Doute explicite sur valeur payante IA seule** | Jean-Marc, Thomas, Yann, Mehdi | **Critique business** |

---

## Partie 2 — Quick wins prioritisés

Je garde ici uniquement ce qui ne change pas fondamentalement l'app. Les changements de fond (GPS réel, comptes + sync, mode chien de travail, module senior complet) sont déjà dans le BACKLOG v2+. Focus ici sur ce qu'on peut livrer **en quelques heures, sans toucher à l'architecture**.

### Tier A — À faire cette semaine (< 1h chacune)

**A1. Recharger les crédits Anthropic** _(action billing, pas dev)_
Le Coach IA est au centre de l'app. Tant qu'il ne répond pas, la note moyenne chute mécaniquement de 1,5 à 2 points. Coût : 5$ = ~5000 questions K9 Coach. Action sur https://console.anthropic.com/settings/billing.

**A2. Empty states "en construction" sincères sur la communauté**
Remplacer les 4 faux amis + 3 playdates statiques par un vrai empty state honnête : "La communauté K9 arrive bientôt 🐾 En attendant, partage K9 avec tes amis propriétaires pour bâtir ton cercle." + bouton "Inviter un ami" (Web Share API). Mieux vaut une attente transparente qu'une fausse présence. Effort : 30 min.

**A3. Mode senior auto-proposé si âge propriétaire > 60**
L'app connaît l'âge propriétaire (via onboarding). Jean-Marc a dû chercher le mode accessible — proposons-le en toast au 1er login : "Nous avons préparé un mode grands caractères, l'activer ?". Effort : 15 min.

**A4. Rappel auto de l'anniversaire du chien**
L'app connaît l'âge (années/mois) mais ne crée pas d'événement anniversaire dans le calendrier. Auto-créer à l'onboarding. Effort : 20 min.

**A5. Lien cliquable `tel:` sur le véto**
Jean-Marc veut appeler son véto en 1 tap depuis le carnet. Ajouter un champ "téléphone véto" en optionnel dans les paramètres et le rendre cliquable. Effort : 25 min.

**A6. Partage du profil chien par lien / WhatsApp**
Sophie poste Biscotte partout. Un bouton "Partager mon chien" avec Web Share API générant une carte (nom, race, âge, photo) serait un viral channel. Effort : 45 min.

**A7. Ajouter 5-8 races africaines/orientales**
Sloughi, Azawakh, Berger de l'Atlas (Aïdi), Basenji, Chien nu du Pérou, Thaï Ridgeback. Effort : 10 min. Marginal mais signal d'inclusion fort.

### Tier B — À faire sous 2 semaines (1-3h chacune)

**B1. Parcours "Mon premier chiot" (12 mois)**
Amélie a tapé ça sur Google tous les jours. Générer un parcours structuré (vaccins, socialisation, propreté, stérilisation, crises ado) affiché dans Santé. Peut utiliser le moteur de plans IA existant avec un template spécial "chiot". Effort : 2h.

**B2. Catégorie "chien senior" dans Santé**
Rubriques : arthrose, alimentation senior, bilan gériatrique annuel, signaux cognitifs. Données en dur + un plan IA "santé articulations senior" déjà présent à mettre en avant pour les chiens 8+. Effort : 1h30.

**B3. Journal 3-3-3 enrichi : suivi comportemental**
Camille a besoin de cocher peur/grognement/réactivité/progrès par semaine. Ajouter 4 cases à cocher dans le journal rescue. Persister + afficher en timeline. Effort : 1h30.

**B4. Amélioration du feedback K9 Coach**
Déjà fait dans v1.9.3 (message "crédits à recharger"). À compléter : typing indicator plus réactif, ajouter un fallback contextuel quand l'utilisateur pose une question classique (traction, rappel) → on sert la réponse préparée d'I18N plutôt qu'un "réessaye". Effort : 1h.

**B5. Mode "prêt pour pet-sitter" (PDF lecture seule)**
Thomas et Jean-Marc veulent partager leur chien avec la famille et à terme un pet-sitter. Sans Supabase, on peut déjà générer un PDF dans le navigateur (jspdf) avec toutes les infos + QR code. Effort : 2h.

**B6. Météo tiques / parasites**
Amélie panique pour les bouchons, Jean-Marc pour les tiques. Intégrer une alerte saisonnière contextuelle (API meteo gratuite) : "Alerte tiques ce week-end sur Bordeaux — pense à vérifier Max après la balade". Effort : 2h30.

**B7. Onglet "Mes races" enrichi**
Pour chaque race, ajouter 2-3 conseils spécifiques (prédispositions santé, besoins d'exercice, particularités caractère). Déjà la race pré-rempli plein de choses — compléter la fiche race rend l'app mémorable. Effort : 3h (8-10 races les plus fréquentes d'abord).

### Tier C — Nice-to-have à planifier (3-6h chacune)

**C1. Mini checklist "à chaque balade"** — penser eau, sac, antiparasitaire ; case à cocher.
**C2. Export carnet de santé en PDF officiel** — tamponné façon carnet véto, imprimable en une page.
**C3. Widget mini-stats sur l'accueil** — "Cette semaine : 4 balades, 1h48, 1 vaccin à faire".
**C4. Page "À propos / Qui sommes-nous"** — crédibilité + SEO.
**C5. Meta tags social preview** — `<meta property="og:*">` pour partage propre sur WhatsApp / iMessage / réseaux.
**C6. Suggestion IA contextuelle** — plutôt que 4 suggestions fixes, lire les derniers événements (ex. "vaccin J-3") et proposer "Que dois-je prévoir pour le rappel CHPPL ?".

### À NE PAS FAIRE (préservation du cap)

Le panel pousse vers plein d'ajouts. Certains seraient des pièges :
- **Pas de réseau social façon Insta pour chiens**. Sophie en veut, mais construire une vraie communauté modérée avec UGC est un produit à part entière (et un enfer légal). Garder K9 centré outil personnel.
- **Pas de mode chien de travail en v2**. Yann représente un segment niche (< 2% des proprios). Reprendre plus tard.
- **Pas d'arabe en v2**. Bien mais coûteux. Valider d'abord traction FR+EN.
- **Pas de gamification excessive**. Les badges sont OK (Thomas les adore) mais ne pas forcer des défis mensuels qui rendraient l'app infantile pour Yann, Leïla.

---

## Partie 3 — Monétisation

### Le constat du panel
Sur 8 panélistes :
- 3 paieraient sans hésiter (Amélie, Leïla, Camille) — tous pour des raisons différentes (chiot / sport / rescue).
- 2 paieraient un petit montant ciblé (Sophie pour communauté, Thomas pour famille).
- 3 ne paieraient pas ou très peu (Jean-Marc, Yann, Mehdi).

**Prix psychologique moyen acceptable : 3-5 €/mois** pour un abo général. **7-10 €/mois** pour un positionnement spécialisé (sport, premier chiot, rescue).

### Modèle recommandé : freemium multi-couches

**Couche 1 — Gratuit (rétention)**
Tout ce qui est déjà dans l'app : calendrier, multi-chiens, K9 Coach limité (5 questions/jour), plans IA (2/mois), journal rescue, balades chrono, export/import. L'app reste utilisable à 100% pour un propriétaire occasionnel.

**Couche 2 — K9 Plus (5,99 €/mois ou 49 €/an)** — le sweet spot psychologique
- K9 Coach illimité
- Plans IA illimités
- Rappels email + SMS (pas juste navigateur)
- Sync multi-device (Supabase activé)
- Export PDF officiel du carnet de santé
- Mode famille : partage lecture/écriture jusqu'à 4 membres
- Scan du carnet véto (Claude Vision)

**Couche 3 — K9 Pro (12 €/mois)** — pour segments verticaux
- Tout K9 Plus
- **Volet sport** : GPS réel, dénivelé, plans canicross/trail (pour Leïla)
- **Volet premier chiot** : parcours 12 mois + 1 consult véto visio/mois (partenariat)
- **Volet senior** : alertes bilan gériatrique, suivi arthrose, plan mobilité

Cette tiérisation permet de ne pas perdre Jean-Marc et Thomas qui refusent Plus à 6€, tout en captant Amélie, Leïla, Camille qui sont prêts à payer Pro.

### Sources de revenus complémentaires (non-abonnement)

**1. Affiliation** (le plus gros potentiel sans friction utilisateur)
Placements propres, jamais intrusifs :

| Partenaire | Commission | Exemple d'usage |
|---|---|---|
| Zooplus / Croquetteland | 5-8% CA | Bouton "Commander les croquettes conseillées" |
| Santévet / April Assurance | 30-80€/souscription | "Ton chien a 3 ans, c'est le moment idéal" |
| Pet-Sitters FR / Animaloo | 10-15% | Bouton "Trouver un pet-sitter" |
| Allo Véto / VetInMe (visio) | 20% | Pour K9 Pro inclus, et pay-per-use autres |
| Tidewe / Camon (accessoires) | 5-10% | Pour profils sportifs (harnais trail) |

**Estimation réaliste** : sur 10k utilisateurs actifs mensuels, avec 3-5% qui cliquent et 50% convertissent, ~300€/mois uniquement sur croquettes + assurance. Faible individuellement mais zéro effort de maintenance.

**2. Marketplace pro locale**
Commission de 10-15% sur prise de rendez-vous via K9 avec :
- Véto (le plus mature, Doctolib-like)
- Éducateur canin / comportementaliste
- Toiletteur
- Pet-sitter / dog walker

Techniquement lourd à faire bien, mais énorme LTV potentielle. À envisager en v3 uniquement.

**3. Micro-transactions (faible mais immédiat)**
- Plan IA unique 2,99 € (pour non-abonnés qui veulent un plan spécifique)
- Export PDF carnet officiel : 1,99 € l'unité (gratuit dans Plus)
- Scan carnet véto ponctuel : 4,99 €

**4. B2B (à envisager seulement si traction grand public solide)**
- Licences éleveurs / refuges / écoles de dressage : 20-50€/mois par utilisateur pro
- Partenariats marques : placement éditorial sponsorisé (Royal Canin, Purina, Pedigree) — attention à ne pas polluer l'expérience

### Projections chiffrées (hypothèses prudentes)

Base d'utilisateurs hypothétique à 12 mois : **10 000 MAU** (réaliste avec un petit budget paid acquisition).

| Source | Volume | Panier | Revenu mensuel |
|---|---|---|---|
| K9 Plus (taux conv. freemium 3%) | 300 abonnés | 5,99 € | **1 797 €** |
| K9 Pro (taux 0,5%) | 50 abonnés | 12 € | **600 €** |
| Affiliation croquettes + assurance | 10k MAU × 3% clic × 50% conv. × 20€ | — | **~300 €** |
| Export PDF + plans uniques | ~50/mois × 3€ | — | **~150 €** |
| **Total** | | | **~2 850 €/mois** |

Soit ~34 k€/an en régime. Couvre un dev mi-temps ou les crédits API + hébergement + acquisition. Le levier vient des volumes : à 50k MAU, même ratios = ~14 000 €/mois (170 k€/an).

### Séquençage conseillé

**Mois 1-2** : recharger Anthropic, livrer Tier A + B du quick wins. Pas de monétisation, on valide la rétention (DAU/MAU, retention J+30).

**Mois 3-4** : activer Supabase + comptes + emails. Lancer K9 Plus à 5,99 € en early-bird 3,99 € les 3 premiers mois pour les 500 premiers. Mesurer conversion.

**Mois 5-6** : ajouter l'affiliation (croquettes en premier, le plus simple). Tester 2-3 placements non-intrusifs.

**Mois 7+** : si Plus convertit > 3%, lancer K9 Pro Sport puis Premier chiot. Si < 2%, pivoter sur une proposition de valeur différente (probablement : dévisser le curseur vers un utilitaire B2C plus pur avec affiliation comme pilier principal).

---

## Checklist d'action immédiate

- [ ] Recharger crédits Anthropic (5$ suffisent pour 2 mois de test)
- [ ] Empty states honnêtes sur la communauté (A2)
- [ ] Auto-toast mode senior si âge > 60 (A3)
- [ ] Anniversaire auto dans le calendrier (A4)
- [ ] Téléphone véto cliquable (A5)
- [ ] Bouton partage profil chien (A6)
- [ ] 5-8 races africaines/orientales (A7)

Une fois ces 7 quick wins livrés, on aura un panel v1.9.4 à 6,8-7/10 (estimation) avec une base crédible pour activer la couche payante.
