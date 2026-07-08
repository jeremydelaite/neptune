import { Response } from "express";
import { prisma } from "../lib/prisma";
import { AuthRequest } from "../middleware/auth";

// GET /stats — récap complet pour la page Compte
export async function getStats(req: AuthRequest, res: Response) {
  const userId = req.userId!;

  const [moviesSeen, episodes, ratings, epTime] = await Promise.all([
    prisma.trackedItem.count({ where: { userId, mediaType: "MOVIE", status: "COMPLETED" } }),
    prisma.watchedEpisode.count({ where: { userId } }),
    prisma.rating.groupBy({ by: ["score"], where: { userId }, _count: true }),
    prisma.watchedEpisode.aggregate({ where: { userId }, _sum: { runtimeMin: true } }),
  ]);

  // Activité par mois (12 derniers mois) — épisodes cochés
  const activity = await prisma.$queryRaw<{ month: string; count: bigint }[]>`
    SELECT to_char(watched_at, 'YYYY-MM') AS month, COUNT(*) AS count
    FROM watched_episodes
    WHERE user_id = ${userId} AND watched_at > now() - interval '12 months'
    GROUP BY month ORDER BY month
  `;

  res.json({
    moviesSeen,
    episodesSeen: episodes,
    // temps séries en minutes (les runtimes films sont récupérés via TMDB côté front,
    // ou ajoutés plus tard dans tracked_items si besoin)
    seriesTimeMin: epTime._sum.runtimeMin ?? 0,
    ratingsBreakdown: [1, 2, 3, 4, 5].map((s) => ({
      score: s,
      count: ratings.find((r) => r.score === s)?._count ?? 0,
    })),
    monthlyActivity: activity.map((a) => ({ month: a.month, count: Number(a.count) })),
    // Genres préférés : calculés côté front en croisant la bibliothèque avec TMDB
  });
}
