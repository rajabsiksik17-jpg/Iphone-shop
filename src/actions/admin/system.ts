"use server";

import { z } from "zod";
import * as sys from "@/server/admin/system";
import { adminRun } from "./_base";
import { idSchema } from "../helpers";

const quiet = { revalidate: false } as const;
const optId = (id: string | null) => (id ? idSchema.parse(id) : null);

export async function saveStaffAction(id: string | null, input: unknown) {
  return adminRun("staff.manage", (s) => sys.saveStaff(optId(id), input, s), quiet);
}

export async function resetStaffPasswordAction(id: string) {
  return adminRun("staff.manage", (s) => sys.resetStaffPassword(idSchema.parse(id), s), quiet);
}

export async function saveRoleAction(id: string | null, input: unknown) {
  return adminRun("staff.manage", (s) => sys.saveRole(optId(id), input, s), quiet);
}

export async function deleteRoleAction(id: string) {
  return adminRun("staff.manage", (s) => sys.deleteRole(idSchema.parse(id), s), quiet);
}

export async function revokeSessionAction(id: string) {
  return adminRun("staff.manage", (s) => sys.revokeSessionById(idSchema.parse(id), s), quiet);
}

// Profile actions only require a signed-in staff member (no extra permission).
export async function updateProfileAction(input: unknown) {
  return adminRun(null, (s) => sys.updateProfile(input, s), quiet);
}

export async function changePasswordAction(current: string, next: string) {
  return adminRun(null, (s) => sys.changeOwnPassword(z.string().max(256).parse(current), z.string().max(256).parse(next), s), quiet);
}

export async function revokeOwnSessionAction(id: string) {
  return adminRun(null, (s) => sys.revokeOwnSession(idSchema.parse(id), s), quiet);
}
