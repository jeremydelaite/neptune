import { Router } from "express";
import { requireAuth } from "../middleware/auth";
import { getComments, addComment, deleteComment } from "../controllers/comments.controller";

const router = Router();
router.get("/:mediaType/:tmdbId", getComments); // public
router.post("/", requireAuth, addComment);
router.delete("/:id", requireAuth, deleteComment);
export default router;
