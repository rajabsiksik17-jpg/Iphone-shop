"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { ImagePlus, Loader2, Trash2, Wand2, Eye, Copy, Plus, X, AlertCircle, ScanBarcode, History } from "lucide-react";
import { toast } from "sonner";
import { Link, useRouter } from "@/i18n/navigation";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/overlay";
import { useAdmin } from "../admin-context";
import { PageHeader, Panel, Switch, Pill, ConfirmDialog } from "../ui";
import { Label, TextInput, Select, LocalizedField, MoneyInput, uploadImage, FieldError } from "../fields";
import { LocalizedRichText } from "../rich-text";
import { ProductPicker } from "../product-picker";
import { SortableList } from "../sortable";
import { IconPreview } from "../icon-picker";
import { saveProductAction, duplicateProductAction, deleteProductsAction, stockHistoryAction } from "@/actions/admin/products";
import { slugify, cn } from "@/lib/utils";
import { fmtDate } from "@/lib/time";
import type { ProductEditorData, ProductForm } from "@/server/admin/products";
import type { FieldErrors } from "@/server/errors";

type Lists = ProductEditorData["lists"];
type Img = ProductForm["images"][number];
type Variant = Omit<ProductForm["variants"][number], "id"> & { id?: string; key: string };

const TABS = ["general", "media", "pricing", "inventory", "organization", "specs", "variants", "seo", "advanced"] as const;
type Tab = (typeof TABS)[number];

const blank = (): ProductForm => ({
  id: "",
  name: {},
  slug: "",
  sku: "",
  barcode: "",
  modelNumber: "",
  manufacturer: "",
  countryOfOrigin: "",
  condition: "NEW",
  shortDescription: {},
  description: {},
  type: "SIMPLE",
  status: "DRAFT",
  visibility: "VISIBLE",
  publishedAt: null,
  brandId: null,
  categoryIds: [],
  primaryCategoryId: null,
  tags: [],
  price: 0,
  salePrice: null,
  saleStartsAt: null,
  saleEndsAt: null,
  costPrice: null,
  trackInventory: true,
  stock: 0,
  lowStockThreshold: null,
  allowBackorder: false,
  minQty: 1,
  maxQty: null,
  requiresShipping: true,
  weightGrams: null,
  lengthMm: null,
  widthMm: null,
  heightMm: null,
  warranty: {},
  videoUrl: "",
  isFeatured: false,
  isNew: false,
  isBestSeller: false,
  isLimited: false,
  images: [],
  attributes: [],
  variants: [],
  relations: { related: [], upsell: [], crossSell: [] },
  seo: { title: {}, description: {}, canonical: "", ogImage: "", noindex: false },
  updatedAt: "",
});

const toLocalInput = (iso: string | null) => (iso ? new Date(new Date(iso).getTime() - new Date().getTimezoneOffset() * 60_000).toISOString().slice(0, 16) : "");
const fromLocalInput = (v: string) => (v ? new Date(v).toISOString() : null);

