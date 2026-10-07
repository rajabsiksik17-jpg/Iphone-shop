"use client";

import { useState, useTransition, type ReactNode } from "react";
import { Eye, EyeOff, Star, StarOff, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { useRouter } from "@/i18n/navigation";
import { Button } from "@/components/ui/button";
import { useAdmin } from "./admin-context";
import { BulkBar, ConfirmDialog } from "./ui";
import type { ActionResult } from "@/server/errors";
import type { BulkResult } from "@/server/admin/bulk";

export type BulkOp = { key: string; label: string; icon?: ReactNode; danger?: boolean };

/**
 * Bulk action bar for any list with a selection. Safe, reversible operations
 * apply immediately; destructive ones (`danger`) ask first and say how many
 * items are affected. Items the server couldn't change are reported.
 */
export function BulkActions({
  selected,
  onClear,
  ops,
  run,
  noun,
}: {
  selected: Set<string>;
  onClear: () => void;
  ops: BulkOp[];
  run: (ids: string[], op: string) => Promise<ActionResult<BulkResult>>;
  /** e.g. { one: "category", many: "categories" } in the admin's language. */
  noun: { one: string; many: string };
}) {
  const { t, locale } = useAdmin();
  const router = useRouter();
  const [pending, start] = useTransition();
  const [confirm, setConfirm] = useState<BulkOp | null>(null);
  const ar = locale === "ar";
  const n = selected.size;
  const what = n === 1 ? noun.one : noun.many;

  const apply = (op: BulkOp) =>
    new Promise<void>((resolve) =>
      start(async () => {
        const r = await run([...selected], op.key);
        if (!r.ok) toast.error(t("c.error"));
        else {
          if (r.data.done) toast.success(ar ? `تم: ${op.label} · ${r.data.done}` : `${op.label}: ${r.data.done} ${r.data.done === 1 ? noun.one : noun.many}`);
          if (r.data.skipped.length)
            toast.error(
              ar
                ? `تعذّر تنفيذ ${r.data.skipped.length} (${[...new Set(r.data.skipped.map((s) => s.reason))].join("، ")})`
                : `${r.data.skipped.length} skipped (${[...new Set(r.data.skipped.map((s) => s.reason))].join(", ")})`,
            );
          onClear();
          router.refresh();
        }
        resolve();
      }),
    );

  return (
    <>
      <BulkBar count={n} onClear={onClear}>
        {ops.map((op) => (
          <Button key={op.key} size="xs" variant="outline" className={op.danger ? "text-red-600" : undefined} leftIcon={op.icon} loading={pending && !op.danger && !confirm} onClick={() => (op.danger ? setConfirm(op) : void apply(op))}>
            {op.label}
          </Button>
        ))}
      </BulkBar>
      <ConfirmDialog
        open={Boolean(confirm)}
        onOpenChange={(o) => !o && setConfirm(null)}
        title={ar ? `${confirm?.label} ${n} ${what}؟` : `${confirm?.label} ${n} ${what}?`}
        text={ar ? "لا يمكن التراجع عن هذا الإجراء." : "This can't be undone."}
        confirmLabel={confirm?.label}
        onConfirm={async () => {
          if (confirm) await apply(confirm);
          setConfirm(null);
        }}
      />
    </>
  );
}

/** Standard show / hide / feature / delete operations (categories, brands…). */
export function visibilityOps(locale: string, canDelete: boolean): BulkOp[] {
  const ar = locale === "ar";
  return [
    { key: "show", label: ar ? "إظهار" : "Show", icon: <Eye /> },
    { key: "hide", label: ar ? "إخفاء" : "Hide", icon: <EyeOff /> },
    { key: "feature", label: ar ? "تمييز" : "Feature", icon: <Star /> },
    { key: "unfeature", label: ar ? "إلغاء التمييز" : "Unfeature", icon: <StarOff /> },
    ...(canDelete ? [{ key: "delete", label: ar ? "حذف" : "Delete", icon: <Trash2 />, danger: true }] : []),
  ];
}

/** Small selection checkbox used in custom (non-table) lists. */
export function SelectBox({ checked, onChange, label, indeterminate, className }: { checked: boolean; onChange: () => void; label: string; indeterminate?: boolean; className?: string }) {
  return (
    <input
      type="checkbox"
      checked={checked}
      ref={(el) => {
        if (el) el.indeterminate = Boolean(indeterminate);
      }}
      onChange={onChange}
      onClick={(e) => e.stopPropagation()}
      aria-label={label}
      className={className ?? "size-4 shrink-0 accent-[var(--ad-accent)]"}
    />
  );
}
