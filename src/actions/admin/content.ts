"use server";

import { z } from "zod";
import * as c from "@/server/admin/content";
import { adminRun } from "./_base";
import { idSchema } from "../helpers";

const optId = (id: string | null) => (id ? idSchema.parse(id) : null);

export async function savePageAction(id: string | null, input: unknown) {
  return adminRun("content.manage", (s) => c.savePage(optId(id), input, s));
}
export async function deletePageAction(id: string) {
  return adminRun("content.manage", (s) => c.deletePage(idSchema.parse(id), s));
}
export async function duplicatePageAction(id: string) {
  return adminRun("content.manage", (s) => c.duplicatePage(idSchema.parse(id), s));
}

export async function saveSliderAction(id: string | null, input: unknown) {
  return adminRun("content.manage", (s) => c.saveSlider(optId(id), input, s));
}
export async function deleteSliderAction(id: string) {
  return adminRun("content.manage", (s) => c.deleteSlider(idSchema.parse(id), s));
}

export async function saveAnnouncementAction(id: string | null, input: unknown) {
  return adminRun("content.manage", (s) => c.saveAnnouncement(optId(id), input, s));
}
export async function deleteAnnouncementAction(id: string) {
  return adminRun("content.manage", (s) => c.deleteAnnouncement(idSchema.parse(id), s));
}

const reorderable = z.enum(["announcement", "faq", "faqCategory", "socialLink"]);
export async function reorderContentAction(model: "announcement" | "faq" | "faqCategory", ids: string[]) {
  return adminRun("content.manage", () => c.reorder(reorderable.parse(model), z.array(idSchema).max(500).parse(ids)));
}

export async function saveMenuAction(id: string, input: unknown) {
  return adminRun("content.manage", (s) => c.saveMenu(idSchema.parse(id), input, s));
}

export async function saveFaqAction(id: string | null, input: unknown) {
  return adminRun("content.manage", (s) => c.saveFaq(optId(id), input, s));
}
export async function deleteFaqAction(id: string) {
  return adminRun("content.manage", (s) => c.deleteFaq(idSchema.parse(id), s));
}
export async function saveFaqCategoryAction(id: string | null, input: unknown) {
  return adminRun("content.manage", (s) => c.saveFaqCategory(optId(id), input, s));
}
export async function deleteFaqCategoryAction(id: string) {
  return adminRun("content.manage", (s) => c.deleteFaqCategory(idSchema.parse(id), s));
}

export async function saveSocialAction(input: unknown) {
  return adminRun("content.manage", (s) => c.saveSocial(input, s));
}
