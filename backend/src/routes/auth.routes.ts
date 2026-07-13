import { Router } from "express";
import { register, login, me, updateProfile, updatePassword, dismissWarning, updateAvatar, verifyEmail, resendVerification } from "../controllers/auth.controller";
import { requireAuth } from "../middleware/auth";

const router = Router();
router.post("/register", register);
router.post("/login", login);
router.get("/verify", verifyEmail);
router.post("/resend-verification", resendVerification);
router.get("/me", requireAuth, me);
router.patch("/profile", requireAuth, updateProfile);
router.patch("/password", requireAuth, updatePassword);
router.post("/dismiss-warning", requireAuth, dismissWarning);
router.patch("/avatar", requireAuth, updateAvatar);
export default router;
