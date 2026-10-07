import "server-only";
import type { ReactNode } from "react";
import { ServerIcon } from "@/components/icons/server-icon";
import { getSettings } from "@/server/settings/service";
import { customSvgsFor } from "@/server/icons";
import { storeTypeByKey, type TrustConcept } from "@/config/store-types";

const FALLBACK: Record<TrustConcept, string> = { delivery: "lucide:Truck", warranty: "lucide:ShieldCheck", returns: "lucide:RotateCcw", payment: "lucide:CreditCard" };

export type TrustIcons = Record<TrustConcept, ReactNode>;

/**
 * Trust-badge icons (delivery, warranty, returns, payment) for the current
 * store type: the admin's mapping, else the store type's defaults, else the
 * standard set. Rendered on the server and passed to client components, so
 * the storefront never ships an icon library.
 */
export async function trustIcons(className = "size-5 shrink-0 text-fg/70"): Promise<TrustIcons> {
  const st = await getSettings("storeType");
  const preset = storeTypeByKey(st.type);
  const pick = (k: TrustConcept) => st.icons[k] || preset?.icons[k] || FALLBACK[k];
  const values = (Object.keys(FALLBACK) as TrustConcept[]).map((k) => [k, pick(k)] as const);
  const svgs = await customSvgsFor(values.map(([, v]) => v));
  return Object.fromEntries(values.map(([k, v]) => [k, <ServerIcon key={k} value={v} customSvgs={svgs} fallback={FALLBACK[k]} className={className} />])) as TrustIcons;
}
