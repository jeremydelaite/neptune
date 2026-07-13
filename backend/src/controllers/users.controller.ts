import { Response } from "express";
import { prisma } from "../lib/prisma";
import { AuthRequest } from "../middleware/auth";
import { tmdbFetch } from "../services/tmdb.service";
import { z } from "zod";
import { friendState, friendsCount, notify } from "../lib/social";

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
    select: { id: true, username: true, avatarUrl: true, isAdmin: true, createdAt: true, suspendedUntil: true, bannedAt: true },
  });
  if (!user) return res.status(404).json({ error: "Profil introuvable" });

  const blocked = req.userId
    ? await prisma.blockedUser.findUnique({
        where: { userId_blockedUserId: { userId: req.userId, blockedUserId: id } },
      })
    : null;
  const photoReported = req.userId
    ? await prisma.avatarReport.findUnique({
        where: { reportedUserId_reporterId: { reportedUserId: id, reporterId: req.userId } },
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

  const fState = req.userId ? await friendState(req.userId, id) : "none";
  const fCount = await friendsCount(id);

  res.json({
    id: user.id,
    username: user.username,
    avatarUrl: user.avatarUrl,
    isAdmin: user.isAdmin,
    createdAt: user.createdAt,
    isSelf: user.id === req.userId,
    friendStatus: fState,
    friendsCount: fCount,
    isBlocked: !!blocked,
    photoReportedByMe: !!photoReported,
    suspendedUntil: user.suspendedUntil ? user.suspendedUntil.toISOString() : null,
    bannedAt: user.bannedAt ? user.bannedAt.toISOString() : null,
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
      reportedUser: { select: { id: true, username: true, avatarUrl: true, suspendedUntil: true, bannedAt: true } },
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


// Vérifie que l'admin peut agir sur cette cible (existe, ni soi-même, ni un autre admin)
async function guardTarget(req: AuthRequest, res: Response): Promise<{ id: string } | null> {
  if (!(await isAdmin(req.userId!))) {
    res.status(403).json({ error: "Accès refusé" });
    return null;
  }
  const id = req.params.id;
  if (id === req.userId) {
    res.status(400).json({ error: "Action impossible sur ton propre compte" });
    return null;
  }
  const target = await prisma.user.findUnique({ where: { id }, select: { id: true, isAdmin: true } });
  if (!target) {
    res.status(404).json({ error: "Profil introuvable" });
    return null;
  }
  if (target.isAdmin) {
    res.status(400).json({ error: "Action impossible sur un administrateur" });
    return null;
  }
  return { id };
}

// POST /users/:id/warn — avertir (message affiché à la prochaine ouverture)
export async function warnUser(req: AuthRequest, res: Response) {
  const t = await guardTarget(req, res);
  if (!t) return;
  const schema = z.object({ message: z.string().trim().min(1, "Message requis").max(500) });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.issues[0].message });
  await prisma.user.update({ where: { id: t.id }, data: { warning: parsed.data.message } });
  await notify(t.id, "WARNING", parsed.data.message);
  res.json({ ok: true });
}

// POST /users/:id/suspend — suspension temporaire (durée en jours)
export async function suspendUser(req: AuthRequest, res: Response) {
  const t = await guardTarget(req, res);
  if (!t) return;
  const schema = z.object({ days: z.number().int().min(1).max(3650) });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "Durée invalide" });
  const until = new Date(Date.now() + parsed.data.days * 24 * 60 * 60 * 1000);
  await prisma.user.update({ where: { id: t.id }, data: { suspendedUntil: until, bannedAt: null } });
  const du = until.toLocaleDateString("fr-FR", { day: "2-digit", month: "long", year: "numeric" });
  await notify(t.id, "SUSPENSION", `Ton compte a été suspendu jusqu'au ${du}.`);
  res.json({ ok: true, suspendedUntil: until.toISOString() });
}

// POST /users/:id/ban — bannissement définitif
export async function banUser(req: AuthRequest, res: Response) {
  const t = await guardTarget(req, res);
  if (!t) return;
  await prisma.user.update({ where: { id: t.id }, data: { bannedAt: new Date(), suspendedUntil: null } });
  await notify(t.id, "BAN", "Ton compte a été banni définitivement.");
  res.json({ ok: true });
}

// POST /users/:id/lift — réactiver (annule suspension et bannissement)
export async function liftUser(req: AuthRequest, res: Response) {
  const t = await guardTarget(req, res);
  if (!t) return;
  await prisma.user.update({ where: { id: t.id }, data: { bannedAt: null, suspendedUntil: null } });
  res.json({ ok: true });
}


// GET /users/sanctioned — admin : comptes bannis ou suspendus (avec dates)
export async function getSanctionedUsers(req: AuthRequest, res: Response) {
  if (!(await isAdmin(req.userId!))) return res.status(403).json({ error: "Accès refusé" });
  const now = new Date();
  const users = await prisma.user.findMany({
    where: { OR: [{ bannedAt: { not: null } }, { suspendedUntil: { gt: now } }] },
    select: { id: true, username: true, avatarUrl: true, bannedAt: true, suspendedUntil: true },
    orderBy: [{ bannedAt: "desc" }, { suspendedUntil: "desc" }],
  });
  res.json(
    users.map((u) => ({
      id: u.id,
      username: u.username,
      avatarUrl: u.avatarUrl,
      bannedAt: u.bannedAt ? u.bannedAt.toISOString() : null,
      suspendedUntil: u.suspendedUntil ? u.suspendedUntil.toISOString() : null,
    }))
  );
}


