"use server";

import { z } from "zod";
import { saveProduct, duplicateProduct, deleteProducts, bulkProducts, searchProductsForPicker } from "@/server/admin/products";
import { adjustStock } from "@/server/catalog/inventory";
import { db } from "@/server/db";
import { adminRun } from "./_base";
import { idSchema } from "../helpers";

export async function saveProductAction(id: string | null, input: unknown) {
  return adminRun("catalog.edit", (staff) => saveProduct(id ? idSchema.parse(id) : null, input, staff));
}

export async function duplicateProductAction(id: string) {
  return adminRun("catalog.edit", (staff) => duplicateProduct(idSchema.parse(id), staff));
}

export async function deleteProductsAction(ids: string[]) {
  return adminRun("catalog.delete", (staff) => deleteProducts(z.array(idSchema).max(500).parse(ids), staff));
}

export async function bulkProductsAction(ids: string[], op: unknown) {
  return adminRun("catalog.edit", (staff) => bulkProducts(z.array(idSchema).max(500).parse(ids), op, staff));
}

export async function productPickerAction(q: string, locale: string, exclude: string[] = []) {
  return adminRun("catalog.view", () => searchProductsForPicker(z.string().max(100).parse(q), locale, exclude), { revalidate: false });
}

export async function adjustStockAction(input: { productId: string; variantId?: string | null; mode: "set" | "delta"; value: number; reason: "ADJUSTMENT" | "RESTOCK" | "CORRECTION" | "RETURN"; note?: string }) {
  return adminRun("inventory.manage", async (staff) => {
    const p = z
      .object({ productId: idSchema, variantId: idSchema.nullable().optional(), mode: z.enum(["set", "delta"]), value: z.number().int().min(-1_000_000).max(1_000_000), reason: z.enum(["ADJUSTMENT", "RESTOCK", "CORRECTION", "RETURN"]), note: z.string().max(300).optional() })
      .parse(input);
    if (p.mode === "set" && p.value < 0) throw new Error("negative");
    return adjustStock({ ...p, userId: staff.id });
  });
}

export async function stockHistoryAction(productId: string) {
  return adminRun(
    "inventory.manage",
    async () => {
      const rows = await db.inventoryMovement.findMany({ where: { productId: idSchema.parse(productId) }, orderBy: { createdAt: "desc" }, take: 50, include: { user: { select: { name: true } }, variant: { select: { sku: true } } } });
      return rows.map((r) => ({ id: r.id, delta: r.delta, balance: r.balanceAfter, reason: r.reason, note: r.note, user: r.user?.name ?? null, variant: r.variant?.sku ?? null, at: r.createdAt.toISOString() }));
    },
    { revalidate: false },
  );
}
