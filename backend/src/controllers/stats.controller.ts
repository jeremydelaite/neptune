import { Response } from "express";
import { prisma } from "../lib/prisma";
import { AuthRequest } from "../middleware/auth";
import { tmdbFetch } from "../services/tmdb.service";

// GET /stats — récap complet pour la page Compte
export async function getStats(req: AuthRequest, res: Response) {
  const userId = req.userId!;

  const [moviesSeen, episodes, ratings, epTime] = await Promise.all([
    prisma.trackedItem.count({ where: { userId, mediaType: "MOVIE", status: "COMPLETED" } }),
    prisma.watchedEpisode.count({ where: { userId } }),
    prisma.rating.groupBy({ by: ["score"], where: { userId }, _count: true }),
    prisma.watchedEpisode.aggregate({ where: { userId }, _sum: { runtimeMin: true } }),
  ]);

  const activity = await prisma.$queryRaw<{ month: string; count: bigint }[]>`
    SELECT to_char(watched_at, 'YYYY-MM') AS month, COUNT(*) AS count
    FROM watched_episodes
    WHERE user_id = ${userId} AND watched_at > now() - interval '12 months'
    GROUP BY month ORDER BY month
  `;

  res.json({
    moviesSeen,
    episodesSeen: episodes,
    seriesTimeMin: epTime._sum.runtimeMin ?? 0,
    ratingsBreakdown: [1, 2, 3, 4, 5].map((s) => ({
      score: s,
      count: ratings.find((r) => r.score === s)?._count ?? 0,
    })),
    monthlyActivity: activity.map((a) => ({ month: a.month, count: Number(a.count) })),
  });
}

// Récupère le titre TMDB d'un média (avec cache du service TMDB)
async function tmdbTitle(mediaType: "MOVIE" | "TV", tmdbId: number): Promise<string> {
  try {
    const path = mediaType === "MOVIE" ? `/movie/${tmdbId}` : `/tv/${tmdbId}`;
    const data = (await tmdbFetch(path)) as { title?: string; name?: string };
    return data.title ?? data.name ?? `#${tmdbId}`;
  } catch {
    return `#${tmdbId}`;
  }
}

// GET /stats/activity?offset&limit — dernières notes et commentaires (paginé)
export async function getActivity(req: AuthRequest, res: Response) {
  const userId = req.userId!;
  const offset = Math.max(0, Number(req.query.offset ?? 0));
  const limit = Math.max(1, Number(req.query.limit ?? 5));
  const need = offset + limit + 1; // +1 pour savoir s'il reste des éléments

  const [ratings, comments] = await Promise.all([
    prisma.rating.findMany({ where: { userId }, orderBy: { updatedAt: "desc" }, take: need }),
    prisma.comment.findMany({ where: { userId }, orderBy: { createdAt: "desc" }, take: need }),
  ]);

  const merged = [
    ...ratings.map((r) => ({
      kind: "rating" as const,
      tmdbId: r.tmdbId,
      mediaType: r.mediaType,
      score: r.score,
      date: r.updatedAt,
    })),
    ...comments.map((c) => ({
      kind: "comment" as const,
      tmdbId: c.tmdbId,
      mediaType: c.mediaType,
      content: c.content,
      date: c.createdAt,
    })),
  ].sort((a, b) => b.date.getTime() - a.date.getTime());

  const hasMore = merged.length > offset + limit;
  const page = merged.slice(offset, offset + limit);

  const enriched = await Promise.all(
    page.map(async (it) => ({
      ...it,
      title: await tmdbTitle(it.mediaType, it.tmdbId),
      date: it.date.toISOString(),
    }))
  );

  res.json({ items: enriched, hasMore });
}
