import "server-only";
import { db, ANY_PROFILE, type Tx } from "../db";
import { emit } from "../events";
import { getSettings } from "../settings/service";
import { refreshProductDerived } from "./derived";
import type { InventoryReason } from "@/generated/prisma/client";
import { AppError } from "../errors";

export type StockChange = {
  productId: string;
  variantId?: string | null;
  delta: number;
  reason: InventoryReason;
  note?: string;
  orderId?: string;
  userId?: string;
  /** Reject when the result would go negative (unless backorders are allowed). */
  enforce?: boolean;
};

/**
 * Atomically apply a stock change and record it in the movement ledger.
 * Uses a conditional UPDATE so concurrent checkouts can't oversell.
 */
export async function applyStockChange(change: StockChange, tx: Tx) {
  // Stock follows orders whatever store type is active (e.g. a cancelled order from another type restocks).
  const product = await tx.product.findUniqueOrThrow({
    where: { id: change.productId, ...ANY_PROFILE },
    select: { trackInventory: true, allowBackorder: true, lowStockThreshold: true },
  });
  if (!product.trackInventory) return null;
  const guard = change.enforce && change.delta < 0 && !product.allowBackorder;

  let balance: number;
  if (change.variantId) {
    const res = await tx.productVariant.updateMany({
      where: { id: change.variantId, productId: change.productId, ...(guard ? { stock: { gte: -change.delta } } : {}) },
      data: { stock: { increment: change.delta } },
    });
    if (res.count !== 1) throw new AppError("insufficient_stock", 409, { productId: change.productId, variantId: change.variantId });
    balance = (await tx.productVariant.findUniqueOrThrow({ where: { id: change.variantId }, select: { stock: true } })).stock;
  } else {
    const res = await tx.product.updateMany({
      where: { id: change.productId, ...ANY_PROFILE, ...(guard ? { stock: { gte: -change.delta } } : {}) },
      data: { stock: { increment: change.delta } },
    });
    if (res.count !== 1) throw new AppError("insufficient_stock", 409, { productId: change.productId });
    balance = (await tx.product.findUniqueOrThrow({ where: { id: change.productId, ...ANY_PROFILE }, select: { stock: true } })).stock;
  }

  await tx.inventoryMovement.create({
    data: {
      productId: change.productId,
      variantId: change.variantId ?? null,
      delta: change.delta,
      balanceAfter: balance,
      reason: change.reason,
      note: change.note,
      orderId: change.orderId,
      userId: change.userId,
    },
  });
  return { balance, lowThreshold: product.lowStockThreshold };
}

/** After the transaction commits: refresh derived fields and raise stock alerts. */
export async function afterStockChange(productId: string, variantId: string | null | undefined, balance: number | undefined, previous?: number) {
  await refreshProductDerived(productId);
  emit("STOCK_CHANGED", { productId });
  if (balance === undefined) return;
  const threshold =
    (await db.product.findUnique({ where: { id: productId, ...ANY_PROFILE }, select: { lowStockThreshold: true } }))?.lowStockThreshold ??
    (await getSettings("store")).lowStockThreshold;
  // Alert only on the crossing, not on every sale below the threshold.
  const crossedOut = balance <= 0 && (previous === undefined || previous > 0);
  const crossedLow = balance > 0 && balance <= threshold && (previous === undefined || previous > threshold);
  if (crossedOut) emit("PRODUCT_OUT_OF_STOCK", { productId, variantId });
  else if (crossedLow) emit("PRODUCT_LOW_STOCK", { productId, variantId, stock: balance });
}

/** Manual adjustment from the admin (set absolute or relative). */
export async function adjustStock(input: { productId: string; variantId?: string | null; mode: "set" | "delta"; value: number; reason: InventoryReason; note?: string; userId: string }) {
  const result = await db.$transaction(async (tx) => {
    const current = input.variantId
      ? (await tx.productVariant.findUniqueOrThrow({ where: { id: input.variantId } })).stock
      : (await tx.product.findUniqueOrThrow({ where: { id: input.productId } })).stock;
    const delta = input.mode === "set" ? input.value - current : input.value;
    if (delta === 0) return { previous: current, balance: current };
    const r = await applyStockChange({ productId: input.productId, variantId: input.variantId, delta, reason: input.reason, note: input.note, userId: input.userId }, tx);
    return { previous: current, balance: r?.balance ?? current + delta };
  });
  await afterStockChange(input.productId, input.variantId, result.balance, result.previous);
  return result;
}
