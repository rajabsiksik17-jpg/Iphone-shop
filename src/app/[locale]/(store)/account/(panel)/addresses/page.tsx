import { getCountries } from "libphonenumber-js";
import { setRequestLocale } from "next-intl/server";
import { db } from "@/server/db";
import { customerOrRedirect } from "@/server/auth/page-guards";
import { getSettings } from "@/server/settings/service";
import { AddressBook } from "@/components/store/account/forms";
import { localeMeta, type Locale } from "@/i18n/config";

export default async function AddressesPage({ params }: { params: Promise<{ locale: string }> }) {
  const locale = (await params).locale as Locale;
  setRequestLocale(locale);
  const user = await customerOrRedirect();
  const addresses = await db.address.findMany({ where: { userId: user.id }, orderBy: [{ isDefault: "desc" }, { createdAt: "desc" }] });
  const names = new Intl.DisplayNames([localeMeta[locale].intl], { type: "region" });
  const countries = getCountries().map((c) => ({ code: c, name: names.of(c) ?? c })).sort((a, b) => a.name.localeCompare(b.name, locale));
  const { defaultCountry } = await getSettings("geo");
  return <AddressBook addresses={addresses.map(({ createdAt: _c, updatedAt: _u, userId: _uid, ...a }) => a)} countries={countries} defaultCountry={defaultCountry} />;
}
