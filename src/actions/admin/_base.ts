import "server-only";
import { invalidateCategoryCounts } from "@/server/catalog/taxonomy";
import { revalidatePath } from "next/cache";
import { requireStaff } from "@/server/auth/guards";
import { toActionError, type ActionResult } from "@/server/errors";
import type { Permission } from "@/config/permissions";
import type { CurrentStaff } from "@/server/auth/session";

/**
 * Every admin mutation goes through here: authenticate the staff session,
 * check the permission, run, convert errors to safe codes, and refresh the
 * storefront cache so changes show immediately.
 */
export async function adminRun<T>(permission: Permission | Permission[] | null, fn: (staff: CurrentStaff) => Promise<T>, opts: { revalidate?: boolean } = {}): Promise<ActionResult<T>> {
  try {
    const staff = await requireStaff(permission ?? undefined);
    const data = await fn(staff);
    if (opts.revalidate !== false) {
      revalidatePath("/", "layout");
      invalidateCategoryCounts();
    }
    return { ok: true, data };
  } catch (e) {
    return toActionError(e);
  }
}
