/**
 * Local development database: a real PostgreSQL server (embedded binaries) so
 * contributors don't need Docker or a system install. Data persists in .data/.
 * Production should point DATABASE_URL at a managed PostgreSQL instead.
 */
import EmbeddedPostgres from "embedded-postgres";
import fs from "node:fs";
import net from "node:net";
import path from "node:path";
import pg from "pg";

export function dbTarget() {
  const url = new URL(process.env.DATABASE_URL ?? "postgresql://postgres:postgres@127.0.0.1:5433/nuqta");
  return { host: url.hostname, port: Number(url.port || 5432), database: decodeURIComponent(url.pathname.slice(1)) || "nuqta" };
}

export function isLocalHost(host: string) {
  return host === "127.0.0.1" || host === "localhost" || host === "::1";
}

/** True when something accepts TCP connections on host:port. */
export function portOpen(host: string, port: number, timeoutMs = 800) {
  return new Promise<boolean>((resolve) => {
    const s = net.connect({ host, port });
    const done = (ok: boolean) => {
      s.destroy();
      resolve(ok);
    };
    s.setTimeout(timeoutMs, () => done(false));
    s.once("connect", () => done(true));
    s.once("error", () => done(false));
  });
}

/** Start the embedded server and make sure the target database exists. */
export async function startEmbeddedDb() {
  const { port, database } = dbTarget();
  const dataDir = path.resolve(".data/postgres");
  const firstRun = !fs.existsSync(path.join(dataDir, "PG_VERSION"));
  const server = new EmbeddedPostgres({
    databaseDir: dataDir,
    user: "postgres",
    password: "postgres",
    port,
    persistent: true,
    initdbFlags: ["--encoding=UTF8", "--locale=C"],
    onLog: () => {},
    onError: (e) => console.error(String(e)),
  });
  if (firstRun) await server.initialise();
  // A crashed/killed previous run can leave a stale lock file behind.
  const pid = path.join(dataDir, "postmaster.pid");
  if (fs.existsSync(pid)) fs.rmSync(pid, { force: true });
  await server.start();
  const client = new pg.Client({ host: "127.0.0.1", port, user: "postgres", password: "postgres", database: "postgres" });
  await client.connect();
  const exists = await client.query("SELECT 1 FROM pg_database WHERE datname = $1", [database]);
  if (!exists.rowCount) {
    await client.query(`CREATE DATABASE "${database.replace(/"/g, "")}"`);
    console.log(`Created database "${database}"`);
  }
  await client.end();
  return { server, port, database, created: !exists.rowCount };
}
