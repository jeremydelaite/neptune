import { Response } from "express";
import { prisma } from "../lib/prisma";
import { AuthRequest } from "../middleware/auth";
import { tmdbFetch } from "../services/tmdb.service";
import { z } from "zod";

async function isAdmin(userId: string): Promise<boolean> {
  const u = await prisma.user.findUnique({ where: { id: userId }, select: { isAdmin: true } });
  return !!u?.isAdmin;
}

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

  const blocked = req.userId
    ? await prisma.blockedUser.findUnique({
        where: { userId_blockedUserId: { userId: req.userId, blockedUserId: id } },
      })
    : null;

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
    isBlocked: !!blocked,
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


const REASONS = ["SPAM", "HARASSMENT", "FAKE", "INAPPROPRIATE", "OTHER"] as const;

// POST /users/:id/report — signaler un compte
export async function reportUser(req: AuthRequest, res: Response) {
  const id = req.params.id;
  if (id === req.userId) return res.status(400).json({ error: "Tu ne peux pas te signaler toi-même" });

  const schema = z.object({ reason: z.enum(REASONS) });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "Motif invalide" });

  const target = await prisma.user.findUnique({ where: { id }, select: { id: true } });
  if (!target) return res.status(404).json({ error: "Profil introuvable" });

  await prisma.userReport.upsert({
    where: { reportedUserId_reporterId: { reportedUserId: id, reporterId: req.userId! } },
    update: { reason: parsed.data.reason },
    create: { reportedUserId: id, reporterId: req.userId!, reason: parsed.data.reason },
  });
  res.json({ ok: true });
}

// POST /users/:id/block — masquer un utilisateur
export async function blockUser(req: AuthRequest, res: Response) {
  const id = req.params.id;
  if (id === req.userId) return res.status(400).json({ error: "Tu ne peux pas te masquer toi-même" });

  const target = await prisma.user.findUnique({ where: { id }, select: { id: true } });
  if (!target) return res.status(404).json({ error: "Profil introuvable" });

  await prisma.blockedUser.upsert({
    where: { userId_blockedUserId: { userId: req.userId!, blockedUserId: id } },
    update: {},
    create: { userId: req.userId!, blockedUserId: id },
  });
  res.json({ ok: true });
}

// DELETE /users/:id/block — ne plus masquer
export async function unblockUser(req: AuthRequest, res: Response) {
  await prisma.blockedUser.deleteMany({
    where: { userId: req.userId!, blockedUserId: req.params.id },
  });
  res.json({ ok: true });
}

// GET /users/blocked — liste des comptes masqués
export async function getBlocked(req: AuthRequest, res: Response) {
  const rows = await prisma.blockedUser.findMany({
    where: { userId: req.userId! },
    orderBy: { createdAt: "desc" },
    select: {
      blockedUser: { select: { id: true, username: true, avatarUrl: true } },
    },
  });
  res.json(rows.map((r) => r.blockedUser));
}


// GET /users/reported — admin : comptes signalés (regroupés)
export async function getReportedUsers(req: AuthRequest, res: Response) {
  if (!(await isAdmin(req.userId!))) return res.status(403).json({ error: "Accès refusé" });

  const reports = await prisma.userReport.findMany({
    orderBy: { createdAt: "desc" },
    select: {
      reason: true,
      createdAt: true,
      reportedUser: { select: { id: true, username: true, avatarUrl: true } },
    },
  });

  // Regroupe par utilisateur signalé
  const map = new Map<
    string,
    { id: string; username: string; avatarUrl: string | null; count: number; reasons: Record<string, number> }
  >();
  for (const r of reports) {
    const u = r.reportedUser;
    const cur = map.get(u.id) ?? { id: u.id, username: u.username, avatarUrl: u.avatarUrl, count: 0, reasons: {} };
    cur.count += 1;
    cur.reasons[r.reason] = (cur.reasons[r.reason] ?? 0) + 1;
    map.set(u.id, cur);
  }

  res.json([...map.values()].sort((a, b) => b.count - a.count));
}

// POST /users/:id/dismiss-reports — admin : ignore tous les signalements d'un compte
export async function dismissUserReports(req: AuthRequest, res: Response) {
  if (!(await isAdmin(req.userId!))) return res.status(403).json({ error: "Accès refusé" });
  await prisma.userReport.deleteMany({ where: { reportedUserId: req.params.id } });
  res.json({ ok: true });
}
