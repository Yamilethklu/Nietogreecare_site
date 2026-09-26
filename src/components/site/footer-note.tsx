"use client";

import { CreditCard, ShieldOff } from "lucide-react";

import { useLanguage } from "@/components/providers/language-provider";
import { Badge } from "@/components/ui/badge";
import { BUSINESS, PAYMENT_METHODS } from "@/lib/constants";

/** Aviso legal + metodos de pago aceptados + copyright. */
export function FooterNote() {
  const { t, isEs } = useLanguage();

  return (
    <div className="container flex flex-col gap-6 py-8">
      <div className="flex flex-col gap-4 rounded-2xl border border-amber-500/20 bg-amber-950/15 p-5 lg:flex-row lg:items-center lg:justify-between">
        <p className="flex items-start gap-2 text-xs leading-relaxed text-amber-100 sm:max-w-3xl">
          <ShieldOff className="mt-0.5 size-4 shrink-0" />
          {t.footer.paymentNote}
        </p>
        <div className="flex flex-wrap items-center gap-2">
          {PAYMENT_METHODS.map((method) => (
            <Badge key={method.key} variant="dark">
              <CreditCard className="size-3.5" />
              {isEs ? method.labelEs : method.labelEn}
            </Badge>
          ))}
        </div>
      </div>

      <div className="flex flex-col gap-2 text-xs text-slate-500 sm:flex-row sm:items-center sm:justify-between">
        <p>
          © {new Date().getFullYear()} {BUSINESS.name} · {t.footer.rights}
        </p>
        <p>{t.footer.legal}</p>
      </div>
    </div>
  );
}