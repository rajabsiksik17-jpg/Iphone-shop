"use client";

import { useState } from "react";
import { ChevronDown, Copy, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAdmin } from "../admin-context";
import { Switch } from "../ui";
import { Label, TextInput, TextArea, Select, LocalizedField, ImageField, ColorInput, type MediaRef } from "../fields";
import { LocalizedRichText } from "../rich-text";
import { IconPicker } from "../icon-picker";
import { ProductPicker, type PickedProduct } from "../product-picker";
import { SortableList } from "../sortable";
import { t as tr, type LocalizedText } from "@/lib/i18n-text";
import { defaultsFor, type Field, type FieldValues } from "@/cms/fields";
import { cn } from "@/lib/utils";

export type FieldRefs = {
  categories: { id: string; name: string }[];
  brands: { id: string; name: string }[];
  sliders: { id: string; name: string }[];
  /** Product names for ids already referenced, extended as the editor picks more. */
  products: PickedProduct[];
};

/** Renders an editor form from declarative CMS field descriptors. */
export function FieldForm({ fields, value, onChange, refs, onProductsPicked }: { fields: Field[]; value: FieldValues; onChange: (v: FieldValues) => void; refs: FieldRefs; onProductsPicked?: (p: PickedProduct[]) => void }) {
  const set = (k: string, v: unknown) => onChange({ ...value, [k]: v });
  return (
    <div className="space-y-4">
      {fields.map((f) => (
        <FieldInput key={f.key} field={f} value={value[f.key]} onChange={(v) => set(f.key, v)} refs={refs} onProductsPicked={onProductsPicked} />
      ))}
    </div>
  );
}

