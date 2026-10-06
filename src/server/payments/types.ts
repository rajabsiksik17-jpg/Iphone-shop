import type { IntegrationContext, IntegrationDefinition, TestResult } from "../integrations/types";

export type PaymentOrder = {
  id: string;
  number: string;
  total: number; // base minor units
  currency: string; // base currency code
  baseDecimals: number;
  email: string;
  customerName: string;
  locale: string;
  items: { name: string; quantity: number; unitPrice: number }[];
};

export type PaymentUrls = { success: string; cancel: string; webhook: string };

export type InitResult =
  /** Offline methods (COD, bank transfer): order is placed, payment collected later. */
  | { type: "offline" }
  /** Hosted payment page: redirect the shopper. */
  | { type: "redirect"; url: string; providerRef: string };

export type ConfirmResult =
  | { status: "paid"; providerRef: string; amount?: number; metadata?: Record<string, unknown> }
  | { status: "pending"; providerRef?: string }
  | { status: "failed"; message: string; providerRef?: string };

export type WebhookResult = { orderId?: string; providerRef?: string; outcome: "paid" | "failed" | "refunded" | "ignored"; message?: string };

export type PaymentProvider = IntegrationDefinition & {
  category: "payments";
  payment?: {
    /** Currencies the gateway can charge; if the base currency isn't listed, `settlementCurrency` config is used. */
    currencies?: string[];
    init(order: PaymentOrder, ctx: IntegrationContext, urls: PaymentUrls, convert: (minor: number, to: string) => { amount: number; decimals: number }): Promise<InitResult>;
    /** Called when the shopper returns from the hosted page. */
    confirm?(params: URLSearchParams, ctx: IntegrationContext, providerRef: string): Promise<ConfirmResult>;
    webhook?(req: Request, rawBody: string, ctx: IntegrationContext): Promise<WebhookResult>;
    refund?(providerRef: string, amount: number, ctx: IntegrationContext, meta: Record<string, unknown>): Promise<TestResult & { refundRef?: string }>;
  };
};
