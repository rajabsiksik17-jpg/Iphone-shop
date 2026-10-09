import { redirect } from "@/i18n/navigation";
import { getLocale } from "next-intl/server";

// Location detection moved into the primary-country page.
export default async function GeoRedirect() {
  redirect({ href: "/admin/settings/country", locale: await getLocale() });
}
