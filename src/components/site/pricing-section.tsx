"use client";

import Link from "next/link";
import { Check, DollarSign, Shield, Sparkles } from "lucide-react";

import { useLanguage } from "@/components/providers/language-provider";
import { SectionHeading } from "@/components/site/section-heading";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

export function PricingSection() {
  const { isEs } = useLanguage();

  const pricingTiers = [
    {
      title: isEs ? "Corte Semanal (Weekly)" : "Weekly Lawn Service",
      price: "$38",
      period: isEs ? "/corte + imp" : "/cut + tax",
      desc: isEs ? "Ideal para un césped siempre verde y perfectamente mantenido." : "Ideal for a lawn that stays green and perfectly manicured all season.",
      features: [
        isEs ? "Corte de césped profesional" : "Professional lawn mowing",
        isEs ? "Desbrozado y orillas (Line Trim & Edge)" : "Line trimming & edging",
        isEs ? "Soplado de concreto y huellas" : "Blowing off all hard surfaces",
        isEs ? "Garantía de satisfacción" : "100% satisfaction guarantee",
      ],
      featured: true,
    },
    {
      title: isEs ? "Corte Quincenal (Bi-Weekly)" : "Bi-Weekly Lawn Service",
      price: "$42",
      period: isEs ? "/corte + imp" : "/cut + tax",
      desc: isEs ? "Mantenimiento constante cada dos semanas para tu tranquilidad." : "Consistent maintenance every two weeks for peace of mind.",
      features: [
        isEs ? "Corte de césped profesional" : "Professional lawn mowing",
        isEs ? "Desbrozado y orillas (Line Trim & Edge)" : "Line trimming & edging",
        isEs ? "Soplado de superficies" : "Blowing off all hard surfaces",
        isEs ? "Sin contratos forzosos" : "No contract required",
      ],
      featured: false,
    },
  ];

  return (
    <section id="pricing" className="ngc-section scroll-mt-24 bg-white/60 relative">
      <div className="container flex flex-col gap-10">
        <SectionHeading
          eyebrow={isEs ? "Precios Transparentes" : "Transparent Pricing"}
          title={isEs ? "Tarifas claras basadas en tu terreno" : "Simple Rates Based On Your Yard"}
          subtitle={
            isEs
              ? "Consulta la tarifa de corte de yarda en el cotizador. Para otros trabajos, programamos una visita para estimar en persona."
              : "See your lawn mowing rate in the quote form. We arrange an in-person estimate for other jobs."
          }
        />

        <div className="grid gap-6 md:grid-cols-2 max-w-4xl mx-auto w-full">
          {pricingTiers.map((tier) => (
            <Card
              key={tier.title}
              className={`relative flex flex-col justify-between p-6 sm:p-8 transition-all duration-300 hover:border-gold-400 ${
                tier.featured
                  ? "border-emerald-500/50 bg-emerald-50 shadow-sm"
                  : "border-slate-200 bg-white"
              }`}
            >
              {tier.featured && (
                <div className="absolute -top-3.5 right-6 inline-flex items-center gap-1.5 rounded-full bg-emerald-500 px-3 py-1 text-xs font-bold text-ink-950 shadow">
                  <Sparkles className="size-3.5" />
                  {isEs ? "Más Popular" : "Most Popular"}
                </div>
              )}

              <div>
                <h3 className="text-xl font-bold text-slate-900">{tier.title}</h3>
                <p className="mt-2 text-xs text-slate-600">{tier.desc}</p>

                <div className="mt-5 flex items-baseline gap-1">
                  <span className="text-4xl font-extrabold text-gold-300">{tier.price}</span>
                  <span className="text-sm font-medium text-slate-600">{tier.period}</span>
                </div>

                <ul className="mt-6 space-y-3 border-t border-slate-200 pt-6 text-xs text-slate-700">
                  {tier.features.map((feat) => (
                    <li key={feat} className="flex items-center gap-2.5">
                      <span className="grid size-5 place-items-center rounded-full bg-emerald-500/20 text-emerald-400">
                        <Check className="size-3.5" />
                      </span>
                      <span>{feat}</span>
                    </li>
                  ))}
                </ul>
              </div>

              <div className="mt-8 border-t border-slate-200 pt-6">
                <Button asChild variant={tier.featured ? "gold" : "outline"} className="w-full">
                  <Link href="/quote">GET MY PRICE</Link>
                </Button>
              </div>
            </Card>
          ))}
        </div>

        <div className="mx-auto flex max-w-2xl items-center justify-center gap-3 rounded-2xl border border-slate-200 bg-white p-4 text-center text-xs text-slate-600">
          <Shield className="size-5 text-emerald-400 shrink-0" />
          <span>
            {isEs
              ? "Tarifa base para lotes estándar. Lotes de esquina o propiedades desocupadas pueden variar ligeramente."
              : "Base rate for standard residential yards. Corner lots or vacant properties may vary slightly."}
          </span>
        </div>
      </div>
    </section>
  );
}