// POST /users/:id/report-photo — signaler la photo de profil d'un utilisateur
export async function reportPhoto(req: AuthRequest, res: Response) {
  const id = req.params.id;
  if (id === req.userId) return res.status(400).json({ error: "Action impossible sur ta propre photo" });

  const target = await prisma.user.findUnique({ where: { id }, select: { avatarUrl: true } });
  if (!target) return res.status(404).json({ error: "Profil introuvable" });
  if (!target.avatarUrl) return res.status(400).json({ error: "Ce compte n'a pas de photo" });

  await prisma.avatarReport.upsert({
    where: { reportedUserId_reporterId: { reportedUserId: id, reporterId: req.userId! } },
    update: {},
    create: { reportedUserId: id, reporterId: req.userId! },
  });
  res.json({ ok: true });
}

// GET /users/reported-photos — admin : photos signalées (regroupées)
export async function getReportedPhotos(req: AuthRequest, res: Response) {
  if (!(await isAdmin(req.userId!))) return res.status(403).json({ error: "Accès refusé" });

  const reports = await prisma.avatarReport.findMany({
    select: { reportedUser: { select: { id: true, username: true, avatarUrl: true } } },
  });

  const map = new Map<string, { id: string; username: string; avatarUrl: string | null; count: number }>();
  for (const r of reports) {
    const u = r.reportedUser;
    if (!u.avatarUrl) continue; // photo déjà supprimée
    const cur = map.get(u.id) ?? { id: u.id, username: u.username, avatarUrl: u.avatarUrl, count: 0 };
    cur.count += 1;
    map.set(u.id, cur);
  }
  res.json([...map.values()].sort((a, b) => b.count - a.count));
}

// DELETE /users/:id/avatar — admin : supprime la photo d'un utilisateur (+ purge les signalements)
export async function adminDeleteAvatar(req: AuthRequest, res: Response) {
  if (!(await isAdmin(req.userId!))) return res.status(403).json({ error: "Accès refusé" });
  await prisma.user.update({ where: { id: req.params.id }, data: { avatarUrl: null } });
  await prisma.avatarReport.deleteMany({ where: { reportedUserId: req.params.id } });
  res.json({ ok: true });
}


// GET /users/search?q= — recherche d'utilisateurs par pseudo
export async function searchUsers(req: AuthRequest, res: Response) {
  const me = req.userId!;
  const q = String(req.query.q ?? "").trim();
  if (q.length < 2) return res.json([]);

  // Masquage mutuel : exclut les comptes que j'ai masqués ET ceux qui m'ont masqué
  const blocks = await prisma.blockedUser.findMany({
    where: { OR: [{ userId: me }, { blockedUserId: me }] },
    select: { userId: true, blockedUserId: true },
  });
  const hidden = new Set<string>();
  for (const b of blocks) hidden.add(b.userId === me ? b.blockedUserId : b.userId);

  const users = await prisma.user.findMany({
    where: {
      username: { contains: q, mode: "insensitive" },
      id: { not: me, notIn: [...hidden] },
    },
    select: { id: true, username: true, avatarUrl: true },
    take: 20,
  });

  const withState = await Promise.all(
    users.map(async (u) => ({ ...u, friendStatus: await friendState(me, u.id) }))
  );
  res.json(withState);
}


// POST /users/:id/dismiss-photo-reports — admin : ignore les signalements de photo (garde la photo)
export async function dismissPhotoReports(req: AuthRequest, res: Response) {
  if (!(await isAdmin(req.userId!))) return res.status(403).json({ error: "Accès refusé" });
  await prisma.avatarReport.deleteMany({ where: { reportedUserId: req.params.id } });
  res.json({ ok: true });
}


// GET /users/my-reports — mes signalements (comptes + photos)
export async function getMyReports(req: AuthRequest, res: Response) {
  const me = req.userId!;
  const [accounts, photos] = await Promise.all([
    prisma.userReport.findMany({
      where: { reporterId: me },
      orderBy: { createdAt: "desc" },
      select: { reason: true, createdAt: true, reportedUser: { select: { id: true, username: true, avatarUrl: true } } },
    }),
    prisma.avatarReport.findMany({
      where: { reporterId: me },
      orderBy: { createdAt: "desc" },
      select: { createdAt: true, reportedUser: { select: { id: true, username: true, avatarUrl: true } } },
    }),
  ]);
  const items = [
    ...accounts.map((a) => ({
      type: "account" as const,
      reason: a.reason,
      createdAt: a.createdAt.toISOString(),
      user: a.reportedUser,
    })),
    ...photos.map((p) => ({
      type: "photo" as const,
      reason: null,
      createdAt: p.createdAt.toISOString(),
      user: p.reportedUser,
    })),
  ].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  res.json(items);
}

// DELETE /users/:id/report — retirer mon signalement de compte
export async function withdrawReport(req: AuthRequest, res: Response) {
  await prisma.userReport.deleteMany({ where: { reportedUserId: req.params.id, reporterId: req.userId! } });
  res.json({ ok: true });
}

// DELETE /users/:id/report-photo — retirer mon signalement de photo
export async function withdrawPhotoReport(req: AuthRequest, res: Response) {
  await prisma.avatarReport.deleteMany({ where: { reportedUserId: req.params.id, reporterId: req.userId! } });
  res.json({ ok: true });
}
