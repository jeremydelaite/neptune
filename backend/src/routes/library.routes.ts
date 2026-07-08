import { Router } from "express";
import { getLibrary, upsertItem, removeItem } from "../controllers/library.controller";

const router = Router();
router.get("/", getLibrary);
router.post("/", upsertItem);
router.delete("/:mediaType/:tmdbId", removeItem);
export default router;
