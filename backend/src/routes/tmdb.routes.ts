import { Router } from "express";
import { tmdbFetch } from "../services/tmdb.service";

const router = Router();

// Page d'accueil
const pageOf = (req: any) => ({ page: String(req.query.page ?? "1") });
router.get("/movies/new", async (req, res) => res.json(await tmdbFetch("/movie/now_playing", pageOf(req))));
router.get("/movies/popular", async (req, res) => res.json(await tmdbFetch("/movie/popular", pageOf(req))));
router.get("/tv/new", async (req, res) => res.json(await tmdbFetch("/tv/on_the_air", pageOf(req))));
router.get("/tv/popular", async (req, res) => res.json(await tmdbFetch("/tv/popular", pageOf(req))));

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
      page: String(req.query.page ?? "1"),
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
      page: String(req.query.page ?? "1"),
    })
  )
);

// Top de tous les temps (les plus votés = proxy "les plus vus")
router.get("/top/movie", async (req, res) =>
  res.json(
    await tmdbFetch("/discover/movie", {
      sort_by: "vote_count.desc",
      include_adult: "false",
      "vote_count.gte": "5000",
      page: String(req.query.page ?? "1"),
    })
  )
);
router.get("/top/tv", async (req, res) =>
  res.json(
    await tmdbFetch("/discover/tv", {
      sort_by: "vote_count.desc",
      "vote_count.gte": "2000",
      page: String(req.query.page ?? "1"),
    })
  )
);

// Fiche détail + saisons
router.get("/movie/:id", async (req, res) => res.json(await tmdbFetch(`/movie/${req.params.id}`)));
router.get("/movie/:id/similar", async (req, res) =>
  res.json(await tmdbFetch(`/movie/${req.params.id}/recommendations`))
);
router.get("/tv/:id", async (req, res) => res.json(await tmdbFetch(`/tv/${req.params.id}`)));
router.get("/tv/:id/similar", async (req, res) =>
  res.json(await tmdbFetch(`/tv/${req.params.id}/recommendations`))
);
router.get("/tv/:id/season/:n", async (req, res) =>
  res.json(await tmdbFetch(`/tv/${req.params.id}/season/${req.params.n}`))
);

export default router;
