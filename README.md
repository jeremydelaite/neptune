# 🪐 Neptune — Suivi de films & séries

Application de suivi façon TV Time : bibliothèque personnelle, notes sur 5,
commentaires, épisodes en cours et statistiques. Catalogue fourni par **TMDB**.

- **Backend** : Node.js / Express / TypeScript / Prisma / PostgreSQL
- **Mobile** : React Native / Expo (Expo Router) → web + iOS + Android

---

## 1. Backend (`backend/`)

### Prérequis
- Node 20+
- Une base PostgreSQL gratuite : [Supabase](https://supabase.com) ou [Neon](https://neon.tech)
- Une clé API TMDB gratuite : https://www.themoviedb.org/settings/api

### Installation
```bash
cd backend
npm install
cp .env.example .env      # puis remplir DATABASE_URL, JWT_SECRET, TMDB_API_KEY
npx prisma migrate dev --name init
npm run dev               # → http://localhost:3000
```

### Vérifier que ça tourne
```bash
curl http://localhost:3000/health
curl http://localhost:3000/tmdb/movies/popular
```

### Endpoints
| Méthode | Route | Description |
|---|---|---|
| POST | `/auth/register` · `/auth/login` | Compte + JWT (30 j) |
| GET | `/tmdb/movies/new` · `/tmdb/movies/popular` | Accueil films |
| GET | `/tmdb/tv/new` · `/tmdb/tv/popular` | Accueil séries |
| GET | `/tmdb/search/movie?q=` · `/tmdb/search/tv?q=` | Recherche par onglet |
| GET | `/tmdb/movie/:id` · `/tmdb/tv/:id` · `/tmdb/tv/:id/season/:n` | Fiches + saisons |
| GET/POST/DELETE | `/library` | Bibliothèque (statuts) |
| GET/POST | `/episodes/...` | Épisodes vus, toggle, saison entière |
| PUT/GET | `/ratings` | Note 1-5 (entier) + moyenne |
| GET/POST/DELETE | `/comments` | Commentaires triables par date |
| GET | `/stats` | Récap page Compte |
| GET | `/recommendations` | Recos basées sur les notes ≥ 4 |

---

## 2. Mobile (`mobile/`)

### Création du projet Expo
Le dossier `mobile/` contient les **sources à copier** dans un projet Expo fraîchement créé :

```bash
npx create-expo-app@latest neptune-app --template blank-typescript
cd neptune-app

# Dépendances
npx expo install expo-router expo-linear-gradient expo-blur expo-font \
  react-native-safe-area-context react-native-screens \
  @react-native-async-storage/async-storage
npm install lucide-react-native react-native-svg
npm install @expo-google-fonts/plus-jakarta-sans @expo-google-fonts/inter
```

Puis :
1. Copier les dossiers `app/` et `src/` de ce starter dans le projet
2. Dans `package.json`, remplacer `"main"` par `"expo-router/entry"`
3. Ajouter dans `app.json` → `"scheme": "neptune"` et `"plugins": ["expo-router"]`
4. Créer `.env` avec `EXPO_PUBLIC_API_URL=http://<IP-locale>:3000`
   (l'IP de ton PC sur le réseau, pas `localhost`, pour tester sur téléphone)
5. Mettre `logo.png` dans `assets/` (icône + splash screen dans `app.json`)

### Lancer
```bash
npx expo start        # QR code → app Expo Go sur ton téléphone
npx expo start --web  # version web
```

---

## 3. Arborescence & découpage

```
backend/src/
  index.ts              # bootstrap Express + montage des routes
  lib/prisma.ts         # client Prisma unique
  middleware/auth.ts    # vérification JWT
  services/tmdb.service.ts  # proxy TMDB + cache 1h
  routes/               # 1 fichier par domaine (déclaration des routes)
  controllers/          # 1 fichier par domaine (logique métier + validation zod)

mobile/
  app/                  # Expo Router — 1 fichier = 1 écran
    (auth)/             # login, register
    (tabs)/             # accueil, recherche, en cours, compte
    media/[type]/[id]   # fiche détail film/série
  src/
    theme/              # charte graphique en constantes (colors, fonts, radius)
    components/ui/      # génériques : Card, StarRating, ProgressBar
    components/media/   # métier : PosterCard, MediaRow, StatusButtons
    services/api.ts     # client HTTP + helper images TMDB
    hooks/useAuth.tsx   # contexte d'authentification
    types/              # types partagés
```

**Règle de découpage** : un écran ne contient que la mise en page et les appels
de données ; tout élément visuel réutilisé deux fois devient un composant dans
`components/`. La charte ne vit QUE dans `src/theme/` — jamais de couleur en dur
dans un écran.

---

## 4. Roadmap

- [x] Schéma BDD + API complète (auth, library, épisodes, notes, commentaires, stats, recos)
- [x] Base mobile : thème, navigation, composants, auth
- [ ] Écrans Recherche / En cours / Compte / Fiche détail (squelettes avec TODO fournis)
- [ ] Formulaires login / register
- [ ] Déploiement : API → Render/Railway, BDD → Supabase/Neon
- [ ] Stores : EAS Build (Google Play 25 $ une fois, Apple 99 $/an)
