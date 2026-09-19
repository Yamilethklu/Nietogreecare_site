import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.14em] transition-colors",
  {
    variants: {
      variant: {
        default: "border-gold-500/35 bg-gold-500/10 text-gold-200",
        forest: "border-forest-500/40 bg-forest-600/15 text-forest-200",
        wood: "border-wood-500/40 bg-wood-500/15 text-wood-200",
        dark: "border-white/10 bg-white/5 text-ink-200",
        success: "border-emerald-500/40 bg-emerald-500/12 text-emerald-200",
        warning: "border-amber-500/40 bg-amber-500/12 text-amber-200",
        danger: "border-red-500/40 bg-red-500/12 text-red-200",
        info: "border-sky-500/40 bg-sky-500/12 text-sky-200",
      },
    },
    defaultVariants: { variant: "default" },
  },
);

export type BadgeProps = React.HTMLAttributes<HTMLSpanElement> &
  VariantProps<typeof badgeVariants>;

export function Badge({ className, variant, ...props }: BadgeProps) {
  return <span className={cn(badgeVariants({ variant }), className)} {...props} />;
}

/** Separador fino dorado. */
export function Separator({ className }: { className?: string }) {
  return <div className={cn("h-px w-full bg-gradient-to-r from-transparent via-gold-500/30 to-transparent", className)} />;
}

/** Esqueleto de carga. */
export function Skeleton({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        "animate-pulse rounded-xl bg-gradient-to-r from-ink-800/70 via-ink-700/60 to-ink-800/70",
        className,
      )}
    />
  );
}

export { badgeVariants };