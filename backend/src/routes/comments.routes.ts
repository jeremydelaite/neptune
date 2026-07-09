import { Router } from "express";
import { requireAuth } from "../middleware/auth";
import {
  getComments,
  getReported,
  addComment,
  updateComment,
  reportComment,
  deleteComment,
} from "../controllers/comments.controller";

const router = Router();
router.get("/reported", requireAuth, getReported); // admin (1 segment, avant /:mediaType/:tmdbId)
router.get("/:mediaType/:tmdbId", getComments); // public
router.post("/", requireAuth, addComment);
router.patch("/:id", requireAuth, updateComment);
router.post("/:id/report", requireAuth, reportComment);
router.delete("/:id", requireAuth, deleteComment);
export default router;
