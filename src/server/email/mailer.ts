import "server-only";
import nodemailer from "nodemailer";
import { ImapFlow } from "imapflow";
import { db } from "../db";
import { env } from "../env";
import { logger } from "../logger";
import { getSettings, patchSettings } from "../settings/service";
import type { Settings } from "../settings/schemas";
import { t } from "@/lib/i18n-text";
import { localeMeta, type Locale } from "@/i18n/config";
import { emailButton, emailLayout, htmlToText, interpolate, sanitizeTemplateHtml, type HtmlBlocks, type TemplateVars } from "./render";
import { templateDef } from "./defaults";

export type MailErrorCode = "not_configured" | "auth_failed" | "timeout" | "connection_refused" | "dns" | "tls" | "rejected" | "unknown";

export type MailResult = { ok: true; messageId?: string } | { ok: false; code: MailErrorCode; message: string };

/** Map low-level transport errors to actionable categories the admin UI explains. */
export function classifyMailError(e: unknown): { code: MailErrorCode; message: string } {
  const err = e as { code?: string; responseCode?: number; message?: string; command?: string };
  const msg = err?.message ?? String(e);
  const code = err?.code ?? "";
  if (code === "EAUTH" || err?.responseCode === 535 || /auth/i.test(msg)) return { code: "auth_failed", message: "Authentication failed — check username and password." };
  if (code === "ETIMEDOUT" || /timeout|timed out/i.test(msg)) return { code: "timeout", message: "Connection timed out — check host, port and firewall." };
  if (code === "ECONNREFUSED" || code === "ECONNECTION") return { code: "connection_refused", message: "Connection refused — the server isn't accepting connections on that port." };
  if (code === "EDNS" || code === "ENOTFOUND" || /getaddrinfo/i.test(msg)) return { code: "dns", message: "Host not found — check the server hostname." };
  if (code === "ETLS" || /ssl|tls|certificate|wrong version number/i.test(msg)) return { code: "tls", message: "TLS/SSL handshake failed — check the encryption setting matches the port." };
  if (code === "EENVELOPE" || code === "EMESSAGE" || (err?.responseCode ?? 0) >= 500) return { code: "rejected", message: `The server rejected the message: ${msg}` };
  return { code: "unknown", message: msg };
}

type Smtp = Settings<"email">["smtp"];

function isConfigured(smtp: Smtp) {
  return Boolean(smtp.host && smtp.port && smtp.fromEmail);
}

function createTransport(smtp: Smtp) {
  return nodemailer.createTransport({
    host: smtp.host,
    port: smtp.port,
    secure: smtp.security === "ssl",
    requireTLS: smtp.security === "starttls",
    ignoreTLS: smtp.security === "none",
    auth: smtp.username ? { user: smtp.username, pass: smtp.password } : undefined,
    connectionTimeout: 10_000,
    greetingTimeout: 10_000,
    socketTimeout: 20_000,
  });
}

export async function testSmtp(override?: Partial<Smtp>): Promise<MailResult> {
  const smtp = { ...(await getSettings("email")).smtp, ...override };
  if (!smtp.host) return { ok: false, code: "not_configured", message: "SMTP host is not set." };
  let result: MailResult;
  try {
    await createTransport(smtp).verify();
    result = { ok: true };
  } catch (e) {
    result = { ok: false, ...classifyMailError(e) };
  }
  await patchSettings("email", {
    smtpStatus: { ok: result.ok, at: new Date().toISOString(), message: result.ok ? "Connected" : result.message, code: result.ok ? undefined : result.code },
  });
  return result;
}

export async function testImap(): Promise<MailResult> {
  const { imap } = await getSettings("email");
  if (!imap.host || !imap.username) return { ok: false, code: "not_configured", message: "IMAP host and username are required." };
  const client = new ImapFlow({
    host: imap.host,
    port: imap.port,
    secure: imap.security === "ssl",
    doSTARTTLS: imap.security === "starttls" ? true : imap.security === "none" ? false : undefined,
    auth: { user: imap.username, pass: imap.password },
    logger: false,
    connectionTimeout: 10_000,
    greetingTimeout: 10_000,
  });
  let result: MailResult;
  try {
    await client.connect();
    await client.mailboxOpen("INBOX", { readOnly: true });
    await client.logout();
    result = { ok: true };
  } catch (e) {
    const err = e as { authenticationFailed?: boolean };
    result = err?.authenticationFailed
      ? { ok: false, code: "auth_failed", message: "Authentication failed — check username and password." }
      : { ok: false, ...classifyMailError(e) };
    client.close();
  }
  await patchSettings("email", {
    imapStatus: { ok: result.ok, at: new Date().toISOString(), message: result.ok ? "Connected" : result.message, code: result.ok ? undefined : result.code },
  });
  return result;
}

