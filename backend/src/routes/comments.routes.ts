import { Router } from "express";
import { requireAuth, optionalAuth } from "../middleware/auth";
import {
  getComments,
  getReported,
  addComment,
  updateComment,
  reportComment,
  unreportComment,
  dismissReports,
  deleteComment,
} from "../controllers/comments.controller";

const router = Router();
router.get("/reported", requireAuth, getReported); // admin (1 segment, avant /:mediaType/:tmdbId)
router.get("/:mediaType/:tmdbId", optionalAuth, getComments); // public (filtre les comptes masqués si connecté)
router.post("/", requireAuth, addComment);
router.patch("/:id", requireAuth, updateComment);
router.post("/:id/report", requireAuth, reportComment);
router.delete("/:id/report", requireAuth, unreportComment);
router.post("/:id/dismiss", requireAuth, dismissReports);
router.delete("/:id", requireAuth, deleteComment);
export default router;
