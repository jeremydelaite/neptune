import { Response } from "express";
import { prisma } from "../lib/prisma";
import { AuthRequest } from "../middleware/auth";

// GET /notifications — mes notifications (enrichies pour les demandes d'ami)
export async function getNotifications(req: AuthRequest, res: Response) {
  const me = req.userId!;
  const notifs = await prisma.notification.findMany({
    where: { userId: me },
    orderBy: { createdAt: "desc" },
    take: 100,
  });

  // Enrichit l'acteur (demandeur d'ami) + indique si la demande est encore en attente
  const actorIds = [...new Set(notifs.map((n) => n.actorId).filter(Boolean) as string[])];
  const actors = actorIds.length
    ? await prisma.user.findMany({
        where: { id: { in: actorIds } },
        select: { id: true, username: true, avatarUrl: true },
      })
    : [];
  const actorMap = new Map(actors.map((a) => [a.id, a]));

  // Demandes d'ami encore en attente (pour afficher Accepter/Refuser)
  const pending = await prisma.friendship.findMany({
    where: { addresseeId: me, status: "PENDING" },
    select: { requesterId: true },
  });
  const pendingFrom = new Set(pending.map((p) => p.requesterId));

  res.json(
    notifs.map((n) => ({
      id: n.id,
      type: n.type,
      message: n.message,
      read: n.read,
      createdAt: n.createdAt.toISOString(),
      actor: n.actorId ? actorMap.get(n.actorId) ?? null : null,
      // seulement pertinent pour FRIEND_REQUEST
      actionable: n.type === "FRIEND_REQUEST" && !!n.actorId && pendingFrom.has(n.actorId),
    }))
  );
}

// GET /notifications/unread-count — pour la pastille de la cloche
export async function getUnreadCount(req: AuthRequest, res: Response) {
  const count = await prisma.notification.count({ where: { userId: req.userId!, read: false } });
  res.json({ count });
}

// POST /notifications/read-all — marque tout comme lu
export async function markAllRead(req: AuthRequest, res: Response) {
  await prisma.notification.updateMany({ where: { userId: req.userId!, read: false }, data: { read: true } });
  res.json({ ok: true });
}

// DELETE /notifications/:id — supprime une notification
export async function deleteNotification(req: AuthRequest, res: Response) {
  await prisma.notification.deleteMany({ where: { id: req.params.id, userId: req.userId! } });
  res.json({ ok: true });
}

// DELETE /notifications — tout supprimer
export async function clearNotifications(req: AuthRequest, res: Response) {
  await prisma.notification.deleteMany({ where: { userId: req.userId! } });
  res.json({ ok: true });
}
