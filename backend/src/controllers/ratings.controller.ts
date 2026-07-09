import { Response } from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma";
import { AuthRequest } from "../middleware/auth";

const rateSchema = z.object({
  tmdbId: z.number().int().positive(),
  mediaType: z.enum(["MOVIE", "TV"]),
  score: z.number().int().min(1).max(5), // note sur 5, entier — pas de demi-point
});

// PUT /ratings — pose ou met à jour la note
export async function rate(req: AuthRequest, res: Response) {
  const parsed = rateSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.issues[0].message });
  const { tmdbId, mediaType, score } = parsed.data;

  const rating = await prisma.rating.upsert({
    where: { userId_tmdbId_mediaType: { userId: req.userId!, tmdbId, mediaType } },
    create: { userId: req.userId!, tmdbId, mediaType, score },
    update: { score },
  });
  res.json(rating);
}

// GET /ratings/:mediaType/:tmdbId — ma note + moyenne du titre
export async function getRating(req: AuthRequest, res: Response) {
  const tmdbId = Number(req.params.tmdbId);
  const mediaType = req.params.mediaType.toUpperCase() as "MOVIE" | "TV";

  const [mine, avg] = await Promise.all([
    prisma.rating.findUnique({
      where: { userId_tmdbId_mediaType: { userId: req.userId!, tmdbId, mediaType } },
    }),
    prisma.rating.aggregate({
      where: { tmdbId, mediaType },
      _avg: { score: true },
      _count: true,
    }),
  ]);
  res.json({ myScore: mine?.score ?? null, average: avg._avg.score, count: avg._count });
}

// DELETE /ratings/:mediaType/:tmdbId — retire sa note
export async function deleteRating(req: AuthRequest, res: Response) {
  await prisma.rating.deleteMany({
    where: {
      userId: req.userId!,
      tmdbId: Number(req.params.tmdbId),
      mediaType: req.params.mediaType.toUpperCase() as never,
    },
  });
  res.status(204).end();
}
