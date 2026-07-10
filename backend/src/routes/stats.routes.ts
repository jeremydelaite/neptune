import { Router } from "express";
import { getStats, getActivity, getTopGenres } from "../controllers/stats.controller";

const router = Router();
router.get("/", getStats);
router.get("/activity", getActivity);
router.get("/top-genres", getTopGenres);
export default router;
