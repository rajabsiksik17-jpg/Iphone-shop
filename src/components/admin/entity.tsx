"use client";

import type { ReactNode } from "react";
import { Sheet } from "@/components/ui/overlay";
import { Button } from "@/components/ui/button";
import { useAdmin } from "./admin-context";
import { Label, LocalizedField, TextInput } from "./fields";
import { Switch } from "./ui";
import type { LocalizedText } from "@/lib/i18n-text";

export type SeoValue = { title: LocalizedText; description: LocalizedText; canonical: string; ogImage: string; noindex: boolean };
export const emptySeo = (): SeoValue => ({ title: {}, description: {}, canonical: "", ogImage: "", noindex: false });

export function SeoFields({ value, onChange }: { value: SeoValue; onChange: (v: SeoValue) => void }) {
  const { t } = useAdmin();
  return (
    <div className="space-y-4">
      <LocalizedField label={t("p.seoTitle")} value={value.title} onChange={(v) => onChange({ ...value, title: v })} maxLength={70} />
      <LocalizedField label={t("p.seoDescription")} value={value.description} onChange={(v) => onChange({ ...value, description: v })} multiline rows={2} maxLength={320} />
      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <Label optional>{t("p.canonical")}</Label>
          <TextInput value={value.canonical} onChange={(e) => onChange({ ...value, canonical: e.target.value })} dir="ltr" placeholder="https://" />
        </div>
        <div>
          <Label optional>{t("p.ogImage")}</Label>
          <TextInput value={value.ogImage} onChange={(e) => onChange({ ...value, ogImage: e.target.value })} dir="ltr" />
        </div>
      </div>
      <Switch checked={value.noindex} onCheckedChange={(v) => onChange({ ...value, noindex: v })} label={t("p.noindex")} />
    </div>
  );
}

/** Edit drawer used for categories, brands, attributes, coupons… (bottom sheet on phones). */
export function EditSheet({ open, onOpenChange, title, children, onSave, saving, footerExtra, wide }: { open: boolean; onOpenChange: (o: boolean) => void; title: ReactNode; children: ReactNode; onSave: () => void; saving?: boolean; footerExtra?: ReactNode; wide?: boolean }) {
  const { t } = useAdmin();
  return (
    <Sheet
      open={open}
      onOpenChange={onOpenChange}
      title={title}
      className={wide ? "w-[min(760px,100vw)] max-sm:w-full" : "w-[min(560px,100vw)] max-sm:w-full"}
      closeLabel={t("c.close")}
      footer={
        <div className="flex items-center gap-2">
          {footerExtra}
          <Button variant="outline" className="ms-auto" onClick={() => onOpenChange(false)}>
            {t("c.cancel")}
          </Button>
          <Button onClick={onSave} loading={saving}>
            {t("c.save")}
          </Button>
        </div>
      }
    >
      <div className="space-y-5 p-5">{children}</div>
    </Sheet>
  );
}

export function SectionTitle({ children }: { children: ReactNode }) {
  return <h3 className="border-t border-ad-border pt-5 text-xs font-semibold uppercase tracking-wider text-ad-muted first:border-0 first:pt-0">{children}</h3>;
}
