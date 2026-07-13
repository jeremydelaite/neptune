import { Router } from "express";
import {
  getFriends,
  sendRequest,
  acceptRequest,
  declineRequest,
  removeFriend,
} from "../controllers/friends.controller";

const router = Router();
router.get("/", getFriends);
router.post("/request/:id", sendRequest);
router.post("/accept/:id", acceptRequest);
router.post("/decline/:id", declineRequest);
router.delete("/:id", removeFriend);
export default router;
