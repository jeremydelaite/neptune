import { Router } from "express";
import { getStats, getActivity } from "../controllers/stats.controller";

const router = Router();
router.get("/", getStats);
router.get("/activity", getActivity);
export default router;
