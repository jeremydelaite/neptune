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
  try {
    const eps = await prisma.watchedEpisode.findMany({
      where: { userId: req.userId!, tmdbShowId: Number(req.params.tmdbShowId) },
      orderBy: [{ seasonNumber: "asc" }, { episodeNumber: "asc" }],
    });
    res.json(eps);
  } catch (e) {
    console.error("getWatched:", e);
    res.status(500).json({ error: "Erreur lors de la récupération des épisodes" });
  }
}

// GET /episodes/shows — ids des séries pour lesquelles l'utilisateur a des épisodes vus
export async function getShows(req: AuthRequest, res: Response) {
  try {
    const rows = await prisma.watchedEpisode.findMany({
      where: { userId: req.userId! },
      distinct: ["tmdbShowId"],
      select: { tmdbShowId: true },
    });
    res.json(rows.map((r) => r.tmdbShowId));
  } catch (e) {
    console.error("getShows:", e);
    res.status(500).json({ error: "Erreur lors de la récupération des séries" });
  }
}

// POST /episodes/toggle — coche/décoche un épisode (insensible aux courses)
export async function toggleEpisode(req: AuthRequest, res: Response) {
  const parsed = toggleSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.issues[0].message });
  const { tmdbShowId, seasonNumber, episodeNumber, runtimeMin } = parsed.data;

  const where = {
    userId_tmdbShowId_seasonNumber_episodeNumber: {
      userId: req.userId!, tmdbShowId, seasonNumber, episodeNumber,
    },
  };

  try {
    const existing = await prisma.watchedEpisode.findUnique({ where });
    if (existing) {
      await prisma.watchedEpisode.delete({ where }).catch(() => null); // déjà supprimé = ok
      return res.json({ watched: false });
    }
    await prisma.watchedEpisode.create({
      data: { userId: req.userId!, tmdbShowId, seasonNumber, episodeNumber, runtimeMin },
    });
    return res.json({ watched: true });
  } catch (e: any) {
    // Course : un autre appel a créé la ligne entre-temps → considéré comme vu
    if (e?.code === "P2002") return res.json({ watched: true });
    console.error("toggleEpisode:", e);
    return res.status(500).json({ error: "Erreur lors de la mise à jour de l'épisode" });
  }
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

  try {
    await prisma.watchedEpisode.createMany({
      data: episodes.map((e) => ({
        userId: req.userId!, tmdbShowId, seasonNumber,
        episodeNumber: e.episodeNumber, runtimeMin: e.runtimeMin,
      })),
      skipDuplicates: true,
    });
    res.json({ marked: episodes.length });
  } catch (e) {
    console.error("markSeason:", e);
    res.status(500).json({ error: "Erreur lors du marquage de la saison" });
  }
}
