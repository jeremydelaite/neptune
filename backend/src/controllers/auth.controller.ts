import { Request, Response } from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { z } from "zod";
import { prisma } from "../lib/prisma";
import { AuthRequest } from "../middleware/auth";

const registerSchema = z.object({
  email: z.string().email("Email invalide"),
  username: z.string().min(3, "3 caractères minimum").max(30),
  password: z.string().min(8, "8 caractères minimum"),
});

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string(),
});

function signToken(userId: string) {
  return jwt.sign({ userId }, process.env.JWT_SECRET!, { expiresIn: "30d" });
}

export async function register(req: Request, res: Response) {
  const parsed = registerSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.issues[0].message });

  const { email, username, password } = parsed.data;
  const exists = await prisma.user.findFirst({ where: { OR: [{ email }, { username }] } });
  if (exists) return res.status(409).json({ error: "Email ou pseudo déjà utilisé" });

  const user = await prisma.user.create({
    data: { email, username, passwordHash: await bcrypt.hash(password, 10) },
  });
  res.status(201).json({
    token: signToken(user.id),
    user: { id: user.id, username, email, isAdmin: user.isAdmin },
  });
}

export async function login(req: Request, res: Response) {
  const parsed = loginSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "Identifiants invalides" });

  const user = await prisma.user.findUnique({ where: { email: parsed.data.email } });
  if (!user || !(await bcrypt.compare(parsed.data.password, user.passwordHash))) {
    return res.status(401).json({ error: "Email ou mot de passe incorrect" });
  }
  res.json({
    token: signToken(user.id),
    user: { id: user.id, username: user.username, email: user.email, isAdmin: user.isAdmin },
  });
}


const profileSchema = z.object({
  username: z.string().min(3, "3 caractères minimum").max(30).optional(),
  email: z.string().email("Email invalide").optional(),
});

const passwordSchema = z.object({
  currentPassword: z.string().min(1, "Mot de passe actuel requis"),
  newPassword: z.string().min(8, "8 caractères minimum"),
});

// GET /auth/me — profil courant (dont date de création)
export async function me(req: AuthRequest, res: Response) {
  const user = await prisma.user.findUnique({ where: { id: req.userId } });
  if (!user) return res.status(404).json({ error: "Compte introuvable" });
  res.json({
    id: user.id,
    username: user.username,
    email: user.email,
    isAdmin: user.isAdmin,
    createdAt: user.createdAt,
  });
}

// PATCH /auth/profile — modifie pseudo et/ou email
export async function updateProfile(req: AuthRequest, res: Response) {
  const parsed = profileSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.issues[0].message });

  const { username, email } = parsed.data;
  if (!username && !email) return res.status(400).json({ error: "Aucune modification" });

  // unicité (hors compte courant)
  if (username || email) {
    const clash = await prisma.user.findFirst({
      where: {
        id: { not: req.userId },
        OR: [
          ...(username ? [{ username }] : []),
          ...(email ? [{ email }] : []),
        ],
      },
    });
    if (clash) {
      const which = clash.username === username ? "Ce pseudo" : "Cet email";
      return res.status(409).json({ error: `${which} est déjà utilisé` });
    }
  }

  const user = await prisma.user.update({
    where: { id: req.userId },
    data: { ...(username ? { username } : {}), ...(email ? { email } : {}) },
  });
  res.json({
    id: user.id,
    username: user.username,
    email: user.email,
    isAdmin: user.isAdmin,
    createdAt: user.createdAt,
  });
}

// PATCH /auth/password — vérifie l'actuel puis remplace
export async function updatePassword(req: AuthRequest, res: Response) {
  const parsed = passwordSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.issues[0].message });

  const user = await prisma.user.findUnique({ where: { id: req.userId } });
  if (!user) return res.status(404).json({ error: "Compte introuvable" });

  const ok = await bcrypt.compare(parsed.data.currentPassword, user.passwordHash);
  if (!ok) return res.status(401).json({ error: "Mot de passe actuel incorrect" });

  await prisma.user.update({
    where: { id: req.userId },
    data: { passwordHash: await bcrypt.hash(parsed.data.newPassword, 10) },
  });
  res.json({ ok: true });
}
