import { Router } from "express";
import { getStats, getActivity, getTopGenres, getBadges } from "../controllers/stats.controller";

const router = Router();
router.get("/", getStats);
router.get("/activity", getActivity);
router.get("/top-genres", getTopGenres);
router.get("/badges", getBadges);
export default router;
