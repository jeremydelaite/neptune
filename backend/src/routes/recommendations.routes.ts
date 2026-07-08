import { Router } from "express";
import { getRecommendations } from "../controllers/recommendations.controller";

const router = Router();
router.get("/", getRecommendations);
export default router;
