import { Router } from "express";
import { getPublicProfile } from "../controllers/users.controller";

const router = Router();
router.get("/:id/public", getPublicProfile);
export default router;
