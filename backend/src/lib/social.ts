import { prisma } from "./prisma";

export type FriendState = "none" | "friends" | "pending_out" | "pending_in";

// État de la relation entre "me" et "other"
export async function friendState(meId: string, otherId: string): Promise<FriendState> {
  if (meId === otherId) return "none";
  const f = await prisma.friendship.findFirst({
    where: {
      OR: [
        { requesterId: meId, addresseeId: otherId },
        { requesterId: otherId, addresseeId: meId },
      ],
    },
  });
  if (!f) return "none";
  if (f.status === "ACCEPTED") return "friends";
  return f.requesterId === meId ? "pending_out" : "pending_in";
}

// Nombre d'amis (acceptés) d'un utilisateur
export async function friendsCount(userId: string): Promise<number> {
  return prisma.friendship.count({
    where: {
      status: "ACCEPTED",
      OR: [{ requesterId: userId }, { addresseeId: userId }],
    },
  });
}

// Crée une notification
export async function notify(
  userId: string,
  type: "FRIEND_REQUEST" | "FRIEND_ACCEPTED" | "WARNING" | "SUSPENSION" | "BAN",
  message: string,
  actorId?: string
) {
  await prisma.notification.create({ data: { userId, type, message, actorId: actorId ?? null } });
}
