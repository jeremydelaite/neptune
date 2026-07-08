import { Request, Response } from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { z } from "zod";
import { prisma } from "../lib/prisma";

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
  res.status(201).json({ token: signToken(user.id), user: { id: user.id, username, email } });
}

export async function login(req: Request, res: Response) {
  const parsed = loginSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "Identifiants invalides" });

  const user = await prisma.user.findUnique({ where: { email: parsed.data.email } });
  if (!user || !(await bcrypt.compare(parsed.data.password, user.passwordHash))) {
    return res.status(401).json({ error: "Email ou mot de passe incorrect" });
  }
  res.json({ token: signToken(user.id), user: { id: user.id, username: user.username, email: user.email } });
}
