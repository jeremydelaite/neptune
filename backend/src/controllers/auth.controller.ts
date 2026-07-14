import { Request, Response } from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { z } from "zod";
import { prisma } from "../lib/prisma";
import crypto from "crypto";
import { sendVerificationEmail } from "../lib/mail";
import { moderateAvatar } from "../lib/imageModeration";
import { accountBlockMessage } from "../lib/accountStatus";
export { accountBlockMessage };
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



function newVerifyToken() {
  return {
    token: crypto.randomBytes(24).toString("hex"),
    exp: new Date(Date.now() + 24 * 60 * 60 * 1000), // 24 h
  };
}

const PUBLIC_URL = process.env.PUBLIC_URL ?? "http://localhost:3000";

export async function register(req: Request, res: Response) {
  try {
    const parsed = registerSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: parsed.error.issues[0].message });

    const { email, username, password } = parsed.data;
    const exists = await prisma.user.findFirst({ where: { OR: [{ email }, { username }] } });
    if (exists) return res.status(409).json({ error: "Email ou pseudo déjà utilisé" });

    const { token, exp } = newVerifyToken();
    const user = await prisma.user.create({
      data: {
        email,
        username,
        passwordHash: await bcrypt.hash(password, 10),
        emailVerified: false,
        verifyToken: token,
        verifyTokenExp: exp,
      },
    });
    // l'envoi d'email ne doit jamais bloquer la création du compte
    sendVerificationEmail(email, `${PUBLIC_URL}/auth/verify?token=${token}`, username).catch(() => {});
    res.status(201).json({
      pendingVerification: true,
      email,
      message: "Compte créé. Vérifie ton email pour l'activer.",
    });
  } catch (e) {
    console.error("register error:", e);
    res.status(500).json({ error: "Inscription impossible pour le moment. (migration email en attente ?)" });
  }
}

export async function login(req: Request, res: Response) {
  const parsed = loginSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "Identifiants invalides" });

  const user = await prisma.user.findUnique({ where: { email: parsed.data.email } });
  if (!user || !(await bcrypt.compare(parsed.data.password, user.passwordHash))) {
    return res.status(401).json({ error: "Email ou mot de passe incorrect" });
  }

  const blocked = accountBlockMessage(user);
  if (blocked) return res.status(403).json({ error: blocked });

  if (!user.emailVerified) {
    return res.status(403).json({
      error: "Valide ton adresse email avant de te connecter.",
      code: "EMAIL_NOT_VERIFIED",
    });
  }

  res.json({
    token: signToken(user.id),
    user: {
      id: user.id,
      username: user.username,
      email: user.email,
      isAdmin: user.isAdmin,
      avatarUrl: user.avatarUrl,
      warning: user.warning ?? null,
    },
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
    avatarUrl: user.avatarUrl,
    createdAt: user.createdAt,
    warning: user.warning ?? null,
  });
}

// POST /auth/dismiss-warning — l'utilisateur a lu son avertissement
export async function dismissWarning(req: AuthRequest, res: Response) {
  await prisma.user.update({ where: { id: req.userId }, data: { warning: null } });
  res.json({ ok: true });
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


// PATCH /auth/avatar — définit ou supprime la photo (data URI compressée, ou null)
export async function updateAvatar(req: AuthRequest, res: Response) {
  const schema = z.object({
    avatar: z
      .string()
      .regex(/^data:image\/(png|jpe?g|webp);base64,/, "Format d'image invalide")
      .max(900000, "Image trop lourde")
      .nullable(),
  });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.issues[0].message });

  // Modération IA de la nouvelle photo (si un fournisseur est configuré)
  if (parsed.data.avatar) {
    const mod = await moderateAvatar(parsed.data.avatar);
    if (!mod.ok) return res.status(400).json({ error: mod.reason ?? "Image refusée par la modération." });
  }

  const user = await prisma.user.update({
    where: { id: req.userId },
    data: { avatarUrl: parsed.data.avatar },
  });
  res.json({ avatarUrl: user.avatarUrl });
}


// GET /auth/verify?token= — valide le compte (page HTML simple)
export async function verifyEmail(req: Request, res: Response) {
  const token = String(req.query.token ?? "");
  const page = (title: string, msg: string, ok: boolean) => `<!doctype html><html lang="fr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Neptune</title></head><body style="font-family:sans-serif;background:#0F1115;color:#fff;display:flex;align-items:center;justify-content:center;height:100vh;margin:0"><div style="text-align:center;max-width:340px;padding:24px"><div style="font-size:40px">${ok ? "🪐" : "⚠️"}</div><h1 style="font-size:20px">${title}</h1><p style="color:#9aa">${msg}</p></div></body></html>`;

  if (!token) return res.status(400).send(page("Lien invalide", "Aucun jeton fourni.", false));

  const user = await prisma.user.findFirst({ where: { verifyToken: token } });
  if (!user || !user.verifyTokenExp || user.verifyTokenExp < new Date()) {
    return res.status(400).send(page("Lien expiré", "Ce lien de validation n'est plus valide. Demande-en un nouveau depuis l'app.", false));
  }

  await prisma.user.update({
    where: { id: user.id },
    data: { emailVerified: true, verifyToken: null, verifyTokenExp: null },
  });
  res.send(page("Compte validé ✅", "Tu peux maintenant te connecter dans l'application Neptune.", true));
}

// POST /auth/resend-verification { email } — renvoie un lien
export async function resendVerification(req: Request, res: Response) {
  const email = String(req.body?.email ?? "").trim();
  const user = await prisma.user.findUnique({ where: { email } });
  // Réponse identique même si l'email n'existe pas (évite l'énumération de comptes)
  if (user && !user.emailVerified) {
    const { token, exp } = newVerifyToken();
    await prisma.user.update({ where: { id: user.id }, data: { verifyToken: token, verifyTokenExp: exp } });
    await sendVerificationEmail(user.email, `${PUBLIC_URL}/auth/verify?token=${token}`, user.username);
  }
  res.json({ ok: true });
}
