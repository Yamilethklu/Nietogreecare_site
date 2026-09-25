"use client";

import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

/**
 * Boton del design system: acabado elegante verde bosque + dorado.
 */
const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-full text-sm font-semibold tracking-wide transition-all duration-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold-500/60 focus-visible:ring-offset-2 focus-visible:ring-offset-ink-950 disabled:pointer-events-none disabled:opacity-45 [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        default:
          "bg-emerald-600 text-white shadow-sm hover:bg-emerald-700",
        gold:
          "bg-emerald-600 text-white shadow-sm hover:bg-emerald-700",
        wood:
          "bg-gradient-to-r from-wood-600 to-wood-700 text-gold-100 shadow-[0_10px_30px_-14px_rgba(120,53,15,0.9)] hover:brightness-110",
        outline:
          "border border-slate-300 bg-white text-slate-900 hover:bg-emerald-50 hover:text-emerald-700",
        ghost: "text-slate-700 hover:bg-emerald-50 hover:text-emerald-700",
        dark:
          "border border-white/10 bg-ink-900/80 text-white hover:border-gold-500/40 hover:bg-ink-800",
        destructive:
          "border border-red-500/40 bg-red-950/40 text-red-200 hover:bg-red-900/50 hover:text-white",
        link: "text-gold-300 underline-offset-4 hover:underline",
      },
      size: {
        sm: "h-9 px-4 text-xs [&_svg]:size-4",
        default: "h-11 px-6 [&_svg]:size-4",
        lg: "h-14 px-8 text-base [&_svg]:size-5",
        xl: "h-16 px-10 text-base [&_svg]:size-6",
        icon: "size-10 [&_svg]:size-4",
        "icon-lg": "size-12 [&_svg]:size-5",
      },
      glow: {
        true: "ring-1 ring-gold-500/30",
        false: "",
      },
    },
    defaultVariants: { variant: "default", size: "default", glow: false },
  },
);

export type ButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> &
  VariantProps<typeof buttonVariants> & {
    asChild?: boolean;
  };

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, glow, asChild = false, ...props }, ref) => {
    const Component = asChild ? Slot : "button";
    return (
      <Component
        className={cn(buttonVariants({ variant, size, glow }), className)}
        ref={ref}
        {...props}
      />
    );
  },
);
Button.displayName = "Button";

export { Button, buttonVariants };
