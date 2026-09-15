# Innovation Radar — Aromatech Afrique

Dashboard de veille marketing automatisée. Récupère les nouvelles publications
des sites sources (RSS), les normalise, les stocke, et les affiche dans un
dashboard filtrable/consultable sans jamais interroger les sites tiers
directement depuis le navigateur (contournement propre des restrictions CORS).

**Mintel et Innova Market Insights : activées comme sources suivies.** Ces plateformes n'ont pas de flux RSS public (abonnement requis), donc pas de sync automatique possible — mais elles ne sont plus marquées en erreur. Elles apparaissent désormais avec un statut dédié **"Accès manuel (activé)"** (pastille bleue) dans l'onglet Sources : la source est reconnue et suivie, la consultation se fait via login sur leur plateforme une fois l'abonnement Aromatech souscrit (contacts fournis dans la conversation). C'est le même principe que pour LinkedIn.

## Veille Clients & Veille Concurrents

Deux nouveaux onglets permettent de surveiller des entreprises spécifiques (clients
ou concurrents) au-delà des sources sectorielles fixes :

- **Formulaire d'ajout** : nom + site web (+ flux RSS optionnel si vous le connaissez déjà).
- **Détection automatique de flux RSS** (`shared/watchlistCore.js` → `discoverFeed()`) :
  à l'ajout, le serveur regarde d'abord si la page d'accueil déclare un flux via
  `<link rel="alternate" type="application/rss+xml">`, puis teste une liste de
  chemins usuels (`/feed`, `/rss.xml`, `/blog/feed`, etc.). Si un flux fonctionne,
  l'entreprise passe **Active** et est synchronisée automatiquement (toutes les 6h
  + bouton SYNC NOW, comme les autres sources). Si aucun flux n'est trouvé (cas
  fréquent pour les sites corporate), l'entreprise passe **Accès manuel** avec un
  lien direct vers son site.
- **Stockage** : Netlify Blobs (clé `watchlist`), via 3 nouvelles fonctions :
  `watchlist-get.js` (lecture), `watchlist-add.js` (ajout + détection), `watchlist-remove.js` (suppression).
- **Dans le document HTML autonome** (sans backend) : les entreprises ajoutées sont
  sauvegardées localement dans le navigateur (localStorage), mais la détection RSS
  réelle et la synchronisation nécessitent le projet Netlify déployé — c'est une
  limitation technique du mode "fichier local" (CORS), pas un choix arbitraire.

## Sources : mises à jour et corrections

**Statuts corrigés** (suite à vérification réelle des flux RSS) :
- **BevNET** avait un flux non confirmé → **flux confirmé** trouvé (`bevnet.com/feed/`), passe en actif.
- **Food Ingredients First** et **Perfumer & Flavorist** : aucun flux RSS officiel n'a pu être confirmé malgré recherche approfondie. Plutôt que d'afficher un faux "warning" trompeur, elles sont marquées honnêtement "non supporté" (`unsupported`), comme FoodBev Media, Ingredients Network, Innova Market Insights et Mintel. À re-tester périodiquement, ou à activer manuellement si vous obtenez un accès API/partenariat avec ces éditeurs.

**6 nouvelles sources ajoutées** (flux RSS vérifiés) :
- **Food Business Africa** (`foodbusinessafrica.com/feed`) — 1ère publication food/beverage/milling en Afrique subsaharienne
- **Food Safety Africa** (`foodsafetyafrica.net/feed`) — référence food safety/quality en Afrique
- **Food & Beverage Reporter** (`fbreporter.co.za/feed`) — food/beverage/packaging en Afrique australe
- **How We Made It In Africa** (`howwemadeitinafrica.com/feed`) — business africain, couvre régulièrement le food/bev
- **Food Dive** (`fooddive.com/feeds/news/`) — actualités et innovation food industry (US)
- **vegconomist – Food & Beverage** (`vegconomist.com/category/food-and-beverage/feed/`) — tendances plant-based, inclut une couverture Afrique dédiée

**LinkedIn** : LinkedIn a supprimé son support RSS natif en 2013 (aucune alternative officielle depuis), et scraper LinkedIn viole ses conditions d'utilisation. Il n'est donc **pas possible d'intégrer LinkedIn dans le sync automatique** de façon fiable et légale. À la place, une section **"Liens de référence"** a été ajoutée dans l'onglet Sources : des liens LinkedIn pertinents (Food Business Africa, Innova Market Insights, Mintel, How We Made It In Africa) que vous pouvez consulter manuellement, clairement identifiés comme non synchronisés.

## Modules du dashboard

- **Home** — compteurs et dernières innovations
- **Flavor Trends** — Innovation of the Week, Trend Radar, Latest Innovations (filtres + recherche)
- **Beverage Trends** — module éditorial "Africa Beverage Trends 2026" : 10 tendances structurelles
  (premiumisation accessible, fonctionnel, RTD, occasion-based, ingrédients locaux, formats,
  no/low alcohol, cold coffee, lifestyle, production locale), Consumer Drivers, matrice
  Flavor × Industry Trend interactive, cartes "What this means for Aromatech Africa", scoring stratégique
- **African Flavor Library** — bibliothèque d'ingrédients africains (sorgho, hibiscus, baobab, tamarin, gingembre, kola, cacao, café)
- **Country View** — filtre par marché africain (innovations + tendances pertinentes)
- **Opportunities** — lecture marketing indicative + tableau de scoring stratégique
- **My Shortlist** — sauvegarde personnelle (bouton ★ sur les cards, stockage local navigateur)
- **Sources** — statut des flux RSS surveillés

