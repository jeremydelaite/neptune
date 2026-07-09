import { Router } from "express";
import { requireAuth } from "../middleware/auth";
import { getComments, addComment, updateComment, deleteComment } from "../controllers/comments.controller";

const router = Router();
router.get("/:mediaType/:tmdbId", getComments); // public
router.post("/", requireAuth, addComment);
router.patch("/:id", requireAuth, updateComment);
router.delete("/:id", requireAuth, deleteComment);
export default router;
