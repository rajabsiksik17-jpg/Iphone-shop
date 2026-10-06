"use client";

import { useEffect, useState, useTransition } from "react";
import { useLocale, useTranslations } from "next-intl";
import { Star, PenLine, Flag, ThumbsUp } from "lucide-react";
import { toast } from "sonner";
import { reviewEligibilityAction, submitReviewAction, reportReviewAction, markHelpfulAction } from "@/actions/store";
import { Button } from "@/components/ui/button";
import { Field, Input, Textarea } from "@/components/ui/input";
import { Modal } from "@/components/ui/overlay";
import { Link } from "@/i18n/navigation";
import { useErrorMessage } from "@/lib/use-action";
import { cn } from "@/lib/utils";

export function WriteReview({ productId }: { productId: string }) {
  const t = useTranslations("reviews");
  const locale = useLocale();
  const errorMessage = useErrorMessage();
  const [status, setStatus] = useState<"login" | "reviewed" | "eligible" | "not_purchased" | null>(null);
  const [open, setOpen] = useState(false);
  const [rating, setRating] = useState(0);
  const [hover, setHover] = useState(0);
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [pending, start] = useTransition();

  useEffect(() => {
    reviewEligibilityAction(productId).then((r) => r.ok && setStatus(r.data.status));
  }, [productId]);

  if (status === "login")
    return (
      <Button asChild variant="outline" leftIcon={<PenLine />}>
        <Link href={`/account/login?next=${encodeURIComponent(typeof window !== "undefined" ? window.location.pathname : "/")}`}>{t("loginToReview")}</Link>
      </Button>
    );
  if (status === "reviewed") return <p className="text-sm text-muted">{t("alreadyReviewed")}</p>;
  if (status === "not_purchased") return <p className="max-w-xs text-sm text-muted">{t("onlyBuyers")}</p>;
  if (status !== "eligible") return null;

  return (
    <>
      <Button variant="outline" leftIcon={<PenLine />} onClick={() => setOpen(true)}>
        {t("write")}
      </Button>
      <Modal open={open} onOpenChange={setOpen} title={t("write")}>
        <form
          className="space-y-4"
          onSubmit={(e) => {
            e.preventDefault();
            if (!rating) return;
            start(async () => {
              const res = await submitReviewAction({ productId, rating, title, body, locale: locale as "ar" | "en" });
              if (res.ok) {
                toast.success(t("submitted"));
                setOpen(false);
                setStatus("reviewed");
              } else toast.error(errorMessage(res));
            });
          }}
        >
          <div>
            <p className="mb-2 text-sm font-medium">{t("yourRating")}</p>
            <div className="flex gap-1" onMouseLeave={() => setHover(0)} role="radiogroup" aria-label={t("yourRating")}>
              {[1, 2, 3, 4, 5].map((r) => (
                <button key={r} type="button" role="radio" aria-checked={rating === r} aria-label={t("stars", { count: r })} onMouseEnter={() => setHover(r)} onClick={() => setRating(r)} className="p-0.5">
                  <Star className={cn("size-8 transition", (hover || rating) >= r ? "fill-amber-400 text-amber-400" : "text-border")} />
                </button>
              ))}
            </div>
          </div>
          <Field label={t("titleLabel")} optional="optional">
            {(p) => <Input {...p} value={title} onChange={(e) => setTitle(e.target.value)} maxLength={120} />}
          </Field>
          <Field label={t("bodyLabel")}>{(p) => <Textarea {...p} value={body} onChange={(e) => setBody(e.target.value)} placeholder={t("bodyPlaceholder")} required minLength={10} maxLength={4000} rows={5} />}</Field>
          <Button type="submit" block loading={pending} disabled={!rating || body.trim().length < 10}>
            {t("submit")}
          </Button>
        </form>
      </Modal>
    </>
  );
}

export function ReviewActions({ reviewId, helpful }: { reviewId: string; helpful: number }) {
  const t = useTranslations("reviews");
  const [count, setCount] = useState(helpful);
  const [voted, setVoted] = useState(false);
  const [reported, setReported] = useState(false);
  return (
    <div className="mt-3 flex items-center gap-4 text-xs text-muted">
      <button
        type="button"
        disabled={voted}
        onClick={() => {
          setVoted(true);
          setCount((c) => c + 1);
          markHelpfulAction(reviewId).catch(() => {});
        }}
        className={cn("flex items-center gap-1.5 hover:text-fg", voted && "text-accent")}
      >
        <ThumbsUp className="size-3.5" /> {t("helpful")} {count > 0 && `(${count})`}
      </button>
      <button
        type="button"
        disabled={reported}
        onClick={async () => {
          const r = await reportReviewAction(reviewId, "inappropriate");
          if (r.ok) {
            setReported(true);
            toast.success(t("reported"));
          }
        }}
        className="flex items-center gap-1.5 hover:text-fg"
      >
        <Flag className="size-3.5" /> {t("report")}
      </button>
    </div>
  );
}
