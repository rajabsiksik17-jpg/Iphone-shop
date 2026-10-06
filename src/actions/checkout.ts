"use server";

import { placeOrder, type CheckoutInput } from "@/server/commerce/checkout";
import { recordEvent } from "@/server/analytics/events";
import { localeSchema, run } from "./helpers";

export async function placeOrderAction(input: CheckoutInput, locale: string) {
  return run(async () => {
    const l = localeSchema.parse(locale);
    const result = await placeOrder(input, l);
    recordEvent("BEGIN_CHECKOUT").catch(() => {});
    return result;
  });
}
