import { getTranslations } from "next-intl/server";
import { ChevronDown, ListChecks } from "lucide-react";
import { ServerIcon } from "@/components/icons/server-icon";
import type { SpecGroupDTO, SpecRow } from "@/server/catalog/product";

/** Icon tiles for the attributes marked "key spec" in the admin. */
export function KeySpecs({ items, svgs }: { items: SpecRow[]; svgs: Record<string, string> }) {
  if (!items.length) return null;
  return (
    <ul className="grid grid-cols-2 gap-3 sm:grid-cols-[repeat(auto-fit,minmax(9.5rem,1fr))]">
      {items.map((s) => (
        <li key={s.label} className="group flex flex-col gap-3 rounded-2xl border border-border bg-bg p-4 transition duration-300 hover:-translate-y-0.5 hover:border-fg/15 hover:shadow-card">
          <span className="grid size-10 place-items-center rounded-xl bg-surface text-fg/80 transition group-hover:bg-accent group-hover:text-accent-fg">
            <ServerIcon value={s.icon} customSvgs={svgs} className="size-5" fallback="lucide:Sparkles" />
          </span>
          <span>
            <span className="block text-xs text-muted">{s.label}</span>
            <span className="mt-0.5 block text-[15px] font-semibold leading-snug">{s.value}</span>
          </span>
        </li>
      ))}
    </ul>
  );
}

/** Grouped specification table; groups beyond the first few fold behind "show all". */
export async function SpecsTable({ groups, svgs }: { groups: SpecGroupDTO[]; svgs: Record<string, string> }) {
  const t = await getTranslations("product");
  const visible = 3;
  const group = (g: SpecGroupDTO) => (
    <div key={g.key} className="border-t border-border first:border-t-0">
      <h3 className="flex items-center gap-2 bg-surface px-4 py-2.5 text-xs font-semibold uppercase tracking-wider text-muted">
        <ServerIcon value={g.icon} customSvgs={svgs} className="size-4" fallback="lucide:ListChecks" />
        {g.label}
      </h3>
      <dl className="divide-y divide-border">
        {g.rows.map((r) => (
          <div key={r.label} className="grid grid-cols-[minmax(0,42%)_1fr] items-start gap-3 px-4 py-3 text-sm">
            <dt className="flex items-center gap-2 text-muted">
              <ServerIcon value={r.icon} customSvgs={svgs} className="size-4 shrink-0 opacity-70" />
              <span>{r.label}</span>
            </dt>
            <dd className="font-medium">{r.value}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
  return (
    <div className="overflow-hidden rounded-card border border-border">
      {groups.slice(0, visible).map(group)}
      {groups.length > visible && (
        <details className="group/more">
          <summary className="flex cursor-pointer list-none items-center justify-center gap-2 border-t border-border px-4 py-3 text-sm font-medium transition hover:bg-surface [&::-webkit-details-marker]:hidden">
            <ListChecks className="size-4" />
            <span className="group-open/more:hidden">{t("allSpecs", { count: groups.reduce((n, g) => n + g.rows.length, 0) })}</span>
            <span className="hidden group-open/more:inline">{t("fewerSpecs")}</span>
            <ChevronDown className="size-4 transition group-open/more:rotate-180" />
          </summary>
          {groups.slice(visible).map(group)}
        </details>
      )}
    </div>
  );
}
