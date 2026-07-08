import { Router } from "express";
import { rate, getRating } from "../controllers/ratings.controller";

const router = Router();
router.put("/", rate);
router.get("/:mediaType/:tmdbId", getRating);
export default router;
