"use client";

import { Award, CheckCircle2, Heart, Leaf, MapPin, ShieldCheck, Sparkles, Timer } from "lucide-react";

import { useLanguage } from "@/components/providers/language-provider";
import { SectionHeading } from "@/components/site/section-heading";
import { Badge } from "@/components/ui/badge";
import { Card, LuxuryCard } from "@/components/ui/card";
import { NEARBY_CITIES, SERVICE_CITIES } from "@/lib/constants";

/** Seccion "Nuestra empresa": historia, cobertura, estandares y valores. */
export function AboutSection() {
  const { t, isEs } = useLanguage();

  const standards = [t.about.standard1, t.about.standard2, t.about.standard3, t.about.standard4];

  const values = [
    { icon: Award, title: t.about.values.quality, text: t.about.values.qualityText },
    { icon: ShieldCheck, title: t.about.values.trust, text: t.about.values.trustText },
    { icon: Leaf, title: t.about.values.sustainability, text: t.about.values.sustainabilityText },
    { icon: Heart, title: t.about.values.family, text: t.about.values.familyText },
  ];

  const stats = [
    { value: "8+", label: t.about.stats.yearsLabel },
    { value: "1,200+", label: t.about.stats.jobsLabel },
    { value: "450+", label: t.about.stats.clientsLabel },
    { value: t.about.stats.responseValue, label: t.about.stats.responseLabel },
  ];

  return (
    <section id="empresa" className="ngc-section scroll-mt-24">
      <div className="container flex flex-col gap-14">
        <SectionHeading
          eyebrow={t.about.eyebrow}
          title={t.about.title}
          subtitle={t.about.subtitle}
        />

        <div className="grid gap-6 lg:grid-cols-[1.05fr_0.95fr]">
          <LuxuryCard className="flex flex-col gap-5 p-7 sm:p-9">
            <h3 className="flex items-center gap-2 font-display text-xl font-semibold text-slate-900">
              <Sparkles className="size-5 text-gold-300" />
              {t.about.storyTitle}
            </h3>
            <p className="text-sm leading-relaxed text-slate-700/80">{t.about.story1}</p>
            <p className="text-sm leading-relaxed text-slate-700/80">{t.about.story2}</p>

            <div className="ngc-gold-line" />

            <h4 className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.2em] text-gold-200">
              <Timer className="size-4" />
              {t.about.standardTitle}
            </h4>
            <ul className="flex flex-col gap-2">
              {standards.map((item) => (
                <li key={item} className="flex items-start gap-2 text-sm text-slate-700/80">
                  <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-emerald-300" />
                  {item}
                </li>
              ))}
            </ul>

            <Badge variant="dark" className="w-fit">
              {t.about.standardsBadge}
            </Badge>
          </LuxuryCard>

          <div className="flex flex-col gap-6">
            <Card className="flex flex-col gap-4 p-7">
              <h3 className="flex items-center gap-2 font-display text-xl font-semibold text-slate-900">
                <MapPin className="size-5 text-gold-300" />
                {t.about.coverageTitle}
              </h3>
              <p className="text-sm leading-relaxed text-slate-700/80">{t.about.coverageText}</p>
              <div className="flex flex-wrap gap-2">
                {SERVICE_CITIES.map((city) => (
                  <Badge key={city} variant="forest">
                    {city}
                  </Badge>
                ))}
                {NEARBY_CITIES.map((city) => (
                  <Badge key={city} variant="dark">
                    {city}
                  </Badge>
                ))}
              </div>
              <p className="text-xs text-slate-500">
                {isEs
                  ? "Verificamos su codigo postal dentro del cotizador antes de agendar."
                  : "We verify your ZIP code inside the quote wizard before scheduling."}
              </p>
            </Card>

            <div className="grid grid-cols-2 gap-3">
              {stats.map((stat) => (
                <div
                  key={stat.label}
                  className="rounded-2xl border border-emerald-200 bg-slate-50 p-4"
                >
                  <p className="font-display text-2xl font-semibold text-gold-200">{stat.value}</p>
                  <p className="mt-1 text-[11px] uppercase tracking-[0.14em] text-slate-500">
                    {stat.label}
                  </p>
                </div>
              ))}
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              {values.map((value) => (
                <div
                  key={value.title}
                  className="rounded-2xl border border-slate-200 bg-white/[0.03] p-4"
                >
                  <value.icon className="size-5 text-gold-300" />
                  <p className="mt-2 font-display text-base font-semibold text-slate-900">
                    {value.title}
                  </p>
                  <p className="mt-1 text-xs leading-relaxed text-slate-700/70">{value.text}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
