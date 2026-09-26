"use client";

import * as React from "react";
import { MapPin, MessageSquare, Search, X } from "lucide-react";

import { useLanguage } from "@/components/providers/language-provider";
import { buildOwnerSmsHref, SERVICE_CITIES, SERVICE_ZIP_CODES, ZIP_CITY_MAP } from "@/lib/constants";

/** Elige una zona antes de abrir la app nativa de SMS. */
export function FloatingContact() {
  const { isEs } = useLanguage();
  const [open, setOpen] = React.useState(false);
  const [search, setSearch] = React.useState("");
  const searchRef = React.useRef<HTMLInputElement>(null);
  const triggerRef = React.useRef<HTMLButtonElement>(null);

  React.useEffect(() => {
    if (!open) return;
    searchRef.current?.focus();
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") { setOpen(false); triggerRef.current?.focus(); }
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [open]);

  const query = search.trim().toLowerCase();
  const locations = SERVICE_CITIES.filter((city) =>
    city.toLowerCase().includes(query) || SERVICE_ZIP_CODES.some((zip) => ZIP_CITY_MAP[zip] === city && zip.includes(query)),
  );

  const textLocation = (city: string) => {
    const zip = /^\d{5}$/.test(query) && ZIP_CITY_MAP[query] === city ? ` (${query})` : "";
    window.location.href = buildOwnerSmsHref(`${city}, TX${zip}`, isEs
      ? `Hola Nieto Green Care LLC, estoy en ${city}, TX${zip} y quisiera información sobre sus servicios.`
      : `Hello Nieto Green Care LLC, I am in ${city}, TX${zip} and would like information about your services.`);
    setOpen(false);
  };

  return <div className="fixed bottom-5 right-5 z-50 no-print sm:bottom-6 sm:right-6">
    {open && <div role="dialog" aria-label={isEs ? "Seleccionar ubicación para enviar mensaje" : "Select location to text us"} className="mb-4 w-[min(21rem,calc(100vw-2.5rem))] overflow-hidden rounded-2xl border border-emerald-300 bg-white shadow-2xl shadow-emerald-950/30">
      <div className="bg-gradient-to-br from-emerald-700 to-green-500 p-6 text-white">
        <div className="flex items-start justify-between gap-4"><h2 className="text-lg font-bold">{isEs ? "Selecciona tu ubicación" : "Select Location"}</h2><button type="button" onClick={() => setOpen(false)} aria-label={isEs ? "Cerrar" : "Close"} className="rounded-full p-1 hover:bg-white/20"><X className="size-5" /></button></div>
        <p className="mt-2 text-sm">{isEs ? "Busca tu ciudad o código postal para escribirnos." : "Search your city or ZIP code to text us."}</p>
      </div>
      <div className="p-4"><label htmlFor="text-location" className="text-xs font-semibold text-emerald-900">{isEs ? "Buscar ubicación" : "Search Locations"}</label>
        <div className="mt-2 flex items-center gap-2 border-b-2 border-green-500 px-2 py-2"><Search className="size-5 shrink-0 text-green-600" /><input ref={searchRef} id="text-location" value={search} onChange={(event) => setSearch(event.target.value)} placeholder={isEs ? "Ciudad o código postal" : "City or ZIP code"} className="w-full bg-transparent text-sm text-slate-900 outline-none" /></div>
        <div className="max-h-56 overflow-y-auto py-2">{locations.length ? locations.map((city) => <button type="button" key={city} onClick={() => textLocation(city)} className="flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left hover:bg-lime-100 focus-visible:bg-lime-100 focus-visible:outline-none"><MapPin className="size-5 shrink-0 text-green-600" /><span><span className="block font-bold text-emerald-950">Nieto Green Care - {city}</span><span className="text-xs text-slate-600">{city}, Texas</span></span></button>) : <p className="px-3 py-4 text-sm text-slate-600">{isEs ? "No encontramos esa zona. Llámanos para confirmar cobertura." : "Location not found. Call us to confirm coverage."}</p>}</div>
      </div>
    </div>}
    <button ref={triggerRef} type="button" onClick={() => setOpen((value) => !value)} aria-expanded={open} aria-label={open ? (isEs ? "Cerrar chat" : "Close chat") : "Text Us"} className="ml-auto flex h-14 items-center gap-3 rounded-full bg-lime-400 px-5 font-bold text-emerald-950 shadow-lg shadow-emerald-950/25 transition hover:-translate-y-0.5 hover:bg-lime-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-700 focus-visible:ring-offset-2"><span className="relative grid size-9 place-items-center rounded-full bg-emerald-800/20">{open ? <X className="size-5" /> : <MessageSquare className="size-5" />}{!open && <span className="absolute -right-0.5 -top-0.5 size-2.5 rounded-full bg-yellow-400" />}</span>{open ? (isEs ? "Cerrar" : "Close") : "Text Us"}</button>
  </div>;
}
