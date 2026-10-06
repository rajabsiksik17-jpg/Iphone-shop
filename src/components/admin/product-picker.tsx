"use client";

import { useEffect, useState } from "react";
import { Plus, X, Search } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/menu";
import { productPickerAction } from "@/actions/admin/products";
import { useAdmin } from "./admin-context";

export type PickedProduct = { id: string; name: string; image: string | null };

/** Search-and-pick list of products (relations, CMS collections, coupons). */
export function ProductPicker({ value, onChange, max = 24 }: { value: PickedProduct[]; onChange: (v: PickedProduct[]) => void; max?: number }) {
  const { t, locale } = useAdmin();
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const [results, setResults] = useState<PickedProduct[]>([]);
  useEffect(() => {
    if (!open) return;
    const h = setTimeout(async () => {
      const r = await productPickerAction(q, locale, value.map((v) => v.id));
      if (r.ok) setResults(r.data);
    }, 200);
    return () => clearTimeout(h);
  }, [q, open, locale, value]);
  return (
    <div>
      {value.length > 0 && (
        <ul className="mb-2 space-y-1.5">
          {value.map((p) => (
            <li key={p.id} className="flex items-center gap-3 rounded-lg border border-ad-border px-2.5 py-2 text-sm">
              {p.image ? <img src={p.image} alt="" className="size-8 rounded-md object-cover" /> : <span className="size-8 rounded-md bg-ad-sunken" />}
              <span className="flex-1 truncate">{p.name}</span>
              <button type="button" onClick={() => onChange(value.filter((x) => x.id !== p.id))} className="grid size-7 place-items-center rounded-md text-ad-muted hover:bg-ad-hover" aria-label={t("c.remove")}>
                <X className="size-4" />
              </button>
            </li>
          ))}
        </ul>
      )}
      {value.length < max && (
        <Popover open={open} onOpenChange={setOpen}>
          <PopoverTrigger className="flex h-9 items-center gap-2 rounded-lg border border-dashed border-ad-border px-3 text-[13px] text-ad-muted hover:bg-ad-hover">
            <Plus className="size-4" /> {t("c.add")}
          </PopoverTrigger>
          <PopoverContent className="w-[min(380px,calc(100vw-24px))] p-0">
            <div className="relative border-b border-ad-border p-2">
              <Search className="pointer-events-none absolute inset-y-0 start-5 my-auto size-4 text-ad-muted" />
              <input autoFocus value={q} onChange={(e) => setQ(e.target.value)} placeholder={t("c.searchPlaceholder")} className="h-9 w-full rounded-lg bg-ad-sunken pe-3 ps-9 text-sm outline-none" />
            </div>
            <ul className="max-h-72 overflow-y-auto p-1">
              {results.map((p) => (
                <li key={p.id}>
                  <button type="button" onClick={() => (onChange([...value, p]), setResults((r) => r.filter((x) => x.id !== p.id)))} className="flex w-full items-center gap-3 rounded-lg px-2.5 py-2 text-start text-sm hover:bg-ad-hover">
                    {p.image ? <img src={p.image} alt="" className="size-8 rounded-md object-cover" /> : <span className="size-8 rounded-md bg-ad-sunken" />}
                    <span className="flex-1 truncate">{p.name}</span>
                  </button>
                </li>
              ))}
              {!results.length && <li className="p-6 text-center text-xs text-ad-muted">{t("c.noResults")}</li>}
            </ul>
          </PopoverContent>
        </Popover>
      )}
    </div>
  );
}
