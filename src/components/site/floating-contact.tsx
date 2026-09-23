"use client";

import { MessageSquare } from "lucide-react";

import { useLanguage } from "@/components/providers/language-provider";
import { buildSmsHref } from "@/lib/constants";

/** CTA flotante fijo: abre SMS nativo sin formulario, modal ni comportamiento arrastrable. */
export function FloatingContact() {
  const { t } = useLanguage();

  return (
    <a
      href={buildSmsHref()}
      aria-label={t.floating.openLabel}
      className="fixed bottom-6 right-5 z-40 no-print inline-flex h-14 items-center gap-3 rounded-full border border-emerald-300/45 bg-emerald-600 px-5 text-sm font-semibold text-white shadow-[0_18px_40px_-18px_rgba(16,185,129,0.9)] transition-all duration-300 hover:-translate-y-0.5 hover:bg-emerald-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400 focus-visible:ring-offset-2 focus-visible:ring-offset-ink-950"
    >
      <span className="relative grid size-9 place-items-center rounded-full bg-black/25">
        <MessageSquare className="size-5 text-white" />
        <span className="absolute -right-0.5 -top-0.5 size-2.5 animate-pulse rounded-full bg-amber-400" />
      </span>
      <span>{t.floating.openLabel}</span>
    </a>
  );
}