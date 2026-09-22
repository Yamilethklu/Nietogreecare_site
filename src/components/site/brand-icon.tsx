"use client";

import Image from "next/image";

import { usePublicAsset } from "@/lib/use-public-asset";
import { cn } from "@/lib/utils";

type BrandIconSize = "sm" | "md" | "lg";

const SIZE_CLASSES: Record<BrandIconSize, string> = {
  sm: "size-9",
  md: "size-12",
  lg: "size-14",
};

const SIZE_PIXELS: Record<BrandIconSize, number> = { sm: 36, md: 48, lg: 56 };

/**
 * Logotipo circular oficial de Nieto Green Care LLC (/public/1icon.png) con
 * anillo dorado y brillo de marca, destacado en la esquina superior izquierda
 * del header. Si el archivo aun no esta publicado se mantiene el monograma
 * dorado, de modo que el header nunca queda con una imagen rota.
 */
export function BrandIcon({
  size = "md",
  className,
}: {
  size?: BrandIconSize;
  className?: string;
}) {
  const icon = usePublicAsset("/1icon.png");
  const ready = icon === "ready";

  return (
    <span
      className={cn(
        "relative grid shrink-0 place-items-center overflow-hidden rounded-full border border-gold-500/50 bg-gradient-to-br from-forest-700 via-forest-800 to-ink-950 shadow-gold ring-1 ring-inset ring-white/10",
        SIZE_CLASSES[size],
        className,
      )}
    >
      {/* Monograma dorado siempre presente: la imagen oficial se superpone encima
          cuando esta publicada, sin parpadeos ni iconos de imagen rota. */}
      <span
        className={cn(
          "font-serif font-bold text-gold-200",
          size === "sm" ? "text-base" : size === "md" ? "text-lg" : "text-2xl",
        )}
      >
        N
      </span>
      <span className="absolute inset-x-2 bottom-1 h-px bg-gold-500/50" />

      {ready ? (
        <Image
          src="/1icon.png"
          alt=""
          width={SIZE_PIXELS[size]}
          height={SIZE_PIXELS[size]}
          priority
          className="absolute inset-0 size-full rounded-full object-cover"
        />
      ) : null}
    </span>
  );
}
