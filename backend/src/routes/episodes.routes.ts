import { Router } from "express";
import { getWatched, getShows, toggleEpisode, markSeason } from "../controllers/episodes.controller";

const router = Router();
router.get("/shows", getShows); // AVANT /:tmdbShowId sinon capturé comme un id
router.get("/:tmdbShowId", getWatched);
router.post("/toggle", toggleEpisode);
router.post("/season", markSeason);
export default router;
