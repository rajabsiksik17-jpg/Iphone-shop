import "server-only";
import { z } from "zod";
import { db } from "../db";
import { AppError } from "../errors";
import { audit } from "../audit";
import { deleteBrand, deleteCategory } from "./catalog";
import { deleteCoupon } from "./operations";
import { invalidateCategoryCounts } from "../catalog/taxonomy";
import type { CurrentStaff } from "../auth/session";

/**
 * Bulk operations for catalogue and marketing entities. Each item goes through
 * the same rules as a single edit (e.g. a category with subcategories can't be
 * deleted); items that can't be changed are reported instead of failing the
 * whole batch.
 */
export type BulkResult = { done: number; skipped: { id: string; reason: string }[] };

const ids = z.array(z.string().min(1).max(64)).min(1).max(500);

async function each(list: string[], fn: (id: string) => Promise<void>): Promise<BulkResult> {
  let done = 0;
  const skipped: BulkResult["skipped"] = [];
  for (const id of list) {
    try {
      await fn(id);
      done++;
    } catch (e) {
      skipped.push({ id, reason: e instanceof AppError ? e.code : "error" });
    }
  }
  return { done, skipped };
}

const visibilityOps = z.enum(["show", "hide", "feature", "unfeature", "delete"]);
const flagData = (op: "show" | "hide" | "feature" | "unfeature") => (op === "show" ? { isActive: true } : op === "hide" ? { isActive: false } : { isFeatured: op === "feature" });

export async function bulkCategories(rawIds: unknown, rawOp: unknown, staff: CurrentStaff): Promise<BulkResult> {
  const list = ids.parse(rawIds);
  const op = visibilityOps.parse(rawOp);
  let r: BulkResult;
  if (op === "delete") {
    // Deepest first, so selecting a parent with its children deletes both.
    const rows = await db.category.findMany({ where: { id: { in: list } }, select: { id: true, depth: true } });
    r = await each(rows.sort((a, b) => b.depth - a.depth).map((c) => c.id), (id) => deleteCategory(id, staff));
  } else {
    const res = await db.category.updateMany({ where: { id: { in: list } }, data: flagData(op) });
    r = { done: res.count, skipped: [] };
  }
  invalidateCategoryCounts();
  await audit({ actor: staff, action: `category.bulk_${op}`, entityType: "category", summary: `${r.done} categories`, changes: { ids: list } });
  return r;
}

export async function bulkBrands(rawIds: unknown, rawOp: unknown, staff: CurrentStaff): Promise<BulkResult> {
  const list = ids.parse(rawIds);
  const op = visibilityOps.parse(rawOp);
  let r: BulkResult;
  if (op === "delete") r = await each(list, (id) => deleteBrand(id, staff));
  else {
    const res = await db.brand.updateMany({ where: { id: { in: list } }, data: flagData(op) });
    r = { done: res.count, skipped: [] };
  }
  await audit({ actor: staff, action: `brand.bulk_${op}`, entityType: "brand", summary: `${r.done} brands`, changes: { ids: list } });
  return r;
}

export async function bulkCoupons(rawIds: unknown, rawOp: unknown, staff: CurrentStaff): Promise<BulkResult> {
  const list = ids.parse(rawIds);
  const op = z.enum(["activate", "deactivate", "delete"]).parse(rawOp);
  let r: BulkResult;
  if (op === "delete") r = await each(list, (id) => deleteCoupon(id, staff));
  else {
    const res = await db.coupon.updateMany({ where: { id: { in: list } }, data: { isActive: op === "activate" } });
    r = { done: res.count, skipped: [] };
  }
  await audit({ actor: staff, action: `coupon.bulk_${op}`, entityType: "coupon", summary: `${r.done} coupons`, changes: { ids: list } });
  return r;
}
