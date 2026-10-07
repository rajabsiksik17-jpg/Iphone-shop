"use server";

import { z } from "zod";
import { db } from "@/server/db";
import { saveCategory, deleteCategory, reorderCategories, saveBrand, deleteBrand, reorderBrands, saveAttribute, deleteAttribute, saveAttributeGroup } from "@/server/admin/catalog";
import { bulkCategories, bulkBrands } from "@/server/admin/bulk";
import { adminRun } from "./_base";
import { idSchema } from "../helpers";

const optId = (v: string | null) => (v ? idSchema.parse(v) : null);

export async function saveCategoryAction(id: string | null, input: unknown) {
  return adminRun("catalog.edit", (s) => saveCategory(optId(id), input, s));
}
export async function deleteCategoryAction(id: string) {
  return adminRun("catalog.delete", (s) => deleteCategory(idSchema.parse(id), s));
}
export async function reorderCategoriesAction(parentId: string | null, ids: string[]) {
  return adminRun("catalog.edit", (s) => reorderCategories(optId(parentId), z.array(idSchema).max(500).parse(ids), s));
}
export async function saveBrandAction(id: string | null, input: unknown) {
  return adminRun("catalog.edit", (s) => saveBrand(optId(id), input, s));
}
export async function deleteBrandAction(id: string) {
  return adminRun("catalog.delete", (s) => deleteBrand(idSchema.parse(id), s));
}
export async function reorderBrandsAction(ids: string[]) {
  return adminRun("catalog.edit", () => reorderBrands(z.array(idSchema).max(500).parse(ids)));
}
export async function saveAttributeAction(id: string | null, input: unknown) {
  return adminRun("catalog.edit", (s) => saveAttribute(optId(id), input, s));
}
export async function deleteAttributeAction(id: string) {
  return adminRun("catalog.delete", (s) => deleteAttribute(idSchema.parse(id), s));
}
export async function saveAttributeGroupAction(id: string | null, input: unknown) {
  return adminRun("catalog.edit", async () => (await saveAttributeGroup(optId(id), input)).id);
}
export async function deleteAttributeGroupAction(id: string) {
  return adminRun("catalog.delete", async () => void (await db.attributeGroup.delete({ where: { id: idSchema.parse(id) } })));
}

export async function bulkCategoriesAction(ids: string[], op: "show" | "hide" | "feature" | "unfeature" | "delete") {
  return adminRun(op === "delete" ? "catalog.delete" : "catalog.edit", (s) => bulkCategories(ids, op, s));
}

export async function bulkBrandsAction(ids: string[], op: "show" | "hide" | "feature" | "unfeature" | "delete") {
  return adminRun(op === "delete" ? "catalog.delete" : "catalog.edit", (s) => bulkBrands(ids, op, s));
}
