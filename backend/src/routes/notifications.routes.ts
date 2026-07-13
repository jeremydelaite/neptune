import { Router } from "express";
import {
  getNotifications,
  getUnreadCount,
  markAllRead,
  deleteNotification,
  clearNotifications,
} from "../controllers/notifications.controller";

const router = Router();
router.get("/", getNotifications);
router.get("/unread-count", getUnreadCount);
router.post("/read-all", markAllRead);
router.delete("/:id", deleteNotification);
router.delete("/", clearNotifications);
export default router;
