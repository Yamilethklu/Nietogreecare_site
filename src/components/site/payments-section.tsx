"use client";

import * as React from "react";
import Link from "next/link";
import {
  Ban,
  Banknote,
  CheckCircle2,
  Copy,
  CreditCard,
  ExternalLink,
  QrCode,
  ShieldCheck,
  Smartphone,
  TriangleAlert,
} from "lucide-react";

import { useLanguage } from "@/components/providers/language-provider";
import { useToast } from "@/components/providers/toast-provider";
import { SectionHeading } from "@/components/site/section-heading";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, LuxuryCard } from "@/components/ui/card";
import { BUSINESS } from "@/lib/constants";

/**
 * Metodos de pago (efectivo, Cash App, Venmo y Zelle).
 * Requisito estricto: la plataforma NO procesa ni almacena tarjetas de credito.
 */
export function PaymentsSection({
  cashAppQrDataUrl = null,
  venmoQrDataUrl = null,
  withHeading = true,
  className,
}: {
  cashAppQrDataUrl?: string | null;
  venmoQrDataUrl?: string | null;
  withHeading?: boolean;
  className?: string;
}) {
  const { t, isEs } = useLanguage();
  const { toast } = useToast();

  const copy = React.useCallback(
    async (value: string, label: string) => {
      try {
        await navigator.clipboard.writeText(value);
        toast({ title: t.payments.copied, description: label, variant: "success" });
      } catch {
        toast({ title: t.errors.generic, variant: "error" });
      }
    },
    [t, toast],
  );

  return (
    <section id="pagos" className={className ?? "ngc-section scroll-mt-24"}>
      <div className="container flex flex-col gap-10">
        {withHeading ? (
          <SectionHeading
            eyebrow={t.payments.eyebrow}
            title={t.payments.title}
            subtitle={t.payments.subtitle}
          />
        ) : null}

        <div className="grid gap-6 lg:grid-cols-2 xl:grid-cols-4">
          <Card className="flex flex-col gap-4 border-red-500/20 bg-red-950/10 p-7">
            <span className="flex items-center gap-2">
              <Ban className="size-5 text-red-300" />
              <h3 className="font-display text-lg font-semibold text-white">
                {t.payments.policyTitle}
              </h3>
            </span>
            <p className="text-sm leading-relaxed text-ink-200/80">{t.payments.policyText}</p>
            <ul className="flex flex-col gap-2">
              {t.payments.policyPoints.map((point) => (
                <li key={point} className="flex items-start gap-2 text-sm text-ink-200/80">
                  <CreditCard className="mt-0.5 size-4 shrink-0 text-red-300" />
                  {point}
                </li>
              ))}
            </ul>
          </Card>

          <Card className="flex flex-col gap-4 p-7">
            <span className="flex items-center gap-2">
              <Smartphone className="size-5 text-gold-300" />
              <h3 className="font-display text-lg font-semibold text-white">
                {t.payments.cashAppTitle}
              </h3>
            </span>
            <p className="text-sm leading-relaxed text-ink-200/80">{t.payments.cashAppDesc}</p>

            <div className="flex items-center justify-between gap-3 rounded-2xl border border-gold-500/25 bg-ink-950/70 px-4 py-3">
              <span className="text-[11px] uppercase tracking-[0.16em] text-ink-400">
                {t.payments.cashAppTag}
              </span>
              <span className="font-display text-base font-semibold text-gold-200">
                {BUSINESS.cashAppTag}
              </span>
            </div>

            <div className="flex flex-col gap-3 sm:flex-row">
              <Button
                type="button"
                variant="outline"
                onClick={() => copy(BUSINESS.cashAppTag, t.payments.cashAppTitle)}
                className="flex-1"
              >
                <Copy className="size-4" />
                {t.payments.copyTag}
              </Button>
              <Button asChild variant="gold" className="flex-1">
                <a href={BUSINESS.cashAppUrl} target="_blank" rel="noreferrer noopener">
                  <ExternalLink className="size-4" />
                  {t.payments.cashAppButton}
                </a>
              </Button>
            </div>

            <div className="flex flex-col items-center gap-3 rounded-2xl border border-white/10 bg-white/[0.03] p-4">
              <span className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.16em] text-gold-200">
                <QrCode className="size-4" />
                {t.payments.cashAppQr}
              </span>
              {cashAppQrDataUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={cashAppQrDataUrl}
                  alt={`Cash App ${BUSINESS.cashAppTag}`}
                  width={168}
                  height={168}
                  className="rounded-xl border border-gold-500/25 bg-white p-2"
                />
              ) : (
                <span className="rounded-xl border border-dashed border-white/15 px-4 py-8 text-center text-xs text-ink-400">
                  {BUSINESS.cashAppUrl}
                </span>
              )}
              <p className="text-center text-xs leading-relaxed text-ink-400">
                {t.payments.cashAppQrHint}
              </p>
            </div>
          </Card>

          <Card className="flex flex-col gap-4 p-7">
            <span className="flex items-center gap-2">
              <Smartphone className="size-5 text-gold-300" />
              <h3 className="font-display text-lg font-semibold text-white">
                {t.payments.venmoTitle}
              </h3>
            </span>
            <p className="text-sm leading-relaxed text-ink-200/80">{t.payments.venmoDesc}</p>

            <div className="flex items-center justify-between gap-3 rounded-2xl border border-gold-500/25 bg-ink-950/70 px-4 py-3">
              <span className="text-[11px] uppercase tracking-[0.16em] text-ink-400">
                {t.payments.venmoHandle}
              </span>
              <span className="font-display text-base font-semibold text-gold-200">
                {BUSINESS.venmoHandle}
              </span>
            </div>

            <div className="flex flex-col gap-3 sm:flex-row">
              <Button
                type="button"
                variant="outline"
                onClick={() => copy(BUSINESS.venmoHandle, t.payments.venmoTitle)}
                className="flex-1"
              >
                <Copy className="size-4" />
                {t.payments.copyTag}
              </Button>
              <Button asChild variant="gold" className="flex-1">
                <a href={BUSINESS.venmoUrl} target="_blank" rel="noreferrer noopener">
                  <ExternalLink className="size-4" />
                  {t.payments.venmoButton}
                </a>
              </Button>
            </div>

            <div className="flex flex-col items-center gap-3 rounded-2xl border border-white/10 bg-white/[0.03] p-4">
              <span className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.16em] text-gold-200">
                <QrCode className="size-4" />
                {t.payments.venmoQr}
              </span>
              {venmoQrDataUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={venmoQrDataUrl}
                  alt={`Venmo ${BUSINESS.venmoHandle}`}
                  width={168}
                  height={168}
                  className="rounded-xl border border-gold-500/25 bg-white p-2"
                />
              ) : (
                <span className="rounded-xl border border-dashed border-white/15 px-4 py-8 text-center text-xs text-ink-400">
                  {BUSINESS.venmoUrl}
                </span>
              )}
              <p className="text-center text-xs leading-relaxed text-ink-400">
                {t.payments.venmoQrHint}
              </p>
            </div>
          </Card>

          <Card className="flex flex-col gap-4 p-7">
            <span className="flex items-center gap-2">
              <Banknote className="size-5 text-gold-300" />
              <h3 className="font-display text-lg font-semibold text-white">
                {t.payments.zelleTitle}
              </h3>
            </span>
            <p className="text-sm leading-relaxed text-ink-200/80">{t.payments.zelleDesc}</p>

            <div className="flex flex-col gap-2 rounded-2xl border border-gold-500/25 bg-ink-950/70 px-4 py-3">
              <div className="flex items-center justify-between gap-3">
                <span className="text-[11px] uppercase tracking-[0.16em] text-ink-400">
                  {t.payments.zelleName}
                </span>
                <span className="text-sm font-semibold text-gold-200">{BUSINESS.zelleName}</span>
              </div>
              <div className="flex items-center justify-between gap-3">
                <span className="text-[11px] uppercase tracking-[0.16em] text-ink-400">
                  {t.payments.zellePhone}
                </span>
                <span className="text-sm font-semibold text-gold-200">{BUSINESS.zellePhone}</span>
              </div>
            </div>

            <Button
              type="button"
              variant="outline"
              onClick={() => copy(BUSINESS.zellePhone, t.payments.zelleTitle)}
            >
              <Copy className="size-4" />
              {t.payments.copyPhone}
            </Button>

            <p className="flex items-start gap-2 rounded-2xl border border-amber-500/25 bg-amber-950/20 p-3 text-xs leading-relaxed text-amber-100">
              <TriangleAlert className="mt-0.5 size-4 shrink-0" />
              {t.payments.zelleWarning}
            </p>
          </Card>
        </div>

        <div className="grid gap-6 lg:grid-cols-2">
          <LuxuryCard className="flex flex-col gap-4 p-7">
            <h3 className="font-display text-lg font-semibold text-white">
              {t.payments.stepsTitle}
            </h3>
            <ol className="flex flex-col gap-3">
              {t.payments.steps.map((step, index) => (
                <li key={step} className="flex items-start gap-3">
                  <span className="grid size-7 shrink-0 place-items-center rounded-full border border-gold-500/35 bg-ink-950/80 font-display text-xs font-semibold text-gold-200">
                    {index + 1}
                  </span>
                  <span className="text-sm leading-relaxed text-ink-200/80">{step}</span>
                </li>
              ))}
            </ol>

            <div className="rounded-2xl border border-forest-500/30 bg-forest-950/50 p-4">
              <p className="flex items-center gap-2 text-sm font-semibold text-forest-200">
                <ShieldCheck className="size-4" />
                {t.payments.afterServiceTitle}
              </p>
              <p className="mt-2 text-xs leading-relaxed text-ink-200/75">
                {t.payments.afterServiceText}
              </p>
            </div>
          </LuxuryCard>

          <Card className="flex flex-col gap-3 p-7">
            <h3 className="font-display text-lg font-semibold text-white">{t.payments.faqTitle}</h3>
            {[
              { q: t.payments.faq1q, a: t.payments.faq1a },
              { q: t.payments.faq2q, a: t.payments.faq2a },
              { q: t.payments.faq3q, a: t.payments.faq3a },
            ].map((faq) => (
              <details
                key={faq.q}
                className="group rounded-2xl border border-white/10 bg-white/[0.03] p-4 open:border-gold-500/30"
              >
                <summary className="cursor-pointer list-none text-sm font-semibold text-white marker:hidden">
                  <span className="flex items-center justify-between gap-3">
                    {faq.q}
                    <CheckCircle2 className="size-4 shrink-0 text-gold-400 transition-transform group-open:rotate-90" />
                  </span>
                </summary>
                <p className="mt-2 text-xs leading-relaxed text-ink-200/75">{faq.a}</p>
              </details>
            ))}
          </Card>
        </div>

        <div className="flex flex-col items-center justify-center gap-3 sm:flex-row">
          <Button asChild variant="gold" size="lg">
            <Link href="/quote">
              {t.payments.ctaQuote}
            </Link>
          </Button>
          <Button asChild variant="outline" size="lg">
            <a href={BUSINESS.telHref}>{t.payments.ctaCall}</a>
          </Button>
          <Badge variant="dark" className="h-fit">
            {isEs
              ? "Solo efectivo, Cash App, Venmo o Zelle"
              : "Cash, Cash App, Venmo or Zelle only"}
          </Badge>
        </div>
      </div>
    </section>
  );
}