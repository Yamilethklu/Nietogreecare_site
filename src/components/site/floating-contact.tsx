"use client";

import { useLanguage } from "@/components/providers/language-provider";
import { MessageSquare } from "lucide-react";

import { buildOwnerSmsHref } from "@/lib/constants";

export function FloatingContact() {
  const { isEs } = useLanguage();
  return <a href={buildOwnerSmsHref("", isEs ? "Hola Nieto Green Care LLC, me gustaría solicitar información sobre sus servicios." : "Hello Nieto Green Care LLC, I would like information about your services.")} aria-label={isEs ? "Enviar mensaje por SMS" : "Send a text message"} className="fixed bottom-5 right-5 z-50 inline-flex h-14 items-center gap-3 rounded-full bg-lime-400 px-5 font-bold text-emerald-950 shadow-lg shadow-emerald-950/25 transition hover:-translate-y-0.5 hover:bg-lime-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-700 focus-visible:ring-offset-2 sm:bottom-6 sm:right-6"><MessageSquare className="size-5" />{isEs ? "Mándanos un mensaje" : "Text us"}</a>;
}
