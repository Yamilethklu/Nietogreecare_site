import { OtherServicesForm } from "@/components/quote/other-services-form";
import { QuoteFlow } from "@/components/quote/quote-flow";
import { PhotoShowcase } from "@/components/site/photo-showcase";

export default function QuotePage() {
  return (
    <main className="relative min-h-screen overflow-hidden bg-[radial-gradient(ellipse_at_12%_6%,#bbf7d0_0%,transparent_42%),radial-gradient(ellipse_at_88%_48%,#d9f99d_0%,transparent_40%),linear-gradient(180deg,#f0fdf4_0%,#ecfccb_54%,#dcfce7_100%)] text-slate-900">
      <div className="container relative max-w-4xl space-y-12 py-10 sm:py-16">
      {/* Cotizador Principal de Yarda (7 pasos) */}
      <QuoteFlow />

      {/* Sección Secundaria para Otros Trabajos */}
      <div className="pt-6">
        <OtherServicesForm />
      </div>
      </div>
      <PhotoShowcase heading="Ejemplos de los jardines que cuidamos" start={3} />
    </main>
  );
}
