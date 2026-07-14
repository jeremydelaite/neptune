import { Response } from "express";
import { prisma } from "../lib/prisma";
import { AuthRequest } from "../middleware/auth";
import { tmdbFetch } from "../services/tmdb.service";
import { friendsCount, notify } from "../lib/social";

// GET /stats — récap complet pour la page Compte
export async function getStats(req: AuthRequest, res: Response) {
  const userId = req.userId!;

  const [moviesSeen, episodes, ratings, epTime, friends, commentsCount, seriesSeen] = await Promise.all([
    prisma.trackedItem.count({ where: { userId, mediaType: "MOVIE", status: "COMPLETED" } }),
    prisma.watchedEpisode.count({ where: { userId } }),
    prisma.rating.groupBy({ by: ["score"], where: { userId }, _count: true }),
    prisma.watchedEpisode.aggregate({ where: { userId }, _sum: { runtimeMin: true } }),
    friendsCount(userId),
    prisma.comment.count({ where: { userId } }),
    prisma.trackedItem.count({ where: { userId, mediaType: "TV", status: { in: ["WATCHING", "COMPLETED", "ARCHIVED"] } } }),
  ]);

  const activity = await prisma.$queryRaw<{ month: string; count: bigint }[]>`
    SELECT to_char(watched_at, 'YYYY-MM') AS month, COUNT(*) AS count
    FROM watched_episodes
    WHERE user_id = ${userId} AND watched_at > now() - interval '12 months'
    GROUP BY month ORDER BY month
  `;

  checkBadges(userId).catch(() => {}); // détecte les nouveaux succès en arrière-plan

  res.json({
    moviesSeen,
    seriesSeen,
    episodesSeen: episodes,
    seriesTimeMin: epTime._sum.runtimeMin ?? 0,
    friendsCount: friends,
    commentsCount,
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


interface BadgeOut {
  key: string;
  title: string;
  description: string;
  icon: string;
  target: number;
  value: number;
  unlocked: boolean;
}

// Calcule la liste des succès (débloqués + progression) pour un utilisateur
async function computeBadgeList(userId: string): Promise<BadgeOut[]> {
  const [moviesSeen, seriesSeen, completedSeries, episodesSeen, epTime, ratingsCount, commentsCount, friends, watchlist] =
    await Promise.all([
      prisma.trackedItem.count({ where: { userId, mediaType: "MOVIE", status: "COMPLETED" } }),
      prisma.trackedItem.count({ where: { userId, mediaType: "TV", status: { in: ["WATCHING", "COMPLETED", "ARCHIVED"] } } }),
      prisma.trackedItem.count({ where: { userId, mediaType: "TV", status: "COMPLETED" } }),
      prisma.watchedEpisode.count({ where: { userId } }),
      prisma.watchedEpisode.aggregate({ where: { userId }, _sum: { runtimeMin: true } }),
      prisma.rating.count({ where: { userId } }),
      prisma.comment.count({ where: { userId } }),
      friendsCount(userId),
      prisma.trackedItem.count({ where: { userId, status: "TO_WATCH" } }),
    ]);

  const hours = Math.floor((epTime._sum.runtimeMin ?? 0) / 60);

  const defs: { key: string; title: string; description: string; icon: string; value: number; target: number }[] = [
    { key: "first-step", title: "Premiers pas", description: "Bienvenue sur Neptune", icon: "Rocket", value: 1, target: 1 },
    { key: "movie-10", title: "Cinéphile", description: "10 films vus", icon: "Film", value: moviesSeen, target: 10 },
    { key: "movie-50", title: "Grand écran", description: "50 films vus", icon: "Film", value: moviesSeen, target: 50 },
    { key: "movie-100", title: "Cent films", description: "100 films vus", icon: "Film", value: moviesSeen, target: 100 },
    { key: "movie-250", title: "Cinémane", description: "250 films vus", icon: "Film", value: moviesSeen, target: 250 },
    { key: "movie-500", title: "Cinéphile absolu", description: "500 films vus", icon: "Film", value: moviesSeen, target: 500 },
    { key: "series-5", title: "Sérievore", description: "5 séries suivies", icon: "Tv", value: seriesSeen, target: 5 },
    { key: "series-20", title: "Binge master", description: "20 séries suivies", icon: "Tv", value: seriesSeen, target: 20 },
    { key: "series-50", title: "Téléphage", description: "50 séries suivies", icon: "Tv", value: seriesSeen, target: 50 },
    { key: "series-100", title: "Encyclopédie", description: "100 séries suivies", icon: "Tv", value: seriesSeen, target: 100 },
    { key: "completed-10", title: "Finisseur", description: "10 séries terminées", icon: "CheckCircle2", value: completedSeries, target: 10 },
    { key: "completed-25", title: "Complétionniste", description: "25 séries terminées", icon: "CheckCircle2", value: completedSeries, target: 25 },
    { key: "completed-50", title: "Perfectionniste", description: "50 séries terminées", icon: "CheckCircle2", value: completedSeries, target: 50 },
    { key: "episodes-100", title: "Marathonien", description: "100 épisodes vus", icon: "ListChecks", value: episodesSeen, target: 100 },
    { key: "episodes-500", title: "Ultra-marathon", description: "500 épisodes vus", icon: "ListChecks", value: episodesSeen, target: 500 },
    { key: "episodes-1000", title: "Insatiable", description: "1000 épisodes vus", icon: "ListChecks", value: episodesSeen, target: 1000 },
    { key: "episodes-2500", title: "Légende", description: "2500 épisodes vus", icon: "ListChecks", value: episodesSeen, target: 2500 },
    { key: "hours-50", title: "Chronophage", description: "50 h de séries", icon: "Clock", value: hours, target: 50 },
    { key: "hours-200", title: "Sans sommeil", description: "200 h de séries", icon: "Clock", value: hours, target: 200 },
    { key: "hours-500", title: "Hors du temps", description: "500 h de séries", icon: "Clock", value: hours, target: 500 },
    { key: "hours-1000", title: "Voyageur temporel", description: "1000 h de séries", icon: "Clock", value: hours, target: 1000 },
    { key: "ratings-10", title: "Critique", description: "10 notes données", icon: "Star", value: ratingsCount, target: 10 },
    { key: "ratings-50", title: "Juré", description: "50 notes données", icon: "Star", value: ratingsCount, target: 50 },
    { key: "ratings-200", title: "Jury du festival", description: "200 notes données", icon: "Star", value: ratingsCount, target: 200 },
    { key: "comments-20", title: "Bavard", description: "20 commentaires publiés", icon: "MessageSquare", value: commentsCount, target: 20 },
    { key: "comments-50", title: "Chroniqueur", description: "50 commentaires publiés", icon: "MessageSquare", value: commentsCount, target: 50 },
    { key: "friends-10", title: "Sociable", description: "10 amis", icon: "Users", value: friends, target: 10 },
    { key: "friends-20", title: "Populaire", description: "20 amis", icon: "Users", value: friends, target: 20 },
    { key: "watchlist-10", title: "Curieux", description: "10 titres à voir", icon: "Bookmark", value: watchlist, target: 10 },
    { key: "watchlist-100", title: "Collectionneur", description: "100 titres à voir", icon: "Bookmark", value: watchlist, target: 100 },
  ];

  return defs.map((d) => ({
    key: d.key,
    title: d.title,
    description: d.description,
    icon: d.icon,
    target: d.target,
    value: Math.min(d.value, d.target),
    unlocked: d.value >= d.target,
  }));
}

// Détecte les succès nouvellement débloqués et crée une notification pour chacun.
// Au tout premier passage, on "ensemence" sans notifier (évite un flot pour les comptes existants).
export async function checkBadges(userId: string): Promise<BadgeOut[]> {
  const badges = await computeBadgeList(userId);
  const unlockedKeys = badges.filter((b) => b.unlocked).map((b) => b.key);
  if (unlockedKeys.length === 0) return badges;

  const known = await prisma.unlockedBadge.findMany({ where: { userId }, select: { badgeKey: true } });
  const knownSet = new Set(known.map((k) => k.badgeKey));
  const isFirst = known.length === 0;
  const newly = unlockedKeys.filter((k) => !knownSet.has(k));
  if (newly.length === 0) return badges;

  await prisma.unlockedBadge.createMany({
    data: newly.map((badgeKey) => ({ userId, badgeKey })),
    skipDuplicates: true,
  });

  if (!isFirst) {
    for (const key of newly) {
      const b = badges.find((x) => x.key === key);
      if (b) await notify(userId, "BADGE", `Succès débloqué : ${b.title} 🏆`);
    }
  }
  return badges;
}

// GET /stats/badges — succès débloqués + progression (+ notifie les nouveaux)
export async function getBadges(req: AuthRequest, res: Response) {
  const userId = req.userId!;
  const badges = await checkBadges(userId);
  res.json({ unlocked: badges.filter((b) => b.unlocked).length, total: badges.length, badges });
}
