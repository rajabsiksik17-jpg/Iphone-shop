import type { MetadataRoute } from "next";
import { getManySettings } from "@/server/settings/service";
import { t } from "@/lib/i18n-text";

export default async function manifest(): Promise<MetadataRoute.Manifest> {
  const { store, appearance } = await getManySettings(["store", "appearance"]);
  return {
    name: t(store.name, "en"),
    short_name: t(store.name, "en"),
    description: t(store.tagline, "en"),
    start_url: "/",
    display: "standalone",
    background_color: appearance.colors.background,
    theme_color: appearance.colors.primary,
    icons: [{ src: "/icon.svg", sizes: "any", type: "image/svg+xml" }],
  };
}
