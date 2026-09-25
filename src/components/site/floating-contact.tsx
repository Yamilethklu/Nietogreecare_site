"use client";

import { MessageSquare } from "lucide-react";

import { useLanguage } from "@/components/providers/language-provider";
import { buildSmsHref } from "@/lib/constants";

/** CTA flotante fijo: abre SMS nativo sin formulario, modal ni comportamiento arrastrable. */
export function FloatingContact() {
  return (
    <a
      href="sms:+17373144215"
      aria-label="Text Us"
      className="fixed bottom-6 right-5 z-40 no-print inline-flex h-14 items-center gap-3 rounded-full border border-green-400 bg-green-500 px-5 text-sm font-semibold text-slate-950 shadow-lg transition-all duration-300 hover:-translate-y-0.5 hover:bg-green-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-green-500 focus-visible:ring-offset-2"
    >
      <span className="relative grid size-9 place-items-center rounded-full bg-black/25">
        <MessageSquare className="size-5 text-white" />
        <span className="absolute -right-0.5 -top-0.5 size-2.5 animate-pulse rounded-full bg-amber-400" />
      </span>
      <span className="font-bold tracking-wide">Text Us</span>
    </a>
  );
}
