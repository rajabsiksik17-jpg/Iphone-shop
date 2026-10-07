import { db } from "../../src/server/db";

/**
 * Replace exact default strings in every content table (JSON-safe). Only text
 * that still matches a shipped default changes; admin-written copy is left
 * alone. Returns the number of records updated.
 */
export async function swapContent(pairs: [string, string][]) {
  const swapJson = (v: unknown) => {
    let s = JSON.stringify(v);
    const before = s;
    for (const [a, b] of pairs) s = s.split(JSON.stringify(a).slice(1, -1)).join(JSON.stringify(b).slice(1, -1));
    return s === before ? null : JSON.parse(s);
  };
  let n = 0;
  const run = async <T extends { id: string }>(rows: T[], fields: (keyof T)[], update: (id: string, data: Record<string, unknown>) => Promise<unknown>) => {
    for (const r of rows) {
      const data: Record<string, unknown> = {};
      for (const f of fields) {
        const next = swapJson(r[f]);
        if (next !== null) data[f as string] = next;
      }
      if (Object.keys(data).length) {
        await update(r.id, data);
        n++;
      }
    }
  };
  await run(await db.announcement.findMany(), ["text"], (id, data) => db.announcement.update({ where: { id }, data }));
  await run(await db.slide.findMany(), ["eyebrow", "heading", "body"], (id, data) => db.slide.update({ where: { id }, data }));
  await run(await db.pageSection.findMany(), ["data"], (id, data) => db.pageSection.update({ where: { id }, data }));
  await run(await db.faq.findMany(), ["question", "answer"], (id, data) => db.faq.update({ where: { id }, data }));
  await run(await db.coupon.findMany(), ["name"], (id, data) => db.coupon.update({ where: { id }, data }));
  await run(await db.review.findMany(), ["body"], (id, data) => db.review.update({ where: { id }, data }));
  // Payment instructions (offline methods only — never touches secrets).
  const offline = await db.integration.findMany({ where: { key: { in: ["cod", "bank_transfer"] } }, select: { key: true, config: true } });
  await run(offline.map((i) => ({ id: i.key, config: i.config })), ["config"], (key, data) => db.integration.update({ where: { key }, data }));
  return n;
}
