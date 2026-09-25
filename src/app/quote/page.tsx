"use client";

import { OtherServicesForm } from "@/components/quote/other-services-form";
import { QuoteFlow } from "@/components/quote/quote-flow";

export default function QuotePage() {
  return (
    <main className="container max-w-4xl py-10 sm:py-16 space-y-12">
      {/* Cotizador Principal de Yarda (7 pasos) */}
      <QuoteFlow />

      {/* Sección Secundaria para Otros Trabajos */}
      <div className="pt-6">
        <OtherServicesForm />
      </div>
    </main>
  );
}
