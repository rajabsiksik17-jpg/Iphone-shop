import "server-only";
import { cache } from "react";
import { activeProfile } from "./db";
import { storeTypeDefinition } from "./admin/store-profiles";
import { t } from "@/lib/i18n-text";

/**
 * The active store type as the storefront sees it: name, description and the
 * words this kind of store uses for its products (e.g. "Fragrances", "Menu").
 */
export const activeStoreType = cache(async (locale: string) => {
  const def = await storeTypeDefinition(await activeProfile());
  return {
    key: def?.key ?? null,
    name: def ? t(def.name, locale) : "",
    description: def ? t(def.description, locale) : "",
    products: def?.terms ? t(def.terms.products, locale) : null,
    emptyIcon: def?.emptyIcon ?? null,
  };
});