export type SendOptions = {
  to: string;
  subject: string;
  html: string;
  text?: string;
  template?: string;
  orderId?: string;
  userId?: string;
  replyTo?: string;
};

/** Send and log. Never throws — callers decide how to surface failures. */
export async function sendMail(opts: SendOptions): Promise<MailResult> {
  const { smtp } = await getSettings("email");
  const log = (status: "SENT" | "FAILED" | "SKIPPED", error?: string, providerRef?: string) =>
    db.deliveryLog
      .create({
        data: {
          channel: "EMAIL",
          recipient: opts.to,
          subject: opts.subject.slice(0, 300),
          template: opts.template,
          status,
          error,
          providerRef,
          orderId: opts.orderId,
          userId: opts.userId,
        },
      })
      .catch(() => {});

  if (!isConfigured(smtp)) {
    await log("SKIPPED", "SMTP not configured");
    return { ok: false, code: "not_configured", message: "Email is not configured. Set up SMTP in Settings → Email." };
  }
  try {
    const info = await createTransport(smtp).sendMail({
      from: { name: smtp.fromName, address: smtp.fromEmail },
      to: opts.to,
      replyTo: opts.replyTo || smtp.replyTo || undefined,
      subject: opts.subject,
      html: opts.html,
      text: opts.text ?? htmlToText(opts.html),
    });
    await log("SENT", undefined, info.messageId);
    return { ok: true, messageId: info.messageId };
  } catch (e) {
    const c = classifyMailError(e);
    await log("FAILED", `${c.code}: ${c.message}`);
    logger.error("email", "Send failed", { to: opts.to, template: opts.template, code: c.code, message: c.message });
    return { ok: false, ...c };
  }
}

export type TemplateSendOptions = {
  template: string;
  to: string;
  locale: Locale | string;
  vars?: TemplateVars;
  blocks?: HtmlBlocks;
  action?: { label: string; url: string };
  orderId?: string;
  userId?: string;
  /** Skip the enabled flag (e.g. OTP & password reset must always send). */
  force?: boolean;
};

/** Render a stored (or default) template in the recipient's language and send it. */
export async function sendTemplate(opts: TemplateSendOptions): Promise<MailResult> {
  const row = await db.emailTemplate.findUnique({ where: { key: opts.template } });
  if (!row && !templateDef(opts.template)) return { ok: false, code: "unknown", message: `Unknown template ${opts.template}` };
  if (row && !row.isEnabled && !opts.force) return { ok: false, code: "not_configured", message: "Template disabled" };
  const { subject, html } = await renderTemplate(opts);
  return sendMail({ to: opts.to, subject, html, template: opts.template, orderId: opts.orderId, userId: opts.userId });
}

/**
 * Build subject + HTML for a template. `override` renders unsaved edits
 * (admin preview) through exactly the same pipeline as real sends.
 */
export async function renderTemplate(opts: Omit<TemplateSendOptions, "to"> & { override?: { subject?: string; body?: string } }) {
  const locale = (opts.locale === "en" ? "en" : "ar") as Locale;
  const [row, store, email] = await Promise.all([
    db.emailTemplate.findUnique({ where: { key: opts.template } }),
    getSettings("store"),
    getSettings("email"),
  ]);
  const def = templateDef(opts.template);

  const storeName = t(store.name, locale);
  const vars: TemplateVars = { store_name: storeName, store_url: env().APP_URL, ...opts.vars };
  const accent = email.branding.accentColor;
  const blocks: HtmlBlocks = {
    action_block: opts.action ? emailButton(opts.action.label, opts.action.url, accent) : "",
    ...opts.blocks,
  };
  const subjectTpl = opts.override?.subject ?? t(row?.subject ?? def?.subject, locale);
  const bodyTpl = sanitizeTemplateHtml(opts.override?.body ?? t(row?.body ?? def?.body, locale));
  const subject = interpolate(subjectTpl, vars, {}, false).replace(/[\r\n]+/g, " ");
  const body = interpolate(bodyTpl, vars, blocks);
  const footer =
    t(email.branding.footer, locale) ||
    (locale === "ar" ? `© ${new Date().getFullYear()} ${storeName}. جميع الحقوق محفوظة.` : `© ${new Date().getFullYear()} ${storeName}. All rights reserved.`);

  const html = emailLayout({
    dir: localeMeta[locale].dir,
    storeName,
    logoUrl: store.logoUrl ? new URL(store.logoUrl, env().APP_URL).toString() : undefined,
    accent,
    body,
    footer: interpolate(footer, vars),
    preheader: subject,
  });
  return { subject, html };
}
