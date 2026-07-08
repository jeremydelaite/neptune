import { Response } from "express";
import { prisma } from "../lib/prisma";
import { AuthRequest } from "../middleware/auth";
import { tmdbFetch } from "../services/tmdb.service";

// GET /recommendations — agrège les recos TMDB des titres notés 4-5,
// puis filtre ce qui est déjà dans la bibliothèque.
export async function getRecommendations(req: AuthRequest, res: Response) {
  const userId = req.userId!;

  const [liked, tracked] = await Promise.all([
    prisma.rating.findMany({
      where: { userId, score: { gte: 4 } },
      orderBy: { updatedAt: "desc" },
      take: 8, // limite le nombre d'appels TMDB
    }),
    prisma.trackedItem.findMany({ where: { userId }, select: { tmdbId: true, mediaType: true } }),
  ]);

  const alreadyTracked = new Set(tracked.map((t) => `${t.mediaType}-${t.tmdbId}`));
  const seen = new Set<string>();
  const results: unknown[] = [];

  for (const item of liked) {
    const path = item.mediaType === "MOVIE" ? `/movie/${item.tmdbId}` : `/tv/${item.tmdbId}`;
    const data = (await tmdbFetch(`${path}/recommendations`)) as { results?: any[] };

    for (const reco of data.results ?? []) {
      const type = item.mediaType; // TMDB reco garde le même type
      const key = `${type}-${reco.id}`;
      if (alreadyTracked.has(key) || seen.has(key)) continue;
      seen.add(key);
      results.push({ ...reco, mediaType: type, because: item.tmdbId });
      if (results.length >= 20) break;
    }
    if (results.length >= 20) break;
  }

  res.json({ results });
}
