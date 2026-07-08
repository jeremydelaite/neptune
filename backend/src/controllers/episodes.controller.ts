import { Response } from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma";
import { AuthRequest } from "../middleware/auth";

const toggleSchema = z.object({
  tmdbShowId: z.number().int().positive(),
  seasonNumber: z.number().int().min(0),
  episodeNumber: z.number().int().min(1),
  runtimeMin: z.number().int().positive().optional(), // durée TMDB pour les stats
});

// GET /episodes/:tmdbShowId — épisodes vus d'une série
export async function getWatched(req: AuthRequest, res: Response) {
  const eps = await prisma.watchedEpisode.findMany({
    where: { userId: req.userId!, tmdbShowId: Number(req.params.tmdbShowId) },
    orderBy: [{ seasonNumber: "asc" }, { episodeNumber: "asc" }],
  });
  res.json(eps);
}

// POST /episodes/toggle — coche/décoche un épisode
export async function toggleEpisode(req: AuthRequest, res: Response) {
  const parsed = toggleSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.issues[0].message });
  const { tmdbShowId, seasonNumber, episodeNumber, runtimeMin } = parsed.data;

  const where = {
    userId_tmdbShowId_seasonNumber_episodeNumber: {
      userId: req.userId!, tmdbShowId, seasonNumber, episodeNumber,
    },
  };
  const existing = await prisma.watchedEpisode.findUnique({ where });
  if (existing) {
    await prisma.watchedEpisode.delete({ where });
    return res.json({ watched: false });
  }
  await prisma.watchedEpisode.create({
    data: { userId: req.userId!, tmdbShowId, seasonNumber, episodeNumber, runtimeMin },
  });
  res.json({ watched: true });
}

// POST /episodes/season — marque une saison entière comme vue
export async function markSeason(req: AuthRequest, res: Response) {
  const schema = z.object({
    tmdbShowId: z.number().int().positive(),
    seasonNumber: z.number().int().min(0),
    episodes: z.array(z.object({ episodeNumber: z.number().int(), runtimeMin: z.number().int().optional() })),
  });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.issues[0].message });
  const { tmdbShowId, seasonNumber, episodes } = parsed.data;

  await prisma.watchedEpisode.createMany({
    data: episodes.map((e) => ({
      userId: req.userId!, tmdbShowId, seasonNumber,
      episodeNumber: e.episodeNumber, runtimeMin: e.runtimeMin,
    })),
    skipDuplicates: true,
  });
  res.json({ marked: episodes.length });
}
