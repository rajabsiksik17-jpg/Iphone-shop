/** Run only the embedded development database (Ctrl+C to stop). */
import "dotenv/config";
import { dbTarget, portOpen, startEmbeddedDb } from "./embedded-db";

const { host, port } = dbTarget();
if (await portOpen(host, port)) {
  console.log(`PostgreSQL is already running on ${host}:${port}.`);
  process.exit(0);
}
const { server, database } = await startEmbeddedDb();
console.log(`PostgreSQL ready on 127.0.0.1:${port}/${database} (Ctrl+C to stop)`);

const stop = async () => {
  await server.stop();
  process.exit(0);
};
process.on("SIGINT", stop);
process.on("SIGTERM", stop);
setInterval(() => {}, 1 << 30);
