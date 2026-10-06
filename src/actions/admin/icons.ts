"use server";

import { z } from "zod";
import { db } from "@/server/db";
import { createCustomIcon } from "@/server/icons";
import { audit } from "@/server/audit";
import { adminRun } from "./_base";

export async function listCustomIconsAction() {
  return adminRun(null, async () => (await db.customIcon.findMany({ orderBy: { createdAt: "desc" }, take: 200 })).map((i) => ({ id: i.id, name: i.name, svg: i.svg })), { revalidate: false });
}

export async function uploadCustomIconAction(name: string, svg: string) {
  return adminRun(["catalog.edit"], async (staff) => {
    const icon = await createCustomIcon(z.string().max(60).parse(name), z.string().max(30_000).parse(svg));
    await audit({ actor: staff, action: "icon.uploaded", entityType: "icon", entityId: icon.id, summary: icon.name });
    return { id: icon.id, name: icon.name, svg: icon.svg };
  });
}
