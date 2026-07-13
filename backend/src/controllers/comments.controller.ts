import { Request, Response } from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma";
import { AuthRequest } from "../middleware/auth";
import { containsProfanity } from "../lib/moderation";

const withUser = { user: { select: { username: true, avatarUrl: true, isAdmin: true } } };
const PROFANITY_MSG = "Ton commentaire contient des propos inappropriés.";

async function isAdmin(userId: string): Promise<boolean> {
  const u = await prisma.user.findUnique({ where: { id: userId }, select: { isAdmin: true } });
  return !!u?.isAdmin;
}

// GET /comments/reported — commentaires signalés (admin uniquement)
export async function getReported(req: AuthRequest, res: Response) {
  if (!(await isAdmin(req.userId!))) return res.status(403).json({ error: "Accès refusé" });

  const reports = await prisma.report.findMany({ select: { commentId: true } });
  const countMap = new Map<string, number>();
  reports.forEach((r) => countMap.set(r.commentId, (countMap.get(r.commentId) ?? 0) + 1));
  const ids = [...countMap.keys()];
  if (ids.length === 0) return res.json([]);

  const comments = await prisma.comment.findMany({ where: { id: { in: ids } }, include: withUser });
  const result = comments
    .map((c) => ({ ...c, reportCount: countMap.get(c.id) ?? 0 }))
    .sort((a, b) => b.reportCount - a.reportCount);
  res.json(result);
}

// GET /comments/:mediaType/:tmdbId?sort=recent|old — public, triable par date
export async function getComments(req: AuthRequest, res: Response) {
  const sort = req.query.sort === "old" ? "asc" : "desc";

  // Utilisateur connecté : on masque les commentaires des comptes qu'il a masqués
  let blockedIds: string[] = [];
  if (req.userId) {
    const blocked = await prisma.blockedUser.findMany({
      where: { userId: req.userId },
      select: { blockedUserId: true },
    });
    blockedIds = blocked.map((b) => b.blockedUserId);
  }

  const comments = await prisma.comment.findMany({
    where: {
      tmdbId: Number(req.params.tmdbId),
      mediaType: req.params.mediaType.toUpperCase() as never,
      ...(blockedIds.length ? { userId: { notIn: blockedIds } } : {}),
    },
    orderBy: { createdAt: sort },
    include: withUser,
  });
  res.json(comments);
}

// POST /comments — protégé, un seul commentaire par utilisateur et par titre
export async function addComment(req: AuthRequest, res: Response) {
  const schema = z.object({
    tmdbId: z.number().int().positive(),
    mediaType: z.enum(["MOVIE", "TV"]),
    content: z.string().trim().min(1, "Commentaire vide").max(2000),
  });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.issues[0].message });

  const { tmdbId, mediaType, content } = parsed.data;
  if (containsProfanity(content)) return res.status(400).json({ error: PROFANITY_MSG });

  const existing = await prisma.comment.findFirst({ where: { userId: req.userId!, tmdbId, mediaType } });
  if (existing) {
    return res.status(409).json({ error: "Tu as déjà commenté ce titre. Modifie ton commentaire." });
  }

  const comment = await prisma.comment.create({
    data: { userId: req.userId!, tmdbId, mediaType, content },
    include: withUser,
  });
  res.status(201).json(comment);
}

// PATCH /comments/:id — modifie son propre commentaire
export async function updateComment(req: AuthRequest, res: Response) {
  const schema = z.object({ content: z.string().trim().min(1, "Commentaire vide").max(2000) });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.issues[0].message });
  if (containsProfanity(parsed.data.content)) return res.status(400).json({ error: PROFANITY_MSG });

  const result = await prisma.comment.updateMany({
    where: { id: req.params.id, userId: req.userId! },
    data: { content: parsed.data.content },
  });
  if (result.count === 0) return res.status(404).json({ error: "Commentaire introuvable" });

  const updated = await prisma.comment.findUnique({ where: { id: req.params.id }, include: withUser });
  res.json(updated);
}

// POST /comments/:id/report — signale un commentaire
export async function reportComment(req: AuthRequest, res: Response) {
  const commentId = req.params.id;
  const schema = z.object({ reason: z.string().trim().max(300).optional() });
  const parsed = schema.safeParse(req.body ?? {});
  const reason = parsed.success ? parsed.data.reason : undefined;

  const comment = await prisma.comment.findUnique({ where: { id: commentId } });
  if (!comment) return res.status(404).json({ error: "Commentaire introuvable" });
  if (comment.userId === req.userId) {
    return res.status(400).json({ error: "Tu ne peux pas signaler ton propre commentaire" });
  }
  try {
    await prisma.report.create({ data: { commentId, userId: req.userId!, reason } });
  } catch (e: any) {
    if (e?.code === "P2002") return res.json({ reported: true }); // déjà signalé
    throw e;
  }
  res.status(201).json({ reported: true });
}

// DELETE /comments/:id/report — retire son propre signalement
export async function unreportComment(req: AuthRequest, res: Response) {
  await prisma.report.deleteMany({ where: { commentId: req.params.id, userId: req.userId! } });
  res.status(204).end();
}

// POST /comments/:id/dismiss — admin : rejette les signalements (garde le commentaire)
export async function dismissReports(req: AuthRequest, res: Response) {
  if (!(await isAdmin(req.userId!))) return res.status(403).json({ error: "Accès refusé" });
  await prisma.report.deleteMany({ where: { commentId: req.params.id } });
  res.status(204).end();
}

// DELETE /comments/:id — son propre commentaire, ou n'importe lequel si admin
export async function deleteComment(req: AuthRequest, res: Response) {
  const admin = await isAdmin(req.userId!);
  const where = admin ? { id: req.params.id } : { id: req.params.id, userId: req.userId! };
  const result = await prisma.comment.deleteMany({ where });
  if (result.count === 0) return res.status(404).json({ error: "Commentaire introuvable" });
  res.status(204).end();
}