export function ProductEditor({ data }: { data: ProductEditorData }) {
  const { t, locale, money, fmt, can } = useAdmin();
  const router = useRouter();
  const lists: Lists = data.lists;
  const isNew = !data.product;
  const [p, setP] = useState<ProductForm>(data.product ?? blank());
  const [variants, setVariants] = useState<Variant[]>(() => (data.product?.variants ?? []).map((v) => ({ ...v, key: v.id })));
  const [tab, setTab] = useState<Tab>("general");
  const [errors, setErrors] = useState<FieldErrors>({});
  const [dirty, setDirty] = useState(false);
  const [pending, start] = useTransition();
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [slugTouched, setSlugTouched] = useState(!isNew);
  const symbol = money.display.symbol;
  const dec = money.base.decimals;

  const set = <K extends keyof ProductForm>(k: K, v: ProductForm[K]) => {
    setP((prev) => ({ ...prev, [k]: v }));
    setDirty(true);
  };

  useEffect(() => {
    const warn = (e: BeforeUnloadEvent) => {
      if (dirty) e.preventDefault();
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);

  // Keep the slug in step with the English name until the admin edits it.
  useEffect(() => {
    if (!slugTouched) setP((prev) => ({ ...prev, slug: slugify(prev.name.en || prev.name.ar || "") }));
  }, [p.name, slugTouched]);

  const attrById = useMemo(() => new Map(lists.attributes.map((a) => [a.id, a])), [lists.attributes]);
  const variantAttrs = p.attributes.filter((a) => a.usedForVariations);

  const save = (overrides: Partial<ProductForm> = {}) => {
    setErrors({});
    const payload = {
      ...p,
      ...overrides,
      images: p.images.map((i) => ({ mediaId: i.mediaId, valueId: i.valueId, alt: i.alt })),
      variants: p.type === "VARIABLE" ? variants.map(({ key: _k, imageUrl: _u, ...v }) => v) : [],
      relations: { related: p.relations.related.map((r) => r.id), upsell: p.relations.upsell.map((r) => r.id), crossSell: p.relations.crossSell.map((r) => r.id) },
    };
    start(async () => {
      const r = await saveProductAction(isNew ? null : p.id, payload);
      if (r.ok) {
        toast.success(t("c.saved"));
        setDirty(false);
        if (isNew) router.replace(`/admin/products/${r.data.id}`);
        else router.refresh();
      } else {
        setErrors(r.fieldErrors ?? {});
        const first = Object.keys(r.fieldErrors ?? {})[0] ?? "";
        const tabFor: Record<string, Tab> = { name: "general", sku: "inventory", salePrice: "pricing", saleEndsAt: "pricing", price: "pricing", variants: "variants", seo: "seo" };
        const target = Object.entries(tabFor).find(([k]) => first.startsWith(k))?.[1];
        if (target) setTab(target);
        toast.error(r.error === "validation" ? (locale === "ar" ? "يرجى مراجعة الحقول المحددة" : "Please check the highlighted fields") : t("c.error"));
      }
    });
  };

  const err = (k: string) => {
    const e = errors[k]?.[0];
    if (!e) return null;
    const map: Record<string, [string, string]> = {
      required: ["Required", "مطلوب"],
      sale_not_lower: ["Sale price must be lower than the regular price", "سعر التخفيض يجب أن يكون أقل من السعر الأصلي"],
      end_before_start: ["End must be after start", "النهاية يجب أن تكون بعد البداية"],
      sku_taken: ["This SKU is already used", "رمز SKU مستخدم مسبقاً"],
      variants_required: ["Add at least one active variation", "أضف خياراً نشطاً واحداً على الأقل"],
      duplicate_sku: ["Two variations share a SKU", "يوجد خياران بنفس SKU"],
    };
    const m = map[e.split(":")[0]];
    return m ? m[locale === "ar" ? 1 : 0] : e;
  };

  const margin = p.costPrice && p.price ? Math.round(((p.price - p.costPrice) / p.price) * 100) : null;

  return (
    <>
      <PageHeader
        back={{ href: "/admin/products", label: t("p.title") }}
        title={isNew ? t("p.new") : p.name[locale] || p.name.en || p.name.ar}
        description={!isNew ? `${locale === "ar" ? "آخر تعديل" : "Last updated"} ${fmtDate(p.updatedAt, locale, true)}` : undefined}
        actions={
          !isNew && (
            <>
              <Button asChild variant="outline" size="sm" leftIcon={<Eye />}>
                <a href={`/${locale}/product/${p.slug}${p.status !== "ACTIVE" ? "?preview=1" : ""}`} target="_blank" rel="noopener">
                  {t("p.viewOnStore")}
                </a>
              </Button>
              <Button variant="outline" size="sm" leftIcon={<Copy />} onClick={() => start(async () => { const r = await duplicateProductAction(p.id); if (r.ok) router.push(`/admin/products/${r.data.id}`); })}>
                {t("c.duplicate")}
              </Button>
              {can("catalog.delete") && (
                <Button variant="ghost" size="sm" className="text-red-600" leftIcon={<Trash2 />} onClick={() => setConfirmDelete(true)}>
                  {t("c.delete")}
                </Button>
              )}
            </>
          )
        }
      />

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_320px]">
        <div className="min-w-0">
          <nav className="no-scrollbar -mx-3 mb-4 flex gap-1 overflow-x-auto px-3 sm:mx-0 sm:px-0" role="tablist">
            {TABS.filter((k) => k !== "variants" || p.type === "VARIABLE").map((k) => {
              const label = { general: t("c.general"), media: t("p.media"), pricing: t("p.pricing"), inventory: t("p.inventory"), organization: t("p.organization"), specs: t("p.specs"), variants: t("p.variants"), seo: t("c.seo"), advanced: t("c.advanced") }[k];
              const hasError = Object.keys(errors).some((e) => (k === "general" && e.startsWith("name")) || (k === "pricing" && /price|sale/i.test(e)) || (k === "variants" && e.startsWith("variants")) || (k === "inventory" && e === "sku"));
              return (
                <button key={k} role="tab" aria-selected={tab === k} type="button" onClick={() => setTab(k)} className={cn("flex shrink-0 items-center gap-1.5 rounded-lg px-3 py-1.5 text-[13px] font-medium transition", tab === k ? "bg-ad-fg text-ad-panel" : "text-ad-muted hover:bg-ad-hover hover:text-ad-fg")}>
                  {label}
                  {hasError && <span className="size-1.5 rounded-full bg-red-500" />}
                </button>
              );
            })}
          </nav>

          {tab === "general" && (
            <Panel>
              <div className="space-y-5">
                <LocalizedField label={t("p.name")} value={p.name} onChange={(v) => set("name", v)} required maxLength={200} error={err("name")} />
                <div>
                  <Label hint={`/product/${p.slug || "…"}`}>{t("c.slug")}</Label>
                  <TextInput value={p.slug} onChange={(e) => (setSlugTouched(true), set("slug", slugify(e.target.value)))} dir="ltr" />
                </div>
                <LocalizedField label={t("p.short")} value={p.shortDescription} onChange={(v) => set("shortDescription", v)} multiline rows={2} maxLength={500} />
                <LocalizedRichText label={t("p.description")} value={p.description} onChange={(v) => set("description", v)} />
                <div className="grid gap-4 sm:grid-cols-2">
                  <div>
                    <Label>{t("p.condition")}</Label>
                    <Select value={p.condition} onChange={(e) => set("condition", e.target.value as ProductForm["condition"])}>
                      {["NEW", "REFURBISHED", "OPEN_BOX", "USED"].map((c) => (
                        <option key={c} value={c}>
                          {c.replace("_", " ").toLowerCase()}
                        </option>
                      ))}
                    </Select>
                  </div>
                  <div>
                    <Label>{t("p.type")}</Label>
                    <Select value={p.type} onChange={(e) => set("type", e.target.value as ProductForm["type"])}>
                      <option value="SIMPLE">{t("p.simple")}</option>
                      <option value="VARIABLE">{t("p.variable")}</option>
                    </Select>
                  </div>
                </div>
              </div>
            </Panel>
          )}

          {tab === "media" && <MediaTab p={p} set={set} lists={lists} />}

          {tab === "pricing" && (
            <Panel>
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <Label>{t("p.regularPrice")}</Label>
                  <MoneyInput value={p.price} onChange={(v) => set("price", v ?? 0)} decimals={dec} symbol={symbol} invalid={Boolean(errors.price)} />
                  <FieldError message={err("price")} />
                </div>
                <div>
                  <Label optional>{t("p.salePrice")}</Label>
                  <MoneyInput value={p.salePrice} onChange={(v) => set("salePrice", v)} decimals={dec} symbol={symbol} invalid={Boolean(errors.salePrice)} />
                  <FieldError message={err("salePrice")} />
                  {p.salePrice != null && p.price > 0 && p.salePrice < p.price && <p className="mt-1 text-xs text-emerald-600">-{Math.floor(((p.price - p.salePrice) / p.price) * 100)}% · {fmt(p.price - p.salePrice)}</p>}
                </div>
                <div>
                  <Label optional>{t("p.saleStart")}</Label>
                  <TextInput type="datetime-local" value={toLocalInput(p.saleStartsAt)} onChange={(e) => set("saleStartsAt", fromLocalInput(e.target.value))} />
                </div>
                <div>
                  <Label optional>{t("p.saleEnd")}</Label>
                  <TextInput type="datetime-local" value={toLocalInput(p.saleEndsAt)} onChange={(e) => set("saleEndsAt", fromLocalInput(e.target.value))} />
                  <FieldError message={err("saleEndsAt")} />
                </div>
                <div>
                  <Label optional hint={locale === "ar" ? "غير ظاهر للعملاء" : "Never shown to customers"}>
                    {t("p.costPrice")}
                  </Label>
                  <MoneyInput value={p.costPrice} onChange={(v) => set("costPrice", v)} decimals={dec} symbol={symbol} />
                  {margin != null && <p className={cn("mt-1 text-xs", margin < 10 ? "text-amber-600" : "text-ad-muted")}>{t("p.margin", { pct: margin })}</p>}
                </div>
              </div>
              {p.type === "VARIABLE" && <p className="mt-4 rounded-lg bg-ad-sunken p-3 text-xs text-ad-muted">{locale === "ar" ? "هذه الأسعار افتراضية للخيارات التي لا تحدد سعرها الخاص." : "These are defaults for variations that don't set their own price."}</p>}
            </Panel>
          )}

          {tab === "inventory" && <InventoryTab p={p} set={set} err={err} />}

          {tab === "organization" && <OrganizationTab p={p} set={set} lists={lists} />}

          {tab === "specs" && <SpecsTab p={p} set={set} lists={lists} />}

          {tab === "variants" && p.type === "VARIABLE" && (
            <VariantsTab
              p={p}
              set={set}
              lists={lists}
              variants={variants}
              setVariants={(v) => {
                setVariants(v);
                setDirty(true);
              }}
              error={err("variants")}
            />
          )}

          {tab === "seo" && (
            <Panel>
              <div className="space-y-5">
                <SerpPreview title={p.seo.title[locale] || p.name[locale] || ""} description={p.seo.description[locale] || p.shortDescription[locale] || ""} url={`/${locale}/product/${p.slug}`} />
                <LocalizedField label={t("p.seoTitle")} value={p.seo.title} onChange={(v) => set("seo", { ...p.seo, title: v })} maxLength={70} hint={t("p.chars", { n: (p.seo.title[locale] ?? "").length, max: 60 })} />
                <LocalizedField label={t("p.seoDescription")} value={p.seo.description} onChange={(v) => set("seo", { ...p.seo, description: v })} multiline rows={2} maxLength={320} hint={t("p.chars", { n: (p.seo.description[locale] ?? "").length, max: 160 })} />
                <div className="grid gap-4 sm:grid-cols-2">
                  <div>
                    <Label optional>{t("p.canonical")}</Label>
                    <TextInput value={p.seo.canonical} onChange={(e) => set("seo", { ...p.seo, canonical: e.target.value })} dir="ltr" placeholder="https://" />
                  </div>
                  <div>
                    <Label optional>{t("p.ogImage")}</Label>
                    <TextInput value={p.seo.ogImage} onChange={(e) => set("seo", { ...p.seo, ogImage: e.target.value })} dir="ltr" />
                  </div>
                </div>
                <Switch checked={p.seo.noindex} onCheckedChange={(v) => set("seo", { ...p.seo, noindex: v })} label={t("p.noindex")} />
              </div>
            </Panel>
          )}

          {tab === "advanced" && (
            <div className="space-y-4">
              <Panel title={t("p.shipping")}>
                <div className="space-y-4">
                  <Switch checked={p.requiresShipping} onCheckedChange={(v) => set("requiresShipping", v)} label={t("p.requiresShipping")} />
                  <div className="grid gap-4 sm:grid-cols-4">
                    <div>
                      <Label optional>{t("p.weight")}</Label>
                      <TextInput type="number" min={0} value={p.weightGrams ?? ""} onChange={(e) => set("weightGrams", e.target.value ? Number(e.target.value) : null)} />
                    </div>
                    {(["lengthMm", "widthMm", "heightMm"] as const).map((k) => (
                      <div key={k}>
                        <Label optional>{k.replace("Mm", "")} (mm)</Label>
                        <TextInput type="number" min={0} value={p[k] ?? ""} onChange={(e) => set(k, e.target.value ? Number(e.target.value) : null)} />
                      </div>
                    ))}
                  </div>
                </div>
              </Panel>
              <Panel title={t("p.related")}>
                <div className="grid gap-6 lg:grid-cols-3">
                  {(
                    [
                      ["related", t("p.related")],
                      ["upsell", t("p.upsells")],
                      ["crossSell", t("p.crossSells")],
                    ] as const
                  ).map(([k, label]) => (
                    <div key={k}>
                      <Label>{label}</Label>
                      <ProductPicker value={p.relations[k]} onChange={(v) => set("relations", { ...p.relations, [k]: v })} max={k === "crossSell" ? 6 : 12} />
                    </div>
                  ))}
                </div>
              </Panel>
              <Panel title={t("p.warranty")}>
                <LocalizedField label={t("p.warranty")} value={p.warranty} onChange={(v) => set("warranty", v)} />
                <div className="mt-4">
                  <Label optional>{t("p.video")}</Label>
                  <TextInput value={p.videoUrl} onChange={(e) => set("videoUrl", e.target.value)} dir="ltr" placeholder="https://youtube.com/watch?v=…" />
                </div>
              </Panel>
            </div>
          )}
        </div>

        <aside className="space-y-4 xl:sticky xl:top-20 xl:self-start">
          <Panel title={t("c.status")}>
            <div className="space-y-4">
              <Select value={p.status} onChange={(e) => set("status", e.target.value as ProductForm["status"])}>
                <option value="DRAFT">{t("c.draft")}</option>
                <option value="ACTIVE">{t("c.published")}</option>
                <option value="ARCHIVED">{t("c.archived")}</option>
              </Select>
              <div>
                <Label>{t("p.visibility")}</Label>
                <Select value={p.visibility} onChange={(e) => set("visibility", e.target.value as ProductForm["visibility"])}>
                  {(["VISIBLE", "CATALOG_ONLY", "SEARCH_ONLY", "HIDDEN"] as const).map((v) => (
                    <option key={v} value={v}>
                      {t(`p.vis.${v}`)}
                    </option>
                  ))}
                </Select>
              </div>
              <div>
                <Label optional>{t("p.publishAt")}</Label>
                <TextInput type="datetime-local" value={toLocalInput(p.publishedAt)} onChange={(e) => set("publishedAt", fromLocalInput(e.target.value))} />
              </div>
            </div>
          </Panel>
          <Panel title={t("p.flags")}>
            <div className="space-y-2.5">
              <Switch checked={p.isFeatured} onCheckedChange={(v) => set("isFeatured", v)} label={t("p.isFeatured")} />
              <Switch checked={p.isNew} onCheckedChange={(v) => set("isNew", v)} label={t("p.isNew")} />
              <Switch checked={p.isBestSeller} onCheckedChange={(v) => set("isBestSeller", v)} label={t("p.isBestSeller")} />
              <Switch checked={p.isLimited} onCheckedChange={(v) => set("isLimited", v)} label={t("p.isLimited")} />
            </div>
          </Panel>
          {p.images[0] && (
            <Panel padded={false}>
              <img src={p.images[0].url} alt="" className="aspect-square w-full rounded-xl object-cover" />
            </Panel>
          )}
        </aside>
      </div>

      {/* Sticky save bar (always reachable, including on phones above the quick bar). */}
      <div className={cn("fixed inset-x-3 bottom-20 z-30 mx-auto flex max-w-2xl items-center gap-3 rounded-2xl border border-ad-border bg-ad-panel p-2.5 ps-4 shadow-pop transition lg:bottom-6", dirty || isNew ? "translate-y-0 opacity-100" : "pointer-events-none translate-y-4 opacity-0")}>
        <span className="flex min-w-0 flex-1 items-center gap-2 text-sm">
          <AlertCircle className="size-4 shrink-0 text-amber-500" /> <span className="truncate max-sm:sr-only">{t("c.unsaved")}</span>
        </span>
        {!isNew && (
          <Button variant="ghost" size="sm" onClick={() => (setP(data.product!), setVariants(data.product!.variants.map((v) => ({ ...v, key: v.id }))), setDirty(false))}>
            {t("c.discard")}
          </Button>
        )}
        <Button size="sm" loading={pending} onClick={() => save()}>
          {t("c.save")}
        </Button>
      </div>

      <ConfirmDialog
        open={confirmDelete}
        onOpenChange={setConfirmDelete}
        title={t("c.confirmDelete")}
        text={t("p.deleteHasOrders")}
        confirmLabel={t("c.delete")}
        onConfirm={async () => {
          const r = await deleteProductsAction([p.id]);
          if (r.ok) {
            setDirty(false);
            router.push("/admin/products");
          }
        }}
      />
    </>
  );
}

function SerpPreview({ title, description, url }: { title: string; description: string; url: string }) {
  const { t } = useAdmin();
  return (
    <div className="rounded-lg border border-ad-border p-4">
      <p className="mb-2 text-xs font-medium text-ad-muted">{t("p.serpPreview")}</p>
      <p className="truncate text-xs text-emerald-700 dark:text-emerald-400" dir="ltr">
        {typeof window !== "undefined" ? window.location.origin : ""}
        {url}
      </p>
      <p className="mt-0.5 truncate text-lg text-blue-700 dark:text-blue-400">{title.slice(0, 65) || "—"}</p>
      <p className="line-clamp-2 text-[13px] text-ad-muted">{description.replace(/<[^>]+>/g, "").slice(0, 160)}</p>
    </div>
  );
}

type SetFn = <K extends keyof ProductForm>(k: K, v: ProductForm[K]) => void;

function MediaTab({ p, set, lists }: { p: ProductForm; set: SetFn; lists: Lists }) {
  const { t, locale } = useAdmin();
  const input = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(0);
  const colorAttr = lists.attributes.find((a) => a.type === "COLOR");
  const colorValues = colorAttr ? p.attributes.find((a) => a.attributeId === colorAttr.id)?.valueIds ?? [] : [];
  const handle = async (files: FileList | File[]) => {
    const list = [...files].slice(0, 20);
    setUploading(list.length);
    const added: Img[] = [];
    for (const f of list) {
      const r = await uploadImage(f, "products");
      if (r) added.push({ mediaId: r.id, url: r.url, valueId: null, alt: {} });
      setUploading((n) => n - 1);
    }
    set("images", [...p.images, ...added]);
  };
  return (
    <Panel title={t("p.media")} description={locale === "ar" ? "اسحب لإعادة الترتيب — الصورة الأولى هي الرئيسية. اربط الصور بلون ليتبدل المعرض عند اختياره." : "Drag to reorder — the first image is the main one. Link images to a colour so the gallery switches when it's picked."}>
      <SortableList
        layout="grid"
        className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4"
        items={p.images}
        getId={(i) => i.mediaId}
        onChange={(v) => set("images", v)}
        render={(img, handleEl, i) => (
          <div className="group overflow-hidden rounded-xl border border-ad-border bg-ad-panel">
            <div className="relative aspect-square bg-ad-sunken">
              <img src={img.url} alt="" className="size-full object-cover" />
              {i === 0 && <span className="absolute start-2 top-2 rounded-md bg-ad-fg px-1.5 py-0.5 text-[10px] font-semibold text-ad-panel">{locale === "ar" ? "رئيسية" : "Main"}</span>}
              <div className="absolute end-1.5 top-1.5 flex gap-1 rounded-lg bg-ad-panel/90 p-0.5 backdrop-blur">
                {handleEl}
                <button type="button" onClick={() => set("images", p.images.filter((x) => x.mediaId !== img.mediaId))} className="grid size-8 place-items-center rounded-md text-red-600 hover:bg-ad-hover" aria-label={t("c.remove")}>
                  <Trash2 className="size-4" />
                </button>
              </div>
            </div>
            {colorAttr && colorValues.length > 0 && (
              <select value={img.valueId ?? ""} onChange={(e) => set("images", p.images.map((x) => (x.mediaId === img.mediaId ? { ...x, valueId: e.target.value || null } : x)))} className="w-full border-t border-ad-border bg-ad-panel px-2 py-1.5 text-xs outline-none" aria-label={t("c.color")}>
                <option value="">{t("c.color")}: —</option>
                {colorAttr.values
                  .filter((v) => colorValues.includes(v.id))
                  .map((v) => (
                    <option key={v.id} value={v.id}>
                      {v.label}
                    </option>
                  ))}
              </select>
            )}
          </div>
        )}
      />
      <button
        type="button"
        onClick={() => input.current?.click()}
        onDragOver={(e) => e.preventDefault()}
        onDrop={(e) => (e.preventDefault(), void handle(e.dataTransfer.files))}
        className="mt-3 flex w-full flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-ad-border py-8 text-sm text-ad-muted transition hover:bg-ad-hover"
      >
        {uploading ? <Loader2 className="size-6 animate-spin" /> : <ImagePlus className="size-6" />}
        {uploading ? `${t("c.uploading")} (${uploading})` : t("c.dropHere")}
      </button>
      <input ref={input} type="file" multiple accept="image/jpeg,image/png,image/webp,image/avif" hidden onChange={(e) => (e.target.files && void handle(e.target.files), (e.target.value = ""))} />
    </Panel>
  );
}

function InventoryTab({ p, set, err }: { p: ProductForm; set: SetFn; err: (k: string) => string | null }) {
  const { t, locale, can } = useAdmin();
  const [history, setHistory] = useState<Awaited<ReturnType<typeof stockHistoryAction>> | null>(null);
  const [scanOpen, setScanOpen] = useState(false);
  return (
    <div className="space-y-4">
      <Panel>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <Label>{t("p.sku")}</Label>
            <TextInput value={p.sku} onChange={(e) => set("sku", e.target.value.toUpperCase())} dir="ltr" invalid={Boolean(err("sku"))} />
            <FieldError message={err("sku")} />
          </div>
          <div>
            <Label optional>{t("p.barcode")}</Label>
            <div className="flex gap-2">
              <TextInput value={p.barcode} onChange={(e) => set("barcode", e.target.value)} dir="ltr" inputMode="numeric" />
              <Button variant="outline" size="icon" className="size-10 shrink-0" onClick={() => setScanOpen(true)} aria-label={t("p.scan")}>
                <ScanBarcode />
              </Button>
            </div>
          </div>
          <div>
            <Label optional>{t("p.model")}</Label>
            <TextInput value={p.modelNumber} onChange={(e) => set("modelNumber", e.target.value)} dir="ltr" />
          </div>
          <div>
            <Label optional>{t("p.manufacturer")}</Label>
            <TextInput value={p.manufacturer} onChange={(e) => set("manufacturer", e.target.value)} />
          </div>
          <div>
            <Label optional hint="ISO (JO, US, CN…)">
              {t("p.origin")}
            </Label>
            <TextInput value={p.countryOfOrigin} onChange={(e) => set("countryOfOrigin", e.target.value.toUpperCase().slice(0, 2))} maxLength={2} dir="ltr" />
          </div>
        </div>
      </Panel>
      <Panel title={t("p.stock")}>
        <div className="space-y-4">
          <Switch checked={p.trackInventory} onCheckedChange={(v) => set("trackInventory", v)} label={t("p.trackInventory")} />
          {p.trackInventory && (
            <div className="grid gap-4 sm:grid-cols-2">
              {p.type === "SIMPLE" ? (
                <div>
                  <Label hint={locale === "ar" ? "يُسجل التغيير في سجل المخزون" : "Changes are recorded in the stock history"}>{t("p.stock")}</Label>
                  <TextInput type="number" value={p.stock} onChange={(e) => set("stock", Number(e.target.value) || 0)} />
                </div>
              ) : (
                <p className="rounded-lg bg-ad-sunken p-3 text-xs text-ad-muted sm:col-span-2">{locale === "ar" ? "مخزون المنتجات ذات الخيارات يُدار لكل خيار في تبويب الخيارات." : "Stock for products with variations is managed per variation."}</p>
              )}
              <div>
                <Label optional>{t("p.lowStockThreshold")}</Label>
                <TextInput type="number" min={0} value={p.lowStockThreshold ?? ""} onChange={(e) => set("lowStockThreshold", e.target.value ? Number(e.target.value) : null)} placeholder={locale === "ar" ? "الافتراضي للمتجر" : "Store default"} />
              </div>
              <div className="sm:col-span-2">
                <Switch checked={p.allowBackorder} onCheckedChange={(v) => set("allowBackorder", v)} label={t("p.allowBackorder")} />
              </div>
            </div>
          )}
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <Label>{t("p.minQty")}</Label>
              <TextInput type="number" min={1} value={p.minQty} onChange={(e) => set("minQty", Math.max(1, Number(e.target.value) || 1))} />
            </div>
            <div>
              <Label optional>{t("p.maxQty")}</Label>
              <TextInput type="number" min={1} value={p.maxQty ?? ""} onChange={(e) => set("maxQty", e.target.value ? Number(e.target.value) : null)} />
            </div>
          </div>
        </div>
      </Panel>
      {p.id && can("inventory.manage") && (
        <Panel
          title={t("inv.history")}
          actions={
            !history && (
              <Button size="xs" variant="outline" leftIcon={<History />} onClick={async () => setHistory(await stockHistoryAction(p.id))}>
                {t("c.view")}
              </Button>
            )
          }
        >
          {history?.ok ? (
            <ul className="divide-y divide-ad-border text-[13px]">
              {history.data.map((h) => (
                <li key={h.id} className="flex items-center justify-between gap-3 py-2">
                  <span>
                    {t(`inv.reason.${h.reason}` as "inv.reason.ORDER")}
                    {h.variant && <span className="text-ad-muted"> · {h.variant}</span>}
                    {h.note && <span className="text-ad-muted"> · {h.note}</span>}
                  </span>
                  <span className="flex items-center gap-3">
                    <span className={cn("tabular font-medium", h.delta > 0 ? "text-emerald-600" : "text-red-600")}>
                      {h.delta > 0 ? "+" : ""}
                      {h.delta}
                    </span>
                    <span className="tabular w-10 text-end text-ad-muted">{h.balance}</span>
                    <span className="hidden w-32 text-end text-xs text-ad-muted sm:block">{fmtDate(h.at, locale, true)}</span>
                  </span>
                </li>
              ))}
              {!history.data.length && <li className="py-4 text-center text-ad-muted">{t("c.empty")}</li>}
            </ul>
          ) : (
            <p className="text-xs text-ad-muted">{locale === "ar" ? "كل تغيير على المخزون (طلبات، تعديلات، إرجاع) مسجل هنا." : "Every stock change (orders, adjustments, returns) is recorded here."}</p>
          )}
        </Panel>
      )}
      <BarcodeScanner open={scanOpen} onOpenChange={setScanOpen} onResult={(code) => (set("barcode", code), setScanOpen(false))} />
    </div>
  );
}

/** Camera barcode scanning via the native BarcodeDetector API (Chrome/Android/Safari 17+). */
function BarcodeScanner({ open, onOpenChange, onResult }: { open: boolean; onOpenChange: (o: boolean) => void; onResult: (code: string) => void }) {
  const { t } = useAdmin();
  const video = useRef<HTMLVideoElement>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    if (!open) return;
    let stream: MediaStream | null = null;
    let raf = 0;
    const Detector = (window as unknown as { BarcodeDetector?: new (o: { formats: string[] }) => { detect: (v: HTMLVideoElement) => Promise<{ rawValue: string }[]> } }).BarcodeDetector;
    if (!Detector) {
      setError(t("p.scanUnsupported"));
      return;
    }
    const detector = new Detector({ formats: ["ean_13", "ean_8", "upc_a", "upc_e", "code_128", "qr_code"] });
    navigator.mediaDevices
      .getUserMedia({ video: { facingMode: "environment" } })
      .then((s) => {
        stream = s;
        if (video.current) {
          video.current.srcObject = s;
          void video.current.play();
        }
        const tick = async () => {
          if (video.current?.readyState === 4) {
            const codes = await detector.detect(video.current).catch(() => []);
            if (codes[0]?.rawValue) return onResult(codes[0].rawValue);
          }
          raf = requestAnimationFrame(tick);
        };
        tick();
      })
      .catch(() => setError("Camera unavailable"));
    return () => {
      cancelAnimationFrame(raf);
      stream?.getTracks().forEach((tr) => tr.stop());
    };
  }, [open, onResult, t]);
  return (
    <Modal open={open} onOpenChange={onOpenChange} title={t("p.scan")}>
      {error ? <p className="text-sm text-ad-muted">{error}</p> : <video ref={video} className="aspect-video w-full rounded-lg bg-black object-cover" muted playsInline />}
    </Modal>
  );
}

