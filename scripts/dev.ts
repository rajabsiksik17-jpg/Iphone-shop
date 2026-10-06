/**
 * One-command local development:
 *   1. starts the embedded PostgreSQL if nothing is listening on DATABASE_URL,
 *   2. applies pending migrations (and seeds a brand-new database),
 *   3. runs the app server with file watching.
 * Stopping this process (Ctrl+C) also stops the database it started.
 */
import "dotenv/config";
import { spawn, spawnSync } from "node:child_process";
import { dbTarget, isLocalHost, portOpen, startEmbeddedDb } from "./embedded-db";

const { host, port } = dbTarget();
let stopDb: (() => Promise<void>) | null = null;
let seedNeeded = false;

if (await portOpen(host, port)) {
  console.log(`✓ Database reachable on ${host}:${port}`);
} else if (isLocalHost(host)) {
  console.log(`… Starting embedded PostgreSQL on port ${port}`);
  const db = await startEmbeddedDb();
  stopDb = () => db.server.stop();
  seedNeeded = db.created;
  console.log(`✓ Database ready (${db.database})`);
} else {
  console.error(`✗ Can't reach the database at ${host}:${port}. Check DATABASE_URL in .env.`);
  process.exit(1);
}

const npx = process.platform === "win32" ? "npx.cmd" : "npx";
const run = (args: string[]) => spawnSync(npx, args, { stdio: "inherit", shell: process.platform === "win32" });

if (run(["prisma", "migrate", "deploy"]).status !== 0) {
  console.error("✗ Database migrations failed.");
  await stopDb?.();
  process.exit(1);
}
if (seedNeeded) run(["npm", "run", "db:seed"]);

const app = spawn(npx, ["tsx", "watch", "--clear-screen=false", "--ignore", "./src", "--ignore", "./.next", "server.ts"], {
  stdio: "inherit",
  shell: process.platform === "win32",
});

let stopping = false;
const shutdown = async (code = 0) => {
  if (stopping) return;
  stopping = true;
  app.kill();
  await stopDb?.().catch(() => {});
  process.exit(code);
};
app.on("exit", (code) => void shutdown(code ?? 0));
process.on("SIGINT", () => void shutdown(0));
process.on("SIGTERM", () => void shutdown(0));
