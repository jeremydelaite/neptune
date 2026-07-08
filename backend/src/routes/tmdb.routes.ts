import { Router } from "express";
import { tmdbFetch } from "../services/tmdb.service";

const router = Router();

// Page d'accueil
router.get("/movies/new", async (_req, res) => res.json(await tmdbFetch("/movie/now_playing")));
router.get("/movies/popular", async (_req, res) => res.json(await tmdbFetch("/movie/popular")));
router.get("/tv/new", async (_req, res) => res.json(await tmdbFetch("/tv/on_the_air")));
router.get("/tv/popular", async (_req, res) => res.json(await tmdbFetch("/tv/popular")));

// Recherche (onglets Films / Séries séparés)
router.get("/search/movie", async (req, res) =>
  res.json(await tmdbFetch("/search/movie", { query: String(req.query.q ?? "") }))
);
router.get("/search/tv", async (req, res) =>
  res.json(await tmdbFetch("/search/tv", { query: String(req.query.q ?? "") }))
);

// Fiche détail + saisons
router.get("/movie/:id", async (req, res) => res.json(await tmdbFetch(`/movie/${req.params.id}`)));
router.get("/tv/:id", async (req, res) => res.json(await tmdbFetch(`/tv/${req.params.id}`)));
router.get("/tv/:id/season/:n", async (req, res) =>
  res.json(await tmdbFetch(`/tv/${req.params.id}/season/${req.params.n}`))
);

export default router;
