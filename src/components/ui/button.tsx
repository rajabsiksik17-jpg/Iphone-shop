import { cva, type VariantProps } from "class-variance-authority";
import { Slot } from "./slot";
import { cn } from "@/lib/utils";
import { Spinner } from "./spinner";
import { cloneElement, isValidElement, type ButtonHTMLAttributes, type ReactElement, type ReactNode } from "react";

export const buttonVariants = cva(
  "relative inline-flex select-none items-center justify-center gap-2 whitespace-nowrap font-medium transition-[background,color,box-shadow,transform,border-color] duration-200 ease-out active:scale-[0.98] disabled:pointer-events-none disabled:opacity-50 [&_svg]:size-[1.15em] [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        primary: "bg-primary text-primary-fg shadow-sm hover:bg-primary/90 hover:shadow-md",
        accent: "bg-accent text-accent-fg shadow-sm hover:bg-accent/90 hover:shadow-md",
        secondary: "bg-surface text-fg hover:bg-border/60",
        outline: "border border-border bg-bg text-fg hover:border-fg/30 hover:bg-surface",
        ghost: "text-fg hover:bg-surface",
        link: "text-accent underline-offset-4 hover:underline !px-0 !h-auto",
        danger: "bg-red-600 text-white hover:bg-red-700",
        glass: "border border-white/25 bg-white/10 text-white backdrop-blur-md hover:bg-white/20",
        white: "bg-white text-neutral-950 hover:bg-white/90",
      },
      size: {
        xs: "h-8 px-3 text-xs",
        sm: "h-9 px-4 text-sm",
        md: "h-11 px-5 text-[15px]",
        lg: "h-12 px-7 text-base",
        xl: "h-14 px-8 text-base",
        icon: "size-10",
        "icon-sm": "size-8",
        "icon-lg": "size-12",
      },
      shape: { theme: "rounded-btn", rounded: "rounded-xl", pill: "rounded-full", square: "rounded-md" },
      block: { true: "w-full" },
    },
    defaultVariants: { variant: "primary", size: "md", shape: "theme" },
  },
);

export type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> &
  VariantProps<typeof buttonVariants> & {
    asChild?: boolean;
    loading?: boolean;
    leftIcon?: ReactNode;
    rightIcon?: ReactNode;
  };

export function Button({ className, variant, size, shape, block, asChild, loading, leftIcon, rightIcon, children, disabled, ...props }: ButtonProps) {
  const Comp = asChild ? Slot : "button";
  return (
    <Comp
      className={cn(buttonVariants({ variant, size, shape, block }), className)}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      {...(!asChild ? { type: props.type ?? "button" } : {})}
      {...props}
    >
      {asChild ? (
        // Keep icons when rendering as a link: they go inside the slotted child.
        (leftIcon || rightIcon) && isValidElement(children) ? (
          cloneElement(children as ReactElement<{ children?: ReactNode }>, undefined, leftIcon, (children as ReactElement<{ children?: ReactNode }>).props.children, rightIcon)
        ) : (
          children
        )
      ) : (
        <>
          {loading ? <Spinner className="size-4" /> : leftIcon}
          {children}
          {!loading && rightIcon}
        </>
      )}
    </Comp>
  );
}
