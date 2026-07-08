import { Request, Response } from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma";
import { AuthRequest } from "../middleware/auth";

// GET /comments/:mediaType/:tmdbId?sort=recent|old — public, triable par date
export async function getComments(req: Request, res: Response) {
  const sort = req.query.sort === "old" ? "asc" : "desc";
  const comments = await prisma.comment.findMany({
    where: {
      tmdbId: Number(req.params.tmdbId),
      mediaType: req.params.mediaType.toUpperCase() as never,
    },
    orderBy: { createdAt: sort },
    include: { user: { select: { username: true, avatarUrl: true } } },
  });
  res.json(comments);
}

// POST /comments — protégé
export async function addComment(req: AuthRequest, res: Response) {
  const schema = z.object({
    tmdbId: z.number().int().positive(),
    mediaType: z.enum(["MOVIE", "TV"]),
    content: z.string().trim().min(1, "Commentaire vide").max(2000),
  });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.issues[0].message });

  const comment = await prisma.comment.create({
    data: { userId: req.userId!, ...parsed.data },
    include: { user: { select: { username: true, avatarUrl: true } } },
  });
  res.status(201).json(comment);
}

// DELETE /comments/:id — uniquement son propre commentaire
export async function deleteComment(req: AuthRequest, res: Response) {
  const result = await prisma.comment.deleteMany({
    where: { id: req.params.id, userId: req.userId! },
  });
  if (result.count === 0) return res.status(404).json({ error: "Commentaire introuvable" });
  res.status(204).end();
}
