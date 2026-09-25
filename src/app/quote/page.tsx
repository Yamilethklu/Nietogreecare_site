"use client";

import { OtherServicesForm } from "@/components/quote/other-services-form";
import { QuoteFlow } from "@/components/quote/quote-flow";

export default function QuotePage() {
  return (
    <main className="min-h-screen bg-slate-50 py-10 text-slate-900 sm:py-16">
      <div className="container max-w-4xl space-y-12">
      {/* Cotizador Principal de Yarda (7 pasos) */}
      <QuoteFlow />

      {/* Sección Secundaria para Otros Trabajos */}
      <div className="pt-6">
        <OtherServicesForm />
      </div>
      </div>
    </main>
  );
}