function OrganizationTab({ p, set, lists }: { p: ProductForm; set: SetFn; lists: Lists }) {
  const { t, locale } = useAdmin();
  const [tag, setTag] = useState("");
  const [filter, setFilter] = useState("");
  return (
    <div className="space-y-4">
      <Panel title={t("p.brand")}>
        <Select value={p.brandId ?? ""} onChange={(e) => set("brandId", e.target.value || null)}>
          <option value="">{t("c.none")}</option>
          {lists.brands.map((b) => (
            <option key={b.id} value={b.id}>
              {b.name}
            </option>
          ))}
        </Select>
      </Panel>
      <Panel title={t("p.categories")} description={locale === "ar" ? "يمكن للمنتج أن ينتمي لعدة تصنيفات. التصنيف الرئيسي يحدد مسار التنقل والرابط." : "A product can belong to several categories. The primary one drives breadcrumbs."}>
        <TextInput value={filter} onChange={(e) => setFilter(e.target.value)} placeholder={t("c.searchPlaceholder")} className="mb-2" />
        <ul className="max-h-80 space-y-0.5 overflow-y-auto rounded-lg border border-ad-border p-1.5">
          {lists.categories
            .filter((c) => !filter || c.name.toLowerCase().includes(filter.toLowerCase()))
            .map((c) => {
              const checked = p.categoryIds.includes(c.id);
              return (
                <li key={c.id} className="flex items-center gap-2 rounded-md px-2 py-1.5 hover:bg-ad-hover" style={{ paddingInlineStart: `${8 + c.depth * 18}px` }}>
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={() => {
                      const next = checked ? p.categoryIds.filter((x) => x !== c.id) : [...p.categoryIds, c.id];
                      set("categoryIds", next);
                      if (!checked && !p.primaryCategoryId) set("primaryCategoryId", c.id);
                      if (checked && p.primaryCategoryId === c.id) set("primaryCategoryId", next[0] ?? null);
                    }}
                    className="size-4 accent-[var(--ad-accent)]"
                    id={`cat-${c.id}`}
                  />
                  <label htmlFor={`cat-${c.id}`} className="flex-1 cursor-pointer text-sm">
                    {c.name}
                  </label>
                  {checked && (
                    <button type="button" onClick={() => set("primaryCategoryId", c.id)} className={cn("rounded px-1.5 py-0.5 text-[10.5px] font-medium", p.primaryCategoryId === c.id ? "bg-ad-accent text-ad-accent-fg" : "text-ad-muted hover:bg-ad-sunken")}>
                      {t("p.primaryCategory")}
                    </button>
                  )}
                </li>
              );
            })}
        </ul>
      </Panel>
      <Panel title={t("p.tags")}>
        <div className="flex flex-wrap gap-1.5">
          {p.tags.map((tg) => (
            <span key={tg} className="flex items-center gap-1 rounded-full bg-ad-sunken py-1 pe-1.5 ps-2.5 text-xs">
              {tg}
              <button type="button" onClick={() => set("tags", p.tags.filter((x) => x !== tg))} aria-label={t("c.remove")}>
                <X className="size-3" />
              </button>
            </span>
          ))}
        </div>
        <form
          className="mt-2 flex gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            const v = tag.trim();
            if (v && !p.tags.includes(v)) set("tags", [...p.tags, v]);
            setTag("");
          }}
        >
          <TextInput value={tag} onChange={(e) => setTag(e.target.value)} placeholder={locale === "ar" ? "أضف وسماً واضغط Enter" : "Add a tag and press Enter"} />
          <Button type="submit" variant="outline" size="sm" className="h-10">
            {t("c.add")}
          </Button>
        </form>
      </Panel>
    </div>
  );
}

