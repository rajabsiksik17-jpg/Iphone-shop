import "server-only";
import { getLocale } from "next-intl/server";
import { headers } from "next/headers";
import { redirect } from "@/i18n/navigation";
import { getCurrentUser } from "./session";
import type { Locale } from "@/i18n/config";

/**
 * For server *pages* (which render in parallel with their layout): redirect a
 * signed-out visitor to sign-in instead of throwing.
 */
export async function customerOrRedirect() {
  const user = await getCurrentUser();
  if (user) return user;
  const locale = (await getLocale()) as Locale;
  const path = (await headers()).get("x-invoke-path") ?? "/account";
  return redirect({ href: `/account/login?next=${encodeURIComponent(path.replace(/^\/(ar|en)/, ""))}`, locale });
}
