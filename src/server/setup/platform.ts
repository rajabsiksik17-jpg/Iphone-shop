import "server-only";
import { dbAll, activeProfile } from "../db";
import { LEGACY_MANAGER_PERMISSIONS, MANAGER_PERMISSIONS } from "@/config/permissions";

/**
 * Idempotent platform upgrades for existing installs:
 * - the Store Manager role gets the broad store-level permission set — only
 *   when it still has the original defaults (a customised role is left alone);
 * - the active store type has a profile row (so switching away saves it).
 */
export async function setupPlatform() {
  const out = { managerUpgraded: false, profile: "" };
  const manager = await dbAll.role.findUnique({ where: { key: "manager" } });
  if (manager && [...manager.permissions].sort().join() === [...LEGACY_MANAGER_PERMISSIONS].sort().join()) {
    await dbAll.role.update({ where: { id: manager.id }, data: { permissions: MANAGER_PERMISSIONS } });
    out.managerUpgraded = true;
  }
  const key = await activeProfile();
  // Homepage sections created without a profile (e.g. by the initial seed's
  // nested page create) belong to the active store type.
  await dbAll.pageSection.updateMany({ where: { profile: null, page: { slug: "home" } }, data: { profile: key } });
  await dbAll.slider.updateMany({ where: { profile: null }, data: { profile: key } });
  await dbAll.storeProfile.upsert({ where: { key }, create: { key, initializedAt: new Date(), activatedAt: new Date() }, update: {} });
  out.profile = key;
  return out;
}
