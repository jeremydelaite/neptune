import { Router } from "express";
import {
  getPublicProfile,
  reportUser,
  blockUser,
  unblockUser,
  getBlocked,
} from "../controllers/users.controller";

const router = Router();
router.get("/blocked", getBlocked); // 1 segment — avant /:id/public
router.get("/:id/public", getPublicProfile);
router.post("/:id/report", reportUser);
router.post("/:id/block", blockUser);
router.delete("/:id/block", unblockUser);
export default router;