function SpecsTab({ p, set, lists }: { p: ProductForm; set: SetFn; lists: Lists }) {
  const { t, locale } = useAdmin();
  const [adding, setAdding] = useState("");
  const used = new Set(p.attributes.map((a) => a.attributeId));
  const update = (attributeId: string, patch: Partial<ProductForm["attributes"][number]>) => set("attributes", p.attributes.map((a) => (a.attributeId === attributeId ? { ...a, ...patch } : a)));
  return (
    <Panel
      title={t("p.specs")}
      description={locale === "ar" ? "المواصفات تُعرض مجمعة بأيقونات في صفحة المنتج، والقابلة للفلترة تظهر في فلاتر المتجر." : "Specifications are shown grouped with icons on the product page; filterable ones feed the shop filters."}
      actions={
        <Link href="/admin/attributes" className="text-xs text-ad-muted hover:text-ad-fg">
          {t("nav.attributes")} →
        </Link>
      }
    >
      <ul className="space-y-3">
        {p.attributes.map((a) => {
          const def = lists.attributes.find((x) => x.id === a.attributeId);
          if (!def) return null;
          return (
            <li key={a.attributeId} className="rounded-lg border border-ad-border p-3">
              <div className="mb-2 flex items-center gap-2">
                <span className="grid size-7 place-items-center rounded-md bg-ad-sunken">
                  <IconPreview value={def.icon} className="size-4" />
                </span>
                <span className="text-sm font-medium">{def.name}</span>
                {def.group && <span className="text-xs text-ad-muted">· {def.group}</span>}
                {a.usedForVariations && <Pill tone="violet">{t("p.variants")}</Pill>}
                <button type="button" onClick={() => set("attributes", p.attributes.filter((x) => x.attributeId !== a.attributeId))} className="ms-auto grid size-7 place-items-center rounded-md text-ad-muted hover:bg-ad-hover hover:text-red-600" aria-label={t("c.remove")}>
                  <X className="size-4" />
                </button>
              </div>
              {def.type === "TEXT" ? (
                <LocalizedField label={def.name} value={a.textValue} onChange={(v) => update(a.attributeId, { textValue: v })} />
              ) : def.type === "NUMBER" ? (
                <TextInput type="number" value={a.numberValue ?? ""} onChange={(e) => update(a.attributeId, { numberValue: e.target.value ? Number(e.target.value) : null })} />
              ) : def.type === "BOOLEAN" ? (
                <Switch checked={Boolean(a.boolValue)} onCheckedChange={(v) => update(a.attributeId, { boolValue: v })} label={def.name} />
              ) : (
                <div className="flex flex-wrap gap-1.5">
                  {def.values.map((v) => {
                    const on = a.valueIds.includes(v.id);
                    return (
                      <button
                        key={v.id}
                        type="button"
                        onClick={() => update(a.attributeId, { valueIds: on ? a.valueIds.filter((x) => x !== v.id) : def.type === "SELECT" && !a.usedForVariations ? [v.id] : [...a.valueIds, v.id] })}
                        className={cn("flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs transition", on ? "border-ad-accent bg-ad-accent/10 text-ad-fg" : "border-ad-border text-ad-muted hover:border-ad-muted")}
                      >
                        {v.colorHex && <span className="size-3 rounded-full ring-1 ring-black/10" style={{ backgroundColor: v.colorHex }} />}
                        {v.label}
                      </button>
                    );
                  })}
                </div>
              )}
              {def.isVariantOption && p.type === "VARIABLE" && (
                <div className="mt-2">
                  <Switch checked={a.usedForVariations} onCheckedChange={(v) => update(a.attributeId, { usedForVariations: v })} label={locale === "ar" ? "استخدام لإنشاء الخيارات" : "Use for variations"} />
                </div>
              )}
            </li>
          );
        })}
      </ul>
      <div className="mt-4 flex gap-2">
        <Select value={adding} onChange={(e) => setAdding(e.target.value)} className="flex-1">
          <option value="">{t("p.addAttribute")}…</option>
          {lists.attributes
            .filter((a) => !used.has(a.id))
            .map((a) => (
              <option key={a.id} value={a.id}>
                {a.group ? `${a.group} · ` : ""}
                {a.name}
              </option>
            ))}
        </Select>
        <Button
          variant="outline"
          className="h-10"
          disabled={!adding}
          leftIcon={<Plus />}
          onClick={() => {
            const def = lists.attributes.find((x) => x.id === adding);
            set("attributes", [...p.attributes, { attributeId: adding, usedForVariations: Boolean(def?.isVariantOption && p.type === "VARIABLE"), valueIds: [], textValue: {}, numberValue: null, boolValue: null }]);
            setAdding("");
          }}
        >
          {t("c.add")}
        </Button>
      </div>
    </Panel>
  );
}

