import { cookies } from "next/headers";
import { LOCALE_COOKIE } from "@/lib/i18n/config";
import { normalizeLocale } from "@/lib/i18n";

import { QuoteFlow } from "@/components/quote/quote-flow";
import { PhotoShowcase } from "@/components/site/photo-showcase";

export default async function QuotePage() {
  const isEs = normalizeLocale((await cookies()).get(LOCALE_COOKIE)?.value) === "es";
  return (
    <main className="relative min-h-screen overflow-hidden bg-[radial-gradient(ellipse_at_12%_6%,#bbf7d0_0%,transparent_42%),radial-gradient(ellipse_at_88%_48%,#d9f99d_0%,transparent_40%),linear-gradient(180deg,#f0fdf4_0%,#ecfccb_54%,#dcfce7_100%)] text-slate-900">
      <div className="container relative max-w-4xl space-y-12 py-10 sm:py-16">
        <QuoteFlow />
      </div>
      <PhotoShowcase heading={isEs ? "Ejemplos de los jardines que cuidamos" : "Examples of the yards we care for"} start={3} />
    </main>
  );
}