function FieldInput({ field: f, value, onChange, refs, onProductsPicked }: { field: Field; value: unknown; onChange: (v: unknown) => void; refs: FieldRefs; onProductsPicked?: (p: PickedProduct[]) => void }) {
  const { locale, t } = useAdmin();
  const label = tr(f.label, locale);
  const help = "help" in f && f.help ? tr(f.help, locale) : undefined;
  switch (f.type) {
    case "text":
    case "textarea":
      if (f.localized === false)
        return (
          <div>
            <Label hint={help}>{label}</Label>
            {f.type === "textarea" ? (
              <TextArea rows={f.key === "html" ? 10 : 4} value={String(value ?? "")} onChange={(e) => onChange(e.target.value)} className={f.key === "html" ? "font-mono text-xs" : undefined} dir={f.key === "html" ? "ltr" : undefined} />
            ) : (
              <TextInput value={String(value ?? "")} onChange={(e) => onChange(e.target.value)} placeholder={f.placeholder} maxLength={f.max} />
            )}
          </div>
        );
      return <LocalizedField label={label} hint={help} value={(value as LocalizedText) ?? {}} onChange={onChange} multiline={f.type === "textarea"} />;
    case "richtext":
      return <LocalizedRichText label={label} value={(value as LocalizedText) ?? {}} onChange={onChange} />;
    case "number":
      return (
        <div>
          <Label hint={help}>{label}</Label>
          <TextInput type="number" min={f.min} max={f.max} step={f.step} value={value == null ? "" : String(value)} onChange={(e) => onChange(e.target.value === "" ? undefined : Number(e.target.value))} />
        </div>
      );
    case "boolean":
      return <Switch checked={Boolean(value)} onCheckedChange={onChange} label={label} description={help} />;
    case "select":
      return (
        <div>
          <Label hint={help}>{label}</Label>
          <Select value={String(value ?? f.options[0]?.value ?? "")} onChange={(e) => onChange(e.target.value)}>
            {f.options.map((o) => (
              <option key={o.value} value={o.value}>
                {tr(o.label, locale)}
              </option>
            ))}
          </Select>
        </div>
      );
    case "color":
      return (
        <div>
          <Label hint={help}>{label}</Label>
          <ColorInput value={String(value ?? "")} onChange={onChange} />
        </div>
      );
    case "image":
      return <ImageField label={label} value={(value as MediaRef) ?? null} onChange={onChange} folder="content" />;
    case "link":
      return (
        <div>
          <Label hint={help ?? (locale === "ar" ? "مسار داخلي مثل ‎/shop أو رابط https://" : "Internal path like /shop or an https:// URL")}>{label}</Label>
          <TextInput value={String(value ?? "")} onChange={(e) => onChange(e.target.value.trim())} dir="ltr" placeholder="/shop" />
        </div>
      );
    case "icon":
      return <IconPicker label={label} value={String(value ?? "")} onChange={(v) => onChange(v ?? "")} />;
    case "slider":
      return (
        <div>
          <Label>{label}</Label>
          <Select value={String(value ?? "")} onChange={(e) => onChange(e.target.value)}>
            <option value="">—</option>
            {refs.sliders.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </Select>
        </div>
      );
    case "category":
    case "brand": {
      const options = f.type === "category" ? refs.categories : refs.brands;
      if (!f.multiple)
        return (
          <div>
            <Label>{label}</Label>
            <Select value={String(value ?? "")} onChange={(e) => onChange(e.target.value)}>
              <option value="">—</option>
              {options.map((o) => (
                <option key={o.id} value={o.id}>
                  {o.name}
                </option>
              ))}
            </Select>
          </div>
        );
      const selected = (value as string[]) ?? [];
      return (
        <div>
          <Label hint={selected.length ? `${selected.length} ✓` : undefined}>{label}</Label>
          <div className="max-h-52 space-y-0.5 overflow-y-auto rounded-lg border border-ad-border p-1.5">
            {options.map((o) => (
              <label key={o.id} className="flex cursor-pointer items-center gap-2 rounded px-2 py-1 text-[13px] hover:bg-ad-hover">
                <input type="checkbox" className="accent-[var(--ad-accent)]" checked={selected.includes(o.id)} onChange={(e) => onChange(e.target.checked ? [...selected, o.id] : selected.filter((x) => x !== o.id))} />
                {o.name}
              </label>
            ))}
          </div>
        </div>
      );
    }
    case "products": {
      const ids = (value as string[]) ?? [];
      const picked = ids.map((id) => refs.products.find((p) => p.id === id) ?? { id, name: id, image: null });
      return (
        <div>
          <Label>{label}</Label>
          <ProductPicker
            value={picked}
            max={48}
            onChange={(v) => {
              onProductsPicked?.(v);
              onChange(v.map((p) => p.id));
            }}
          />
        </div>
      );
    }
    case "list":
      return <ListField field={f} value={(value as FieldValues[]) ?? []} onChange={onChange} refs={refs} onProductsPicked={onProductsPicked} addLabel={t("cms.addItem", { item: tr(f.itemLabel, locale) })} />;
  }
}

type Keyed = FieldValues & { __k: string };
let seq = 0;
const key = () => `k${Date.now().toString(36)}${(seq++).toString(36)}`;

function ListField({
  field,
  value,
  onChange,
  refs,
  onProductsPicked,
  addLabel,
}: {
  field: Extract<Field, { type: "list" }>;
  value: FieldValues[];
  onChange: (v: FieldValues[]) => void;
  refs: FieldRefs;
  onProductsPicked?: (p: PickedProduct[]) => void;
  addLabel: string;
}) {
  const { locale, t } = useAdmin();
  // Stable keys for drag-and-drop without persisting them.
  const [keys, setKeys] = useState<string[]>(() => value.map(key));
  const [open, setOpen] = useState<string | null>(null);
  if (keys.length !== value.length) setKeys(value.map((_, i) => keys[i] ?? key()));
  const items: Keyed[] = value.map((v, i) => ({ ...v, __k: keys[i] ?? String(i) }));
  const strip = (list: Keyed[]) => list.map(({ __k: _k, ...rest }) => rest);
  const max = field.max ?? 30;
  const titleOf = (v: FieldValues, i: number) => {
    const k = field.titleKey ?? field.fields.find((f) => f.type === "text")?.key;
    return (k && tr(v[k], locale)) || `${tr(field.itemLabel, locale)} ${i + 1}`;
  };

  return (
    <div>
      <Label hint={`${value.length}/${max}`}>{tr(field.label, locale)}</Label>
      <SortableList
        items={items}
        getId={(i) => i.__k}
        onChange={(list) => {
          setKeys(list.map((i) => i.__k));
          onChange(strip(list));
        }}
        className="space-y-2"
        render={(item, handle, i) => (
          <div className="rounded-xl border border-ad-border bg-ad-panel">
            <div className="flex items-center gap-1 px-2 py-1.5">
              {handle}
              <button type="button" className="flex min-w-0 flex-1 items-center gap-2 px-1 py-1 text-start text-[13px] font-medium" onClick={() => setOpen(open === item.__k ? null : item.__k)} aria-expanded={open === item.__k}>
                <span className="truncate">{titleOf(item, i)}</span>
                <ChevronDown className={cn("ms-auto size-4 shrink-0 text-ad-muted transition", open === item.__k && "rotate-180")} />
              </button>
              <Button
                size="icon-sm"
                variant="ghost"
                aria-label={t("c.duplicate")}
                disabled={value.length >= max}
                onClick={() => {
                  const next = [...value];
                  next.splice(i + 1, 0, structuredClone(value[i]));
                  const nk = [...keys];
                  nk.splice(i + 1, 0, key());
                  setKeys(nk);
                  onChange(next);
                }}
              >
                <Copy />
              </Button>
              <Button
                size="icon-sm"
                variant="ghost"
                className="text-red-600"
                aria-label={t("c.delete")}
                onClick={() => {
                  setKeys(keys.filter((_, x) => x !== i));
                  onChange(value.filter((_, x) => x !== i));
                }}
              >
                <Trash2 />
              </Button>
            </div>
            {open === item.__k && (
              <div className="border-t border-ad-border p-3">
                <FieldForm
                  fields={field.fields}
                  value={value[i]}
                  refs={refs}
                  onProductsPicked={onProductsPicked}
                  onChange={(v) => onChange(value.map((x, xi) => (xi === i ? v : x)))}
                />
              </div>
            )}
          </div>
        )}
      />
      <Button
        size="xs"
        variant="outline"
        className="mt-2"
        leftIcon={<Plus />}
        disabled={value.length >= max}
        onClick={() => {
          const k = key();
          setKeys([...keys, k]);
          setOpen(k);
          onChange([...value, defaultsFor(field.fields)]);
        }}
      >
        {addLabel}
      </Button>
    </div>
  );
}