function VariantsTab({ p, set, lists, variants, setVariants, error }: { p: ProductForm; set: SetFn; lists: Lists; variants: Variant[]; setVariants: (v: Variant[]) => void; error: string | null }) {
  const { t, locale, money } = useAdmin();
  const optionAttrs = p.attributes.filter((a) => a.usedForVariations);
  const [bulkPrice, setBulkPrice] = useState<number | null>(null);
  const [bulkStock, setBulkStock] = useState("");
  const candidates = lists.attributes.filter((a) => a.isVariantOption && !p.attributes.some((x) => x.attributeId === a.id));
  const valueLabel = (attrId: string, valueId: string) => lists.attributes.find((a) => a.id === attrId)?.values.find((v) => v.id === valueId);

  const generate = () => {
    const axes = optionAttrs.filter((a) => a.valueIds.length).map((a) => a.valueIds.map((v) => [a.attributeId, v] as const));
    if (!axes.length) return;
    const combos = axes.reduce<(readonly [string, string])[][]>((acc, axis) => acc.flatMap((c) => axis.map((x) => [...c, x])), [[]]);
    const existing = new Set(variants.map((v) => JSON.stringify(Object.entries(v.options).sort())));
    const added = combos
      .map((c) => Object.fromEntries(c))
      .filter((o) => !existing.has(JSON.stringify(Object.entries(o).sort())))
      .map((options, i) => ({
        key: `new-${Date.now()}-${i}`,
        sku: p.sku ? `${p.sku}-${Object.values(options).map((v) => (valueLabel(Object.keys(options).find((k) => options[k] === v)!, v)?.label ?? "").toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 10)).join("-")}` : "",
        barcode: "",
        price: null,
        salePrice: null,
        stock: 0,
        weightGrams: null,
        imageId: null,
        imageUrl: null,
        isActive: true,
        options,
      }));
    setVariants([...variants, ...added]);
    toast.success(locale === "ar" ? `تمت إضافة ${added.length} خيارات` : `${added.length} variations added`);
  };

  const update = (key: string, patch: Partial<Variant>) => setVariants(variants.map((v) => (v.key === key ? { ...v, ...patch } : v)));

  return (
    <div className="space-y-4">
      <Panel title={t("p.variantOptions")} description={t("p.generateHint")}>
        {optionAttrs.length === 0 && <p className="mb-3 text-sm text-ad-muted">{locale === "ar" ? "أضف خاصية (مثل اللون أو السعة) لاستخدامها في الخيارات:" : "Add an option attribute (e.g. Colour, Storage):"}</p>}
        <ul className="space-y-3">
          {optionAttrs.map((a) => {
            const def = lists.attributes.find((x) => x.id === a.attributeId)!;
            return (
              <li key={a.attributeId}>
                <p className="mb-1.5 text-sm font-medium">{def.name}</p>
                <div className="flex flex-wrap gap-1.5">
                  {def.values.map((v) => {
                    const on = a.valueIds.includes(v.id);
                    return (
                      <button
                        key={v.id}
                        type="button"
                        onClick={() => set("attributes", p.attributes.map((x) => (x.attributeId === a.attributeId ? { ...x, valueIds: on ? x.valueIds.filter((y) => y !== v.id) : [...x.valueIds, v.id] } : x)))}
                        className={cn("flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs", on ? "border-ad-accent bg-ad-accent/10" : "border-ad-border text-ad-muted")}
                      >
                        {v.colorHex && <span className="size-3 rounded-full ring-1 ring-black/10" style={{ backgroundColor: v.colorHex }} />}
                        {v.label}
                      </button>
                    );
                  })}
                </div>
              </li>
            );
          })}
        </ul>
        <div className="mt-4 flex flex-wrap gap-2">
          {candidates.map((c) => (
            <Button key={c.id} size="xs" variant="outline" leftIcon={<Plus />} onClick={() => set("attributes", [...p.attributes, { attributeId: c.id, usedForVariations: true, valueIds: [], textValue: {}, numberValue: null, boolValue: null }])}>
              {c.name}
            </Button>
          ))}
          <Button size="xs" leftIcon={<Wand2 />} onClick={generate} disabled={!optionAttrs.some((a) => a.valueIds.length)} className="ms-auto">
            {t("p.generate")}
          </Button>
        </div>
      </Panel>

      <Panel
        title={`${t("p.variants")} (${variants.length})`}
        padded={false}
        actions={
          variants.length > 0 && (
            <div className="hidden items-center gap-1.5 md:flex">
              <div className="w-28">
                <MoneyInput value={bulkPrice} onChange={setBulkPrice} decimals={money.base.decimals} symbol={money.display.symbol} placeholder={t("p.price")} />
              </div>
              <Button size="xs" variant="outline" disabled={bulkPrice == null} onClick={() => setVariants(variants.map((v) => ({ ...v, price: bulkPrice })))}>
                {t("p.bulkPrice")}
              </Button>
              <TextInput className="h-8 w-20" type="number" value={bulkStock} onChange={(e) => setBulkStock(e.target.value)} placeholder={t("p.stock")} />
              <Button size="xs" variant="outline" disabled={bulkStock === ""} onClick={() => setVariants(variants.map((v) => ({ ...v, stock: Number(bulkStock) })))}>
                {t("p.bulkStock")}
              </Button>
            </div>
          )
        }
      >
        {error && <p className="mx-5 mt-3 rounded-lg bg-red-500/10 px-3 py-2 text-sm text-red-600">{error}</p>}
        {!variants.length ? (
          <p className="p-8 text-center text-sm text-ad-muted">{t("p.noVariants")}</p>
        ) : (
          <ul className="divide-y divide-ad-border">
            {variants.map((v) => (
              <li key={v.key} className={cn("grid grid-cols-2 gap-2 px-5 py-3 sm:grid-cols-4 2xl:grid-cols-[minmax(150px,1.3fr)_1fr_1fr_1fr_80px_auto] 2xl:gap-3", !v.isActive && "opacity-55")}>
                <div className="col-span-2 flex items-center gap-2 sm:col-span-4 2xl:col-span-1">
                  <span className="flex flex-wrap gap-1">
                    {Object.entries(v.options).map(([a, val]) => {
                      const lv = valueLabel(a, val);
                      return (
                        <span key={a} className="flex items-center gap-1 rounded-md bg-ad-sunken px-1.5 py-0.5 text-xs font-medium">
                          {lv?.colorHex && <span className="size-2.5 rounded-full" style={{ backgroundColor: lv.colorHex }} />}
                          {lv?.label ?? "?"}
                        </span>
                      );
                    })}
                  </span>
                </div>
                <TextInput className="h-9 text-xs" placeholder="SKU" value={v.sku} onChange={(e) => update(v.key, { sku: e.target.value.toUpperCase() })} dir="ltr" aria-label="SKU" />
                <MoneyInput value={v.price} onChange={(x) => update(v.key, { price: x })} decimals={money.base.decimals} symbol={money.display.symbol} placeholder={t("p.inherit")} />
                <MoneyInput value={v.salePrice} onChange={(x) => update(v.key, { salePrice: x })} decimals={money.base.decimals} symbol={money.display.symbol} placeholder={t("p.salePrice")} />
                <TextInput className="h-9" type="number" value={v.stock} onChange={(e) => update(v.key, { stock: Number(e.target.value) || 0 })} aria-label={t("p.stock")} />
                <div className="col-span-2 flex items-center justify-end gap-1 sm:col-span-4 2xl:col-span-1">
                  <Select className="h-9 w-24 text-xs" value={v.imageId ?? ""} onChange={(e) => update(v.key, { imageId: e.target.value || null })} aria-label={t("c.image")}>
                    <option value="">🖼 —</option>
                    {p.images.map((img, i) => (
                      <option key={img.mediaId} value={img.mediaId}>
                        #{i + 1}
                      </option>
                    ))}
                  </Select>
                  <Switch checked={v.isActive} onCheckedChange={(x) => update(v.key, { isActive: x })} />
                  <button type="button" onClick={() => setVariants(variants.filter((x) => x.key !== v.key))} className="grid size-8 place-items-center rounded-md text-ad-muted hover:bg-ad-hover hover:text-red-600" aria-label={t("c.remove")}>
                    <Trash2 className="size-4" />
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </Panel>
    </div>
  );
}
