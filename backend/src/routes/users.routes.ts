import { Router } from "express";
import {
  getPublicProfile,
  reportUser,
  blockUser,
  unblockUser,
  getBlocked,
  getReportedUsers,
  getSanctionedUsers,
  dismissUserReports,
  warnUser,
  suspendUser,
  banUser,
  liftUser,
} from "../controllers/users.controller";

const router = Router();
router.get("/blocked", getBlocked); // 1 segment — avant /:id/public
router.get("/reported", getReportedUsers); // admin
router.get("/sanctioned", getSanctionedUsers); // admin
router.get("/:id/public", getPublicProfile);
router.post("/:id/report", reportUser);
router.post("/:id/block", blockUser);
router.delete("/:id/block", unblockUser);
router.post("/:id/dismiss-reports", dismissUserReports); // admin
router.post("/:id/warn", warnUser); // admin
router.post("/:id/suspend", suspendUser); // admin
router.post("/:id/ban", banUser); // admin
router.post("/:id/lift", liftUser); // admin
export default router;
