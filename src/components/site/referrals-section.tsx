"use client";

import { Gift, MessageSquare, Share2, Users } from "lucide-react";

import { useLanguage } from "@/components/providers/language-provider";
import { SectionHeading } from "@/components/site/section-heading";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { buildOwnerSmsHref } from "@/lib/constants";

export function ReferralsSection() {
  const { isEs } = useLanguage();

  const smsRefBody = encodeURIComponent(
    "Hola Nieto Green Care LLC, me gustaría referir a un vecino/amigo para el programa de créditos de corte de césped."
  );

  return (
    <section id="referrals" className="ngc-section scroll-mt-24 relative overflow-hidden bg-gradient-to-br from-lime-100 via-emerald-50 to-green-200">
      <div className="container flex flex-col gap-10">
        <div className="relative overflow-hidden rounded-3xl border border-emerald-500/40 bg-emerald-950 p-8 shadow-xl shadow-emerald-950/25 sm:p-12">
          <div className="absolute inset-0 bg-cover bg-center opacity-40" style={{ backgroundImage: "url('/hero-bg.jpg')" }} aria-hidden="true" />
          <div className="absolute inset-0 bg-gradient-to-r from-emerald-950 via-emerald-950/85 to-emerald-900/30" aria-hidden="true" />
          <div className="relative max-w-3xl">
            <div className="inline-flex items-center gap-2 rounded-full border border-emerald-500/30 bg-emerald-50 px-3.5 py-1.5 text-xs font-bold uppercase tracking-wider text-emerald-700">
              <Gift className="size-4" />
              {isEs ? "Programa de Referidos" : "Referral Rewards"}
            </div>

            <h2 className="mt-5 font-display text-3xl font-extrabold text-white sm:text-4xl lg:text-5xl">
              Fertilize Your Bank Account
            </h2>
            <p className="mt-2 text-xl font-medium text-lime-300">
              Turn referrals into free lawn care
            </p>

            <p className="mt-4 text-sm leading-relaxed text-white/90 sm:text-base">
              {isEs
                ? "Recomienda nuestros servicios a vecinos, amigos o familiares en nuestra zona de cobertura. Escríbenos para conocer los beneficios vigentes del programa."
                : "Refer neighbors, friends or family in our service area. Text us to ask about current referral benefits."}
            </p>

            <div className="mt-8 grid gap-4 sm:grid-cols-3 text-left">
              <Card className="border-lime-200 bg-white/95 p-4">
                <Users className="size-6 text-emerald-600" />
                <h4 className="mt-2 text-sm font-bold text-slate-900">1. Share</h4>
                <p className="mt-1 text-xs text-slate-600">
                  {isEs ? "Comparte Nieto Green Care con tus conocidos." : "Tell neighbors about Nieto Green Care."}
                </p>
              </Card>

              <Card className="border-lime-200 bg-white/95 p-4">
                <MessageSquare className="size-6 text-emerald-400" />
                <h4 className="mt-2 text-sm font-bold text-slate-900">2. Connect</h4>
                <p className="mt-1 text-xs text-slate-600">
                  {isEs ? "Envíanos sus datos o pídeles mencionar tu nombre." : "Have them mention your name when signing up."}
                </p>
              </Card>

              <Card className="border-lime-200 bg-white/95 p-4">
                <Gift className="size-6 text-emerald-600" />
                <h4 className="mt-2 text-sm font-bold text-slate-900">3. Earn</h4>
                <p className="mt-1 text-xs text-slate-600">
                  {isEs ? "¡Recibe cortes gratis o crédito en tu cuenta!" : "Enjoy free cuts or credits on your account!"}
                </p>
              </Card>
            </div>

            <div className="mt-8 flex flex-wrap gap-4">
              <Button asChild variant="gold" size="lg">
                <a href={`sms:+17373144215?body=${smsRefBody}`}>
                  <Share2 className="mr-2 size-4" />
                  {isEs ? "REFERIR UN VECINO" : "REFER A NEIGHBOR"}
                </a>
              </Button>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
