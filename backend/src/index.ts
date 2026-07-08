import "dotenv/config";
import express from "express";
import cors from "cors";
import authRoutes from "./routes/auth.routes";
import tmdbRoutes from "./routes/tmdb.routes";
import libraryRoutes from "./routes/library.routes";
import episodesRoutes from "./routes/episodes.routes";
import ratingsRoutes from "./routes/ratings.routes";
import commentsRoutes from "./routes/comments.routes";
import statsRoutes from "./routes/stats.routes";
import recoRoutes from "./routes/recommendations.routes";
import { requireAuth } from "./middleware/auth";

const app = express();
app.use(cors());
app.use(express.json());

// ---- Routes publiques ----
app.use("/auth", authRoutes);
app.use("/tmdb", tmdbRoutes); // catalogue consultable sans compte

// ---- Routes protégées (JWT) ----
app.use("/library", requireAuth, libraryRoutes);
app.use("/episodes", requireAuth, episodesRoutes);
app.use("/ratings", requireAuth, ratingsRoutes);
app.use("/comments", commentsRoutes); // GET public, POST protégé (géré dans la route)
app.use("/stats", requireAuth, statsRoutes);
app.use("/recommendations", requireAuth, recoRoutes);

app.get("/health", (_req, res) => res.json({ status: "ok", app: "neptune-api" }));

const PORT = process.env.PORT ?? 3000;
app.listen(PORT, () => console.log(`🪐 Neptune API sur http://localhost:${PORT}`));
