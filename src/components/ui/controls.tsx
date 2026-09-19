"use client";

import * as React from "react";

import { cn } from "@/lib/utils";

/** Interruptor accesible (role="switch") con estilo luxury. */
export function Switch({
  checked,
  onCheckedChange,
  disabled,
  label,
  className,
  id,
}: {
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
  disabled?: boolean;
  label?: string;
  className?: string;
  id?: string;
}) {
  return (
    <button
      type="button"
      role="switch"
      id={id}
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={() => onCheckedChange(!checked)}
      className={cn(
        "relative inline-flex h-6 w-11 shrink-0 items-center rounded-full border transition-colors duration-300",
        checked
          ? "border-gold-500/50 bg-forest-600"
          : "border-white/15 bg-ink-800",
        disabled && "cursor-not-allowed opacity-50",
        className,
      )}
    >
      <span
        className={cn(
          "pointer-events-none block size-5 translate-x-0.5 rounded-full bg-white shadow transition-transform duration-300",
          checked && "translate-x-[22px]",
        )}
      />
    </button>
  );
}

/** Selector nativo estilizado (evita dependencias extra y funciona en movil). */
export const Select = React.forwardRef<
  HTMLSelectElement,
  React.SelectHTMLAttributes<HTMLSelectElement>
>(({ className, children, ...props }, ref) => (
  <select
    ref={ref}
    className={cn(
      "h-12 w-full appearance-none rounded-xl border border-white/12 bg-ink-950/70 px-4 text-sm text-white shadow-inset transition-colors",
      "focus-visible:border-gold-500/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold-500/25",
      "disabled:cursor-not-allowed disabled:opacity-50",
      className,
    )}
    {...props}
  >
    {children}
  </select>
));
Select.displayName = "Select";

/** Barra de progreso lineal dorada. */
export function Progress({
  value,
  className,
}: {
  value: number;
  className?: string;
}) {
  const safe = Math.max(0, Math.min(100, value));
  return (
    <div className={cn("h-1.5 w-full overflow-hidden rounded-full bg-white/10", className)}>
      <div
        className="h-full rounded-full bg-gradient-to-r from-forest-500 via-forest-600 to-gold-500 transition-all duration-500"
        style={{ width: `${safe}%` }}
      />
    </div>
  );
}

/** Contenedor de tabs simple con estado controlado (sin Radix). */
export function Tabs({
  tabs,
  value,
  onValueChange,
  className,
}: {
  tabs: { value: string; label: string; icon?: React.ReactNode }[];
  value: string;
  onValueChange: (value: string) => void;
  className?: string;
}) {
  return (
    <div className={cn("flex flex-wrap gap-2", className)} role="tablist">
      {tabs.map((tab) => {
        const active = tab.value === value;
        return (
          <button
            key={tab.value}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => onValueChange(tab.value)}
            className={cn(
              "inline-flex items-center gap-2 rounded-full border px-4 py-2 text-xs font-semibold uppercase tracking-[0.14em] transition-all duration-300",
              active
                ? "border-gold-500/50 bg-gold-500/15 text-gold-100"
                : "border-white/10 bg-white/[0.03] text-ink-400 hover:border-gold-500/30 hover:text-white",
            )}
          >
            {tab.icon}
            {tab.label}
          </button>
        );
      })}
    </div>
  );
}