Le contenu du module Beverage Trends est éditorial (rédigé à partir du brief fourni), pas
une donnée collectée automatiquement — il vit dans `config.js` / `shared/sources.js`
n'est pas concerné, à modifier directement si le contenu doit évoluer.

## Régénérer le document HTML autonome

Le document de consultation autonome (`Innovation_Radar_Aromatech_Afrique.html`) est
généré à partir de ce projet via un script, pour que les deux versions restent alignées :

```bash
python3 build_standalone.py assets/logo/aromatech-logo.png data/seed_demo.json Innovation_Radar_Aromatech_Afrique.html
```

À relancer à chaque fois qu'`index.html`, `style.css`, `app.js` ou `config.js` changent.

## Architecture

```
Sites sources (RSS)
      ↓
netlify/functions/sync-scheduled.js   (cron, toutes les 6h par défaut)
netlify/functions/sync-now.js         (déclenché par le bouton SYNC NOW)
      ↓  fetch() côté serveur → pas de CORS
shared/syncCore.js                    (parsing, normalisation, tags, dédup)
      ↓
Netlify Blobs (stockage persistant, aucune base de données à gérer)
      ↓
netlify/functions/get-innovations.js  (endpoint /api/innovations)
      ↓
index.html + app.js                   (fetch sur SON PROPRE domaine → pas de CORS)
```

## Déploiement sur Netlify

1. Poussez ce dossier sur un dépôt Git (GitHub/GitLab/Bitbucket) **ou**
   glissez-déposez directement le dossier sur https://app.netlify.com/drop
2. Sur Netlify : `New site from Git` → sélectionnez le repo. Les réglages
   `netlify.toml` sont déjà corrects (pas de build command nécessaire, tout
   est statique + functions).
3. **Activez Netlify Blobs** (généralement automatique dès qu'une fonction
   utilise `@netlify/blobs` sur un site connecté à une équipe Netlify — rien
   à configurer manuellement dans la plupart des cas).
4. Une fois déployé, ouvrez `/api/sync-now` en `POST` (ou cliquez sur
   "SYNC NOW" dans le dashboard) pour lancer le premier sync.
5. Le sync automatique tourne ensuite toutes les 6h (modifiable dans
   `netlify/functions/sync-scheduled.js`, variable `schedule`).

## Ajouter / modifier une source

Tout se passe dans **`shared/sources.js`** :

```js
{
  id: "monsite",
  name: "Mon Site",
  url: "https://www.monsite.com",
  feedUrl: "https://www.monsite.com/rss.xml", // null si pas de flux
  type: "rss",        // "rss" | "unverified" | "unsupported"
  category: "Beverage",
  country: "Europe"
}
```

Pensez à refléter le changement dans `config.js` (section `SOURCES`) pour que
la page "Sources" du dashboard affiche la même liste — c'est un choix
délibéré pour garder le fichier client léger et sans dépendance Node.

## Statut réel des 15 sources fournies (voir tableau de faisabilité complet
dans la conversation) :

- **9 sources RSS confirmées ou très probables** : FoodNavigator, BeverageDaily,
  DairyReporter, BakeryAndSnacks, ConfectioneryNews, NutraIngredients,
  Food Business News, Just Food.
- **3 sources à statut "unverified"** : Food Ingredients First, BevNET,
  Perfumer & Flavorist — flux détectés mais non confirmés à 100 %, seront
  testés au premier sync. En cas d'échec, ils apparaîtront avec un badge
  🟠/🔴 dans "Sources" sans jamais bloquer le reste du dashboard.
- **4 sources "unsupported"** : FoodBev Media, Ingredients Network, Innova
  Market Insights, Mintel — pas de flux public exploitable identifié
  (annuaire B2B ou plateforme sur abonnement). Elles sont listées dans
  "Sources" avec un statut d'erreur mais exclues du sync automatique. Une
  API payante ou un accès commercial pourrait être négocié séparément si
  Aromatech souhaite les intégrer.

## Limites connues (MVP Phase 1)

- Pas de scraping HTML implémenté pour les sources sans RSS — volontaire,
  pour rester dans un cadre technique et légal fiable (voir brief point 29).
  Peut être ajouté en Phase 2, source par source, après validation des CGU
  de chaque site.
- Les modules "AI Insights" et "Export CSV/Excel/PDF" (Phase 3 du brief) ne
  sont pas encore implémentés.
- La traduction FR/EN couvre l'interface (menus, boutons, filtres) ; les
  titres/descriptions des innovations restent dans leur langue d'origine,
  comme demandé.

## Structure des fichiers

```
innovation-radar/
├── index.html              Dashboard (shell HTML)
├── style.css                Design system Aromatech (vert #007A45, gris #848587)
├── app.js                   Logique front (fetch, filtres, rendu, i18n)
├── config.js                Config client (filtres, sources affichées, traductions)
├── package.json              Dépendances des fonctions (fast-xml-parser, @netlify/blobs)
├── netlify.toml
├── assets/logo/              Logo Aromatech
├── data/innovations.json     Données de secours affichées avant le 1er sync
├── shared/
│   ├── sources.js            ★ Source de vérité des sources surveillées
│   └── syncCore.js           Fetch RSS + parsing + normalisation + stockage
└── netlify/functions/
    ├── sync-scheduled.js     Sync automatique (cron)
    ├── sync-now.js           Sync manuel (bouton SYNC NOW)
    └── get-innovations.js    Endpoint lu par le dashboard
```
