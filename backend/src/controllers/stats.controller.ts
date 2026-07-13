import { Response } from "express";
import { prisma } from "../lib/prisma";
import { AuthRequest } from "../middleware/auth";
import { tmdbFetch } from "../services/tmdb.service";
import { friendsCount } from "../lib/social";

// GET /stats — récap complet pour la page Compte
export async function getStats(req: AuthRequest, res: Response) {
  const userId = req.userId!;

  const [moviesSeen, episodes, ratings, epTime, friends] = await Promise.all([
    prisma.trackedItem.count({ where: { userId, mediaType: "MOVIE", status: "COMPLETED" } }),
    prisma.watchedEpisode.count({ where: { userId } }),
    prisma.rating.groupBy({ by: ["score"], where: { userId }, _count: true }),
    prisma.watchedEpisode.aggregate({ where: { userId }, _sum: { runtimeMin: true } }),
    friendsCount(userId),
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
    friendsCount: friends,
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

// GET /stats/top-genres — genres les plus regardés (bibliothèque + notes), par type
export async function getTopGenres(req: AuthRequest, res: Response) {
  const userId = req.userId!;
  const [tracked, rated] = await Promise.all([
    prisma.trackedItem.findMany({ where: { userId }, select: { tmdbId: true, mediaType: true } }),
    prisma.rating.findMany({ where: { userId }, select: { tmdbId: true, mediaType: true, score: true } }),
  ]);

  // Union par (type, id) avec un poids (présence = 1, note ajoutée en bonus)
  const items = new Map<string, { tmdbId: number; mediaType: "MOVIE" | "TV"; weight: number }>();
  for (const t of tracked) {
    const k = `${t.mediaType}-${t.tmdbId}`;
    items.set(k, { tmdbId: t.tmdbId, mediaType: t.mediaType, weight: (items.get(k)?.weight ?? 0) + 1 });
  }
  for (const r of rated) {
    const k = `${r.mediaType}-${r.tmdbId}`;
    const w = (items.get(k)?.weight ?? 0) + r.score;
    items.set(k, { tmdbId: r.tmdbId, mediaType: r.mediaType, weight: w });
  }

  const movie = new Map<number, { name: string; count: number }>();
  const tv = new Map<number, { name: string; count: number }>();

  await Promise.all(
    [...items.values()].slice(0, 120).map(async (it) => {
      try {
        const path = it.mediaType === "MOVIE" ? `/movie/${it.tmdbId}` : `/tv/${it.tmdbId}`;
        const data = (await tmdbFetch(path)) as { genres?: { id: number; name: string }[] };
        const target = it.mediaType === "MOVIE" ? movie : tv;
        for (const g of data.genres ?? []) {
          const cur = target.get(g.id) ?? { name: g.name, count: 0 };
          cur.count += it.weight;
          target.set(g.id, cur);
        }
      } catch {
        /* ignore */
      }
    })
  );

  const top = (m: Map<number, { name: string; count: number }>) =>
    [...m.entries()]
      .map(([id, v]) => ({ id, name: v.name, count: v.count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 3);

  res.json({ movie: top(movie), tv: top(tv) });
}
