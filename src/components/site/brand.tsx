import { Menu, Phone, X } from "lucide-react";

import { BrandIcon } from "@/components/site/brand-icon";
import { BUSINESS } from "@/lib/constants";
import { cn } from "@/lib/utils";

type SiteLogoProps = {
  className?: string;
  size?: "sm" | "md" | "lg";
  showTagline?: boolean;
};

/**
 * Logotipo oficial: icono circular destacado (/public/1icon.png) con el nombre
 * de la marca en tipografia serif elegante y su leyenda.
 */
export function SiteLogo({ className, size = "md", showTagline = false }: SiteLogoProps) {
  const sizes = {
    sm: { name: "text-sm", tag: "text-[9px]" },
    md: { name: "text-base", tag: "text-[10px]" },
    lg: { name: "text-xl", tag: "text-[11px]" },
  }[size];

  return (
    <span className={cn("group flex items-center gap-3", className)}>
      <BrandIcon
        size={size}
        className="transition-transform duration-300 group-hover:scale-105"
      />
      <span className="flex flex-col leading-none">
        <span
          className={cn(
            "font-serif font-semibold uppercase tracking-[0.2em] text-slate-900",
            sizes.name,
          )}
        >
          Nieto Green Care
        </span>
        <span
          className={cn(
            "mt-1 flex items-center gap-2 font-sans uppercase tracking-[0.3em] text-emerald-700",
            sizes.tag,
          )}
        >
          <span className="h-px w-4 bg-gold-500/60" />
          {showTagline ? "Austin · TX" : "LLC · Austin, TX"}
        </span>
      </span>
    </span>
  );
}

/** Boton destacado "Llamar" que abre directamente el marcador telefonico. */
export function CallButton({
  label,
  phoneTel = BUSINESS.telHref,
  className,
  size = "default",
}: {
  label: string;
  phoneTel?: string;
  className?: string;
  size?: "sm" | "default" | "lg" | "xl";
}) {
  const sizeClass = {
    sm: "h-9 px-4 text-xs",
    default: "h-11 px-5 text-sm",
    lg: "h-12 px-7 text-base",
    xl: "h-14 px-8 text-base",
  }[size];

  return (
    <a
      href={phoneTel}
      className={cn(
        "group inline-flex items-center justify-center gap-2 rounded-full border border-gold-500/50 bg-gradient-to-r from-forest-600 to-forest-700 font-semibold text-white shadow-[0_10px_30px_-12px_rgba(22,101,52,0.9)] transition-all duration-300 hover:from-forest-500 hover:to-forest-600 hover:shadow-[0_16px_36px_-14px_rgba(201,162,39,0.6)]",
        sizeClass,
        className,
      )}
      aria-label={`${label} — llamada telefonica`}
    >
      <Phone className="size-4 transition-transform duration-300 group-hover:rotate-12" />
      {label}
    </a>
  );
}

export { Menu, X };
