import { cookies } from "next/headers";
import { LOCALE_COOKIE } from "@/lib/i18n/config";
import { normalizeLocale } from "@/lib/i18n";
import Link from "next/link";

import { PublicPage } from "@/components/site/public-page";
import { PhotoShowcase } from "@/components/site/photo-showcase";
import { BUSINESS } from "@/lib/constants";

export async function generateMetadata() {
  const isEs = normalizeLocale((await cookies()).get(LOCALE_COOKIE)?.value) === "es";
  return { title: `${isEs ? "Estimados" : "Estimates"} | Nieto Green Care LLC` };
}

export default async function PricingPage() {
  const isEs = normalizeLocale((await cookies()).get(LOCALE_COOKIE)?.value) === "es";
  return <PublicPage>
    <section className="container max-w-3xl py-20 text-center">
      <span className="text-sm font-bold uppercase tracking-widest text-green-700">{isEs ? "Precio de corte por área" : "Mowing price by area"}</span>
      <h1 className="mt-4 font-display text-4xl font-bold text-slate-900 sm:text-5xl">{isEs ? "Mide tu césped y conoce tu tarifa de corte" : "Measure your lawn and see your mowing rate"}</h1>
      <p className="mx-auto mt-6 max-w-2xl text-lg text-slate-600">{isEs ? "Marca el área de césped en el mapa satelital y conoce el precio semanal o quincenal por corte cuando el dueño haya configurado la tarifa para tu medida. Los otros trabajos reciben un estimado personal." : "Mark the lawn area on the satellite map and see the weekly or biweekly price per visit when the owner has configured a rate for your lawn size. Other services receive a personalized estimate."}</p>
      <div className="mt-9 flex flex-wrap justify-center gap-3">
        <Link href="/quote" className="rounded-full bg-green-500 px-7 py-3 font-bold text-slate-950 hover:bg-green-400">{isEs ? "Empezar solicitud" : "Start your request"}</Link>
        <a href={BUSINESS.telHref} className="rounded-full border border-slate-300 px-7 py-3 font-bold text-slate-900 hover:bg-slate-50">{isEs ? "Llamar ahora" : "Call now"}</a>
      </div>
    </section>
    <PhotoShowcase heading={isEs ? "Cuidado de jardines que puedes ver" : "Lawn care you can see"} />
  </PublicPage>;
}
