import { Request, Response } from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma";
import { AuthRequest } from "../middleware/auth";

const withUser = { user: { select: { username: true, avatarUrl: true } } };

// GET /comments/:mediaType/:tmdbId?sort=recent|old — public, triable par date
export async function getComments(req: Request, res: Response) {
  const sort = req.query.sort === "old" ? "asc" : "desc";
  const comments = await prisma.comment.findMany({
    where: {
      tmdbId: Number(req.params.tmdbId),
      mediaType: req.params.mediaType.toUpperCase() as never,
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
  const existing = await prisma.comment.findFirst({
    where: { userId: req.userId!, tmdbId, mediaType },
  });
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

  const result = await prisma.comment.updateMany({
    where: { id: req.params.id, userId: req.userId! },
    data: { content: parsed.data.content },
  });
  if (result.count === 0) return res.status(404).json({ error: "Commentaire introuvable" });

  const updated = await prisma.comment.findUnique({
    where: { id: req.params.id },
    include: withUser,
  });
  res.json(updated);
}

// DELETE /comments/:id — uniquement son propre commentaire
export async function deleteComment(req: AuthRequest, res: Response) {
  const result = await prisma.comment.deleteMany({
    where: { id: req.params.id, userId: req.userId! },
  });
  if (result.count === 0) return res.status(404).json({ error: "Commentaire introuvable" });
  res.status(204).end();
}
