import { Response } from "express";
import { prisma } from "../lib/prisma";
import { AuthRequest } from "../middleware/auth";
import { tmdbFetch } from "../services/tmdb.service";

async function tmdbTitle(mediaType: "MOVIE" | "TV", tmdbId: number): Promise<string> {
  try {
    const path = mediaType === "MOVIE" ? `/movie/${tmdbId}` : `/tv/${tmdbId}`;
    const data = (await tmdbFetch(path)) as { title?: string; name?: string };
    return data.title ?? data.name ?? `#${tmdbId}`;
  } catch {
    return `#${tmdbId}`;
  }
}

// GET /users/:id/public — profil public (stats + activité publique)
export async function getPublicProfile(req: AuthRequest, res: Response) {
  const id = req.params.id;

  const user = await prisma.user.findUnique({
    where: { id },
    select: { id: true, username: true, avatarUrl: true, isAdmin: true, createdAt: true },
  });
  if (!user) return res.status(404).json({ error: "Profil introuvable" });

  const [moviesSeen, episodesSeen, epTime, ratings, commentsCount] = await Promise.all([
    prisma.trackedItem.count({ where: { userId: id, mediaType: "MOVIE", status: "COMPLETED" } }),
    prisma.watchedEpisode.count({ where: { userId: id } }),
    prisma.watchedEpisode.aggregate({ where: { userId: id }, _sum: { runtimeMin: true } }),
    prisma.rating.groupBy({ by: ["score"], where: { userId: id }, _count: true }),
    prisma.comment.count({ where: { userId: id } }),
  ]);

  // Activité publique récente : dernières notes + commentaires (max 5)
  const [recentRatings, recentComments] = await Promise.all([
    prisma.rating.findMany({ where: { userId: id }, orderBy: { updatedAt: "desc" }, take: 6 }),
    prisma.comment.findMany({ where: { userId: id }, orderBy: { createdAt: "desc" }, take: 6 }),
  ]);

  const merged = [
    ...recentRatings.map((r) => ({
      kind: "rating" as const,
      tmdbId: r.tmdbId,
      mediaType: r.mediaType,
      score: r.score,
      date: r.updatedAt,
    })),
    ...recentComments.map((c) => ({
      kind: "comment" as const,
      tmdbId: c.tmdbId,
      mediaType: c.mediaType,
      content: c.content,
      date: c.createdAt,
    })),
  ]
    .sort((a, b) => b.date.getTime() - a.date.getTime())
    .slice(0, 5);

  const activity = await Promise.all(
    merged.map(async (it) => ({
      ...it,
      title: await tmdbTitle(it.mediaType, it.tmdbId),
      date: it.date.toISOString(),
    }))
  );

  res.json({
    id: user.id,
    username: user.username,
    avatarUrl: user.avatarUrl,
    isAdmin: user.isAdmin,
    createdAt: user.createdAt,
    isSelf: user.id === req.userId,
    stats: {
      moviesSeen,
      episodesSeen,
      seriesTimeMin: epTime._sum.runtimeMin ?? 0,
      commentsCount,
      ratingsBreakdown: [1, 2, 3, 4, 5].map((s) => ({
        score: s,
        count: ratings.find((r) => r.score === s)?._count ?? 0,
      })),
    },
    activity,
  });
}
