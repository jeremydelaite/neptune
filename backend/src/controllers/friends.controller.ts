import { Response } from "express";
import { prisma } from "../lib/prisma";
import { AuthRequest } from "../middleware/auth";
import { friendState, notify } from "../lib/social";

// GET /friends — mes amis (acceptés)
export async function getFriends(req: AuthRequest, res: Response) {
  const me = req.userId!;
  const rows = await prisma.friendship.findMany({
    where: { status: "ACCEPTED", OR: [{ requesterId: me }, { addresseeId: me }] },
    include: {
      requester: { select: { id: true, username: true, avatarUrl: true } },
      addressee: { select: { id: true, username: true, avatarUrl: true } },
    },
    orderBy: { createdAt: "desc" },
  });
  res.json(rows.map((f) => (f.requesterId === me ? f.addressee : f.requester)));
}

// POST /friends/request/:id — envoyer une demande (ou accepter si demande inverse existe)
export async function sendRequest(req: AuthRequest, res: Response) {
  const me = req.userId!;
  const other = req.params.id;
  if (me === other) return res.status(400).json({ error: "Impossible de s'ajouter soi-même" });

  const target = await prisma.user.findUnique({ where: { id: other }, select: { id: true, username: true } });
  if (!target) return res.status(404).json({ error: "Utilisateur introuvable" });

  const existing = await prisma.friendship.findFirst({
    where: {
      OR: [
        { requesterId: me, addresseeId: other },
        { requesterId: other, addresseeId: me },
      ],
    },
  });

  if (existing) {
    if (existing.status === "ACCEPTED") return res.json({ state: "friends" });
    // demande inverse déjà présente → on accepte directement
    if (existing.requesterId === other) {
      await prisma.friendship.update({ where: { id: existing.id }, data: { status: "ACCEPTED" } });
      const meUser = await prisma.user.findUnique({ where: { id: me }, select: { username: true } });
      await notify(other, "FRIEND_ACCEPTED", `${meUser?.username ?? "Quelqu'un"} a accepté ta demande d'ami.`, me);
      return res.json({ state: "friends" });
    }
    return res.json({ state: "pending_out" }); // déjà envoyée
  }

  await prisma.friendship.create({ data: { requesterId: me, addresseeId: other, status: "PENDING" } });
  const meUser = await prisma.user.findUnique({ where: { id: me }, select: { username: true } });
  await notify(other, "FRIEND_REQUEST", `${meUser?.username ?? "Quelqu'un"} t'a envoyé une demande d'ami.`, me);
  res.json({ state: "pending_out" });
}

// POST /friends/accept/:id — accepter la demande de :id (le demandeur)
export async function acceptRequest(req: AuthRequest, res: Response) {
  const me = req.userId!;
  const requester = req.params.id;
  const f = await prisma.friendship.findFirst({
    where: { requesterId: requester, addresseeId: me, status: "PENDING" },
  });
  if (!f) return res.status(404).json({ error: "Demande introuvable" });
  await prisma.friendship.update({ where: { id: f.id }, data: { status: "ACCEPTED" } });
  const meUser = await prisma.user.findUnique({ where: { id: me }, select: { username: true } });
  await notify(requester, "FRIEND_ACCEPTED", `${meUser?.username ?? "Quelqu'un"} a accepté ta demande d'ami.`, me);
  res.json({ state: "friends" });
}

// POST /friends/decline/:id — refuser la demande de :id
export async function declineRequest(req: AuthRequest, res: Response) {
  const me = req.userId!;
  await prisma.friendship.deleteMany({
    where: { requesterId: req.params.id, addresseeId: me, status: "PENDING" },
  });
  res.json({ state: "none" });
}

// DELETE /friends/:id — retirer un ami OU annuler une demande envoyée
export async function removeFriend(req: AuthRequest, res: Response) {
  const me = req.userId!;
  const other = req.params.id;
  await prisma.friendship.deleteMany({
    where: {
      OR: [
        { requesterId: me, addresseeId: other },
        { requesterId: other, addresseeId: me },
      ],
    },
  });
  res.json({ state: "none" });
}
