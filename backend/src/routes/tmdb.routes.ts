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
  res.json(
    await tmdbFetch("/search/movie", {
      query: String(req.query.q ?? ""),
      page: String(req.query.page ?? "1"),
    })
  )
);
router.get("/search/tv", async (req, res) =>
  res.json(
    await tmdbFetch("/search/tv", {
      query: String(req.query.q ?? ""),
      page: String(req.query.page ?? "1"),
    })
  )
);

// Découverte par genre (rangées personnalisées)
router.get("/discover/movie", async (req, res) =>
  res.json(
    await tmdbFetch("/discover/movie", {
      with_genres: String(req.query.genre ?? ""),
      sort_by: "popularity.desc",
      "vote_count.gte": "80",
      include_adult: "false",
    })
  )
);
router.get("/discover/tv", async (req, res) =>
  res.json(
    await tmdbFetch("/discover/tv", {
      with_genres: String(req.query.genre ?? ""),
      sort_by: "popularity.desc",
      "vote_count.gte": "80",
      include_adult: "false",
    })
  )
);

// Fiche détail + saisons
router.get("/movie/:id", async (req, res) => res.json(await tmdbFetch(`/movie/${req.params.id}`)));
router.get("/tv/:id", async (req, res) => res.json(await tmdbFetch(`/tv/${req.params.id}`)));
router.get("/tv/:id/season/:n", async (req, res) =>
  res.json(await tmdbFetch(`/tv/${req.params.id}/season/${req.params.n}`))
);

export default router;
