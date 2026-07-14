import "dotenv/config";
import express from "express";
import cors from "cors";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import authRoutes from "./routes/auth.routes";
import usersRoutes from "./routes/users.routes";
import friendsRoutes from "./routes/friends.routes";
import notificationsRoutes from "./routes/notifications.routes";
import tmdbRoutes from "./routes/tmdb.routes";
import libraryRoutes from "./routes/library.routes";
import episodesRoutes from "./routes/episodes.routes";
import ratingsRoutes from "./routes/ratings.routes";
import commentsRoutes from "./routes/comments.routes";
import statsRoutes from "./routes/stats.routes";
import recoRoutes from "./routes/recommendations.routes";
import { requireAuth } from "./middleware/auth";

// Sécurité : un secret JWT fort est obligatoire
if (!process.env.JWT_SECRET || process.env.JWT_SECRET.length < 16) {
  console.error("❌ JWT_SECRET manquant ou trop court (>= 16 caractères requis). Arrêt.");
  process.exit(1);
}

const app = express();
app.disable("x-powered-by");
app.use(helmet());
const ALLOWED = (process.env.CORS_ORIGINS ?? "")
  .split(",")
  .map((o) => o.trim())
  .filter(Boolean);
app.use(cors(ALLOWED.length ? { origin: ALLOWED } : {})); // ouvert si non configuré (dev)
app.use(express.json({ limit: "2mb" }));

// Limitation de débit : freine le brute-force et l'abus (login, inscription, emails)
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 min
  max: 30, // 30 tentatives / IP / fenêtre
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Trop de tentatives. Réessaie dans quelques minutes." },
});
const apiLimiter = rateLimit({ windowMs: 60 * 1000, max: 200, standardHeaders: true, legacyHeaders: false });
app.use(apiLimiter); // plafond global doux

// ---- Routes publiques ----
app.use("/auth", authLimiter, authRoutes);
app.use("/tmdb", tmdbRoutes); // catalogue consultable sans compte

// ---- Routes protégées (JWT) ----
app.use("/library", requireAuth, libraryRoutes);
app.use("/episodes", requireAuth, episodesRoutes);
app.use("/ratings", requireAuth, ratingsRoutes);
app.use("/comments", commentsRoutes); // GET public, POST protégé (géré dans la route)
app.use("/stats", requireAuth, statsRoutes);
app.use("/users", requireAuth, usersRoutes);
app.use("/friends", requireAuth, friendsRoutes);
app.use("/notifications", requireAuth, notificationsRoutes);
app.use("/recommendations", requireAuth, recoRoutes);

app.get("/health", (_req, res) => res.json({ status: "ok", app: "neptune-api" }));

// Filet d'erreur global : une requête ratée renvoie 500 au lieu de propager
app.use((err: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error("Erreur non gérée:", err);
  if (!res.headersSent) res.status(500).json({ error: "Erreur serveur" });
});

// Empêche une erreur asynchrone isolée de tuer le process (dev)
process.on("unhandledRejection", (reason) => console.error("unhandledRejection:", reason));
process.on("uncaughtException", (err) => console.error("uncaughtException:", err));

const PORT = process.env.PORT ?? 3000;
app.listen(PORT, () => console.log(`🪐 Neptune API sur http://localhost:${PORT}`));
