import "dotenv/config";
import { defineConfig, env } from "prisma/config";

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
    seed: "node --conditions=react-server --import tsx prisma/seed.ts",
  },
  // CLI commands (migrate, studio) use the direct connection when provided —
  // on Supabase the runtime DATABASE_URL is the pooler (port 6543), which
  // can't run migrations. The app itself always connects with DATABASE_URL.
  datasource: {
    url: process.env.DIRECT_URL || env("DATABASE_URL"),
  },
});
