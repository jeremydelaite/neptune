import { Router } from "express";
import { rate, getRating, deleteRating } from "../controllers/ratings.controller";

const router = Router();
router.put("/", rate);
router.get("/:mediaType/:tmdbId", getRating);
router.delete("/:mediaType/:tmdbId", deleteRating);
export default router;
