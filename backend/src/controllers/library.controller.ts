import { Response } from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma";
import { AuthRequest } from "../middleware/auth";

const upsertSchema = z.object({
  tmdbId: z.number().int().positive(),
  mediaType: z.enum(["MOVIE", "TV"]),
  status: z.enum(["TO_WATCH", "WATCHING", "COMPLETED", "DROPPED", "ARCHIVED"]),
});

// GET /library?status=WATCHING (filtre optionnel)
export async function getLibrary(req: AuthRequest, res: Response) {
  const status = req.query.status as string | undefined;
  const items = await prisma.trackedItem.findMany({
    where: { userId: req.userId!, ...(status ? { status: status as never } : {}) },
    orderBy: { addedAt: "desc" },
  });
  res.json(items);
}

// POST /library — ajoute ou met à jour le statut d'un titre
export async function upsertItem(req: AuthRequest, res: Response) {
  const parsed = upsertSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.issues[0].message });
  const { tmdbId, mediaType, status } = parsed.data;

  const item = await prisma.trackedItem.upsert({
    where: { userId_tmdbId_mediaType: { userId: req.userId!, tmdbId, mediaType } },
    create: { userId: req.userId!, tmdbId, mediaType, status },
    update: { status },
  });
  res.json(item);
}

// DELETE /library/:mediaType/:tmdbId — retire de la bibliothèque
export async function removeItem(req: AuthRequest, res: Response) {
  await prisma.trackedItem.delete({
    where: {
      userId_tmdbId_mediaType: {
        userId: req.userId!,
        tmdbId: Number(req.params.tmdbId),
        mediaType: req.params.mediaType.toUpperCase() as never,
      },
    },
  }).catch(() => null);
  res.status(204).end();
}
