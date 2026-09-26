import Link from "next/link";

import { PublicPage } from "@/components/site/public-page";
import { PhotoShowcase } from "@/components/site/photo-showcase";
import { BUSINESS } from "@/lib/constants";

export const metadata = { title: "Estimados | Nieto Green Care LLC" };

export default function PricingPage() {
  return <PublicPage>
    <section className="container max-w-3xl py-20 text-center">
      <span className="text-sm font-bold uppercase tracking-widest text-green-700">Precio de corte por área</span>
      <h1 className="mt-4 font-display text-4xl font-bold text-slate-900 sm:text-5xl">Mide tu césped y conoce tu tarifa de corte</h1>
      <p className="mx-auto mt-6 max-w-2xl text-lg text-slate-600">Marca el área de césped en el mapa satelital y conoce el precio semanal o quincenal por corte cuando el dueño haya configurado la tarifa para tu medida. Los otros trabajos reciben un estimado personal.</p>
      <div className="mt-9 flex flex-wrap justify-center gap-3">
        <Link href="/quote" className="rounded-full bg-green-500 px-7 py-3 font-bold text-slate-950 hover:bg-green-400">Empezar solicitud</Link>
        <a href={BUSINESS.telHref} className="rounded-full border border-slate-300 px-7 py-3 font-bold text-slate-900 hover:bg-slate-50">Llamar ahora</a>
      </div>
    </section>
    <PhotoShowcase heading="Cuidado de jardines que puedes ver" />
  </PublicPage>;
}
