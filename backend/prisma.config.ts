import "dotenv/config";
import { defineConfig, env } from "prisma/config";

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: { path: "prisma/migrations" },
  datasource: {
    // Les migrations passent par la connexion directe (Session pooler, port 5432)
    url: env("DIRECT_URL"),
  },
});