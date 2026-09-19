"use client";

import Link from "next/link";
import { ArrowRight, CalendarCheck, CheckCircle2, ClipboardList, Info, MapPin, Ruler, UserRound } from "lucide-react";

import { useLanguage } from "@/components/providers/language-provider";
import { SectionHeading } from "@/components/site/section-heading";
import { Button } from "@/components/ui/button";
import { LuxuryCard } from "@/components/ui/card";

/** Invitacion al cotizador con el resumen de los 5 pasos. */
export function QuoteCta() {
  const { t } = useLanguage();

  const steps = [
    { icon: MapPin, label: t.quoteCta.step1 },
    { icon: Ruler, label: t.quoteCta.step2 },
    { icon: ClipboardList, label: t.quoteCta.step3 },
    { icon: UserRound, label: t.quoteCta.step4 },
    { icon: CalendarCheck, label: t.quoteCta.step5 },
  ];

  return (
    <section id="cotizador" className="ngc-section scroll-mt-24">
      <div className="container">
        <LuxuryCard className="flex flex-col gap-10 p-7 sm:p-10">
          <span
            aria-hidden="true"
            className="pointer-events-none absolute -right-24 -top-24 size-72 rounded-full bg-gold-500/15 blur-[100px]"
          />

          <SectionHeading
            eyebrow={t.quoteCta.eyebrow}
            title={t.quoteCta.title}
            subtitle={t.quoteCta.subtitle}
            align="left"
            className="relative"
          />

          <ol className="relative grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
            {steps.map((step, index) => (
              <li
                key={step.label}
                className="flex items-start gap-3 rounded-2xl border border-white/10 bg-white/[0.03] p-4"
              >
                <span className="grid size-9 shrink-0 place-items-center rounded-full border border-gold-500/35 bg-ink-950/80 font-display text-sm font-semibold text-gold-200">
                  {index + 1}
                </span>
                <div className="flex flex-col gap-1">
                  <step.icon className="size-4 text-gold-300" />
                  <p className="text-sm font-medium leading-snug text-ink-100">{step.label}</p>
                </div>
              </li>
            ))}
          </ol>

          <div className="relative flex flex-col items-start justify-between gap-5 sm:flex-row sm:items-center">
            <p className="flex items-start gap-2 text-xs leading-relaxed text-ink-200/75 sm:max-w-xl">
              <Info className="mt-0.5 size-4 shrink-0 text-gold-400" />
              {t.quoteCta.note}
            </p>
            <Button asChild variant="gold" size="lg" className="shrink-0">
              <Link href="/quote">
                {t.quoteCta.button}
                <ArrowRight className="size-4" />
              </Link>
            </Button>
          </div>

          <ul className="relative flex flex-wrap gap-x-6 gap-y-2 text-xs text-ink-200/70">
            <li className="flex items-center gap-2">
              <CheckCircle2 className="size-3.5 text-emerald-300" />
              {t.hero.trustFast}
            </li>
            <li className="flex items-center gap-2">
              <CheckCircle2 className="size-3.5 text-emerald-300" />
              {t.hero.trustBilingual}
            </li>
            <li className="flex items-center gap-2">
              <CheckCircle2 className="size-3.5 text-emerald-300" />
              {t.hero.trustLicensed}
            </li>
          </ul>
        </LuxuryCard>
      </div>
    </section>
  );
}