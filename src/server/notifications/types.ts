import type { Permission } from "@/config/permissions";
import type { LocalizedText } from "@/lib/i18n-text";
import type { NotificationSeverity } from "@/generated/prisma/client";
import type { NotificationEventKey } from "../settings/schemas";

/** A rendered staff notification, independent of the channel that delivers it. */
export type StaffMessage = {
  event: NotificationEventKey;
  permission: Permission;
  title: LocalizedText;
  body: LocalizedText;
  link?: string;
  entityType?: string;
  entityId?: string;
  severity: NotificationSeverity;
  counters?: import("../realtime/emitter").CounterKey[];
};

export type ChannelResult = { channel: string; ok: boolean; skipped?: boolean; error?: string };

/**
 * A delivery channel. New channels (SMS, push, Slack…) implement this and are
 * appended to the engine's channel list — nothing else changes.
 */
export interface StaffChannel {
  key: "inApp" | "email" | "whatsapp";
  deliver(message: StaffMessage): Promise<ChannelResult>;
}
