import { Router } from "express";
import { register, login, me, updateProfile, updatePassword, dismissWarning } from "../controllers/auth.controller";
import { requireAuth } from "../middleware/auth";

const router = Router();
router.post("/register", register);
router.post("/login", login);
router.get("/me", requireAuth, me);
router.patch("/profile", requireAuth, updateProfile);
router.patch("/password", requireAuth, updatePassword);
router.post("/dismiss-warning", requireAuth, dismissWarning);
export default router;
