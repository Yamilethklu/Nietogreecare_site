import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

/**
 * Encabezado de seccion reutilizable (eyebrow dorado + titulo serif + subtitulo).
 * Es un componente de presentacion: recibe los textos ya traducidos.
 */
export function SectionHeading({
  eyebrow,
  title,
  subtitle,
  align = "center",
  className,
}: {
  eyebrow?: string;
  title: ReactNode;
  subtitle?: string;
  align?: "center" | "left";
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex flex-col gap-4",
        align === "center" ? "items-center text-center" : "items-start text-left",
        className,
      )}
    >
      {eyebrow ? (
        <span className="ngc-eyebrow">
          <span className="h-px w-6 bg-gold-500/60" />
          {eyebrow}
        </span>
      ) : null}

      <h2 className="ngc-title text-balance">{title}</h2>

      {subtitle ? (
        <p className="ngc-subtitle max-w-2xl text-balance">{subtitle}</p>
      ) : null}
    </div>
  );
}