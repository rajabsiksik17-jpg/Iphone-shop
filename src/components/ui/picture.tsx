import { cn } from "@/lib/utils";
import type { ImageDTO } from "@/types/catalog";

/**
 * Responsive image from pre-generated WebP renditions: correct srcset/sizes,
 * intrinsic dimensions (no layout shift), lazy loading, async decoding, a
 * blurred placeholder and `fetchPriority` for LCP images. Zero client JS.
 */
export function Picture({
  image,
  sizes = "100vw",
  className,
  imgClassName,
  priority,
  fit = "cover",
  alt,
}: {
  image: ImageDTO | null | undefined;
  sizes?: string;
  className?: string;
  imgClassName?: string;
  priority?: boolean;
  fit?: "cover" | "contain";
  alt?: string;
}) {
  if (!image) return <div className={cn("bg-surface", className)} aria-hidden />;
  const srcSet = image.srcSet.length ? image.srcSet.map((r) => `${r.url} ${r.w}w`).join(", ") : undefined;
  return (
    <div
      className={cn("relative overflow-hidden", className)}
      style={image.blur ? { backgroundImage: `url(${image.blur})`, backgroundSize: "cover", backgroundPosition: "center" } : undefined}
    >
      <img
        src={image.url}
        srcSet={srcSet}
        sizes={srcSet ? sizes : undefined}
        width={image.width ?? undefined}
        height={image.height ?? undefined}
        alt={alt ?? image.alt}
        loading={priority ? "eager" : "lazy"}
        decoding={priority ? "sync" : "async"}
        fetchPriority={priority ? "high" : "auto"}
        className={cn("size-full", fit === "cover" ? "object-cover" : "object-contain", imgClassName)}
      />
    </div>
  );
}
