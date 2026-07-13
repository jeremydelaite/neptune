import { Router } from "express";
import {
  getPublicProfile,
  reportUser,
  blockUser,
  unblockUser,
  getBlocked,
  getReportedUsers,
  getReportedPhotos,
  getSanctionedUsers,
  searchUsers,
  dismissUserReports,
  warnUser,
  suspendUser,
  banUser,
  liftUser,
  reportPhoto,
  adminDeleteAvatar,
} from "../controllers/users.controller";

const router = Router();
router.get("/blocked", getBlocked); // 1 segment — avant /:id/public
router.get("/search", searchUsers);
router.get("/reported", getReportedUsers); // admin
router.get("/sanctioned", getSanctionedUsers); // admin
router.get("/reported-photos", getReportedPhotos); // admin
router.get("/:id/public", getPublicProfile);
router.post("/:id/report", reportUser);
router.post("/:id/report-photo", reportPhoto);
router.delete("/:id/avatar", adminDeleteAvatar); // admin
router.post("/:id/block", blockUser);
router.delete("/:id/block", unblockUser);
router.post("/:id/dismiss-reports", dismissUserReports); // admin
router.post("/:id/warn", warnUser); // admin
router.post("/:id/suspend", suspendUser); // admin
router.post("/:id/ban", banUser); // admin
router.post("/:id/lift", liftUser); // admin
export default router;
