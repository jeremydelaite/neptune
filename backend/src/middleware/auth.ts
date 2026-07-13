import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import { prisma } from "../lib/prisma";

export interface AuthRequest extends Request {
  userId?: string;
}

// Vérifie le header "Authorization: Bearer <token>"
export async function requireAuth(req: AuthRequest, res: Response, next: NextFunction) {
  const header = req.headers.authorization;
  if (!header?.startsWith("Bearer ")) {
    return res.status(401).json({ error: "Token manquant" });
  }
  try {
    const payload = jwt.verify(header.slice(7), process.env.JWT_SECRET!) as { userId: string };
    req.userId = payload.userId;
  } catch {
    return res.status(401).json({ error: "Token invalide ou expiré" });
  }

  // Compte banni ou suspendu → accès coupé immédiatement
  const u = await prisma.user.findUnique({
    where: { id: req.userId },
    select: { bannedAt: true, suspendedUntil: true },
  });
  if (!u) return res.status(401).json({ error: "Compte introuvable" });
  if (u.bannedAt) return res.status(403).json({ error: "Compte banni", code: "ACCOUNT_BLOCKED" });
  if (u.suspendedUntil && u.suspendedUntil > new Date())
    return res.status(403).json({ error: "Compte suspendu", code: "ACCOUNT_BLOCKED" });

  next();
}

// Auth optionnelle : renseigne req.userId si un token valide est présent, sinon continue
export function optionalAuth(req: AuthRequest, _res: Response, next: NextFunction) {
  const header = req.headers.authorization;
  if (header?.startsWith("Bearer ")) {
    try {
      const payload = jwt.verify(header.slice(7), process.env.JWT_SECRET!) as { userId: string };
      req.userId = payload.userId;
    } catch {
      /* token invalide → visiteur anonyme */
    }
  }
  next();
}
