import { Router } from "express";
import { getWatched, toggleEpisode, markSeason } from "../controllers/episodes.controller";

const router = Router();
router.get("/:tmdbShowId", getWatched);
router.post("/toggle", toggleEpisode);
router.post("/season", markSeason);
export default router;
