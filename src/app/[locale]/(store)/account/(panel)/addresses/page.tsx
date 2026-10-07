import { setRequestLocale } from "next-intl/server";
import { db } from "@/server/db";
import { customerOrRedirect } from "@/server/auth/page-guards";
import { getSettings } from "@/server/settings/service";
import { AddressBook } from "@/components/store/account/forms";
import type { Locale } from "@/i18n/config";
import { checkoutDestinations } from "@/server/commerce/regions";

export default async function AddressesPage({ params }: { params: Promise<{ locale: string }> }) {
  const locale = (await params).locale as Locale;
  setRequestLocale(locale);
  const user = await customerOrRedirect();
  const addresses = await db.address.findMany({ where: { userId: user.id }, orderBy: [{ isDefault: "desc" }, { createdAt: "desc" }] });
  // Same countries and cities as checkout, so saved addresses are always deliverable.
  const [{ countries, regions }, { defaultCountry }] = await Promise.all([checkoutDestinations(locale), getSettings("geo")]);
  return <AddressBook addresses={addresses.map(({ createdAt: _c, updatedAt: _u, userId: _uid, ...a }) => a)} countries={countries} regions={regions} defaultCountry={countries.some((c) => c.code === defaultCountry) ? defaultCountry : (countries[0]?.code ?? defaultCountry)} />;
}
