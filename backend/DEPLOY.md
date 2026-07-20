# Déploiement du backend Neptune (Render — gratuit)

Ce guide met le backend en ligne en HTTPS pour que l'app fonctionne hors de ton réseau local.

## Prérequis
- Le repo `neptune-app` poussé sur **GitHub**.
- Ta base **Supabase** (déjà en place) — récupère les deux chaînes de connexion :
  - **Transaction pooler** (port **6543**) → `DATABASE_URL`
  - **Session pooler / direct** (port **5432**) → `DIRECT_URL`
  - Dans Supabase : *Project Settings → Database → Connection string* (onglets « Transaction » et « Session »).

## 1) Créer le service sur Render
1. Va sur https://render.com → **New → Blueprint**.
2. Connecte ton compte GitHub et sélectionne le repo.
3. Render détecte `backend/render.yaml` et propose un service **neptune-api**.

> Alternative sans blueprint : **New → Web Service**, `Root Directory = backend`,
> Build Command = `npm install && npm run build`, Start Command = `npm run start`.

## 2) Renseigner les variables d'environnement
Dans le dashboard du service → **Environment**, ajoute :

| Variable | Valeur |
|---|---|
| `DATABASE_URL` | chaîne Supabase **6543** (transaction) |
| `DIRECT_URL` | chaîne Supabase **5432** (session/direct) |
| `JWT_SECRET` | généré automatiquement (blueprint) ou une longue chaîne aléatoire |
| `TMDB_API_KEY` | ta clé TMDB |
| `PUBLIC_URL` | l'URL du service, ex. `https://neptune-api.onrender.com` |
| `CORS_ORIGINS` | *(optionnel)* origines autorisées |
| `RESEND_API_KEY` / `MAIL_FROM` | *(optionnel)* emails réels |
| `SIGHTENGINE_API_USER` / `SIGHTENGINE_API_SECRET` | *(optionnel)* modération d'avatars |

`.env.example` liste toutes les variables.

## 3) Déploiement
- Render lance `npm install && npm run build` (génère le client Prisma) puis
  `npm run start` (applique les **migrations** via `prisma migrate deploy` et démarre le serveur avec `tsx`).
- Vérifie la santé : ouvre `https://ton-service.onrender.com/health` → `{"status":"ok"}`.

## 4) Pointer l'app vers le backend en ligne
Dans `mobile/.env` :
```
EXPO_PUBLIC_API_URL=https://ton-service.onrender.com
```
Puis relance Metro avec cache vidé : `npx expo start -c`.
(Tu peux garder plusieurs URL séparées par des virgules — l'app choisit celle qui répond.)

## Notes
- **Plan gratuit Render** : le service se met en veille après ~15 min d'inactivité →
  la première requête après une pause peut prendre ~30–50 s (cold start). Normal pour du hobby.
- Les migrations sont versionnées dans `prisma/migrations/` et appliquées automatiquement au démarrage.
- Aucune donnée sensible n'est commitée : `.env` et `src/generated/` sont gitignorés.
