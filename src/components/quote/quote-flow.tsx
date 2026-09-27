"use client";

import * as React from "react";
import Link from "next/link";
import { ArrowLeft, CheckCircle2, MessageSquare, Send, ShieldCheck } from "lucide-react";

import { useLanguage } from "@/components/providers/language-provider";
import { useToast } from "@/components/providers/toast-provider";
import { PropertySatellite } from "@/components/quote/property-satellite";
import { Step1Address, Step1AddressHint } from "@/components/quote/step-1-address";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { FieldError, Input, Label, Textarea } from "@/components/ui/input";
import { BUSINESS, SERVICES, ZIP_CITY_MAP } from "@/lib/constants";
import { polygonAreaSquareFeet } from "@/lib/geo";
import { matchMowRate, type MowRate } from "@/lib/instant-pricing";
import { formatZodErrors, step1Schema, step7Schema } from "@/lib/validation";
import type { PaymentMethod, PolygonPoint } from "@/lib/types";
import { buildMeasurement, pickSubmissionFields, TOTAL_STEPS, useQuoteStore, type QuoteStore } from "@/store/quote-store";

type AddressSuggestion = {
  id: string;
  label: string;
  address: string;
  city: string;
  zipCode: string;
  state: string;
  latitude: number;
  longitude: number;
};

type LawnDetectionResponse = {
  ok?: boolean;
  formattedAddress?: string;
  latitude?: number;
  longitude?: number;
  polygons?: PolygonPoint[][];
  parcelPolygons?: PolygonPoint[][];
  areaSqM?: number;
  areaSqFt?: number;
};

const SQ_FT_PER_SQ_M = 10.7639;
const FEET_PER_LATITUDE_DEGREE = 364000;

function feetToLatitude(feet: number) {
  return feet / FEET_PER_LATITUDE_DEGREE;
}

function feetToLongitude(feet: number, latitude: number) {
  return feet / (FEET_PER_LATITUDE_DEGREE * Math.cos((latitude * Math.PI) / 180));
}

function rectangleFromFeet(
  latitude: number,
  longitude: number,
  southFeet: number,
  westFeet: number,
  northFeet: number,
  eastFeet: number,
): PolygonPoint[] {
  return [
    { lat: latitude + feetToLatitude(southFeet), lng: longitude + feetToLongitude(westFeet, latitude) },
    { lat: latitude + feetToLatitude(southFeet), lng: longitude + feetToLongitude(eastFeet, latitude) },
    { lat: latitude + feetToLatitude(northFeet), lng: longitude + feetToLongitude(eastFeet, latitude) },
    { lat: latitude + feetToLatitude(northFeet), lng: longitude + feetToLongitude(westFeet, latitude) },
  ];
}

function estimateLawnAreas(latitude: number, longitude: number, targetAreaSqFt: number) {
  const scale = Math.max(0.7, Math.min(2.2, Math.sqrt(targetAreaSqFt / 3200)));
  const lotHalfWidth = 62 * scale;
  const lotHalfDepth = 76 * scale;
  const houseHalfWidth = 30 * scale;
  const drivewayHalfWidth = 12 * scale;
  const polygons = [
    rectangleFromFeet(latitude, longitude, 28 * scale, -lotHalfWidth, lotHalfDepth, lotHalfWidth),
    rectangleFromFeet(latitude, longitude, -lotHalfDepth, -lotHalfWidth, -34 * scale, -drivewayHalfWidth),
    rectangleFromFeet(latitude, longitude, -lotHalfDepth, drivewayHalfWidth, -34 * scale, lotHalfWidth),
    rectangleFromFeet(latitude, longitude, -34 * scale, -lotHalfWidth, 24 * scale, -houseHalfWidth),
    rectangleFromFeet(latitude, longitude, -34 * scale, houseHalfWidth, 24 * scale, lotHalfWidth),
  ];
  const parcelPolygons = [
    rectangleFromFeet(latitude, longitude, -lotHalfDepth - 6 * scale, -lotHalfWidth - 6 * scale, lotHalfDepth + 6 * scale, lotHalfWidth + 6 * scale),
  ];
  const area = polygons.reduce((total, polygon) => total + polygonAreaSquareFeet(polygon), 0);
  return { polygons, parcelPolygons, area };
}

export function QuoteFlow({ embedded = false }: { embedded?: boolean }) {
  const { isEs } = useLanguage();
  const { toast } = useToast();
  const store = useQuoteStore();
  const [hydrated, setHydrated] = React.useState(false);
  const [errors, setErrors] = React.useState<Record<string, string>>({});
  const [rates, setRates] = React.useState<MowRate[]>([]);
  const [sending, setSending] = React.useState(false);
  const [gateAnswer, setGateAnswer] = React.useState<"yes" | "no" | "">("");
  const [areaInput, setAreaInput] = React.useState("2500");

  React.useEffect(() => {
    void fetch("/api/lawn-rates", { cache: "no-store" })
      .then(async (response) => {
        if (!response.ok) throw new Error("rates");
        const payload = await response.json();
        setRates(payload.data ?? []);
      })
      .catch(() => setRates([]));
  }, []);

  React.useEffect(() => {
    const applyUrlAddress = () => {
      const query = new URLSearchParams(window.location.search);
      const address = query.get("address");
      const zipCode = query.get("zip");
      if (address && zipCode && /^\d{5}$/.test(zipCode)) {
        useQuoteStore.getState().setAddress({ address, formattedAddress: address, zipCode, city: ZIP_CITY_MAP[zipCode] ?? "" });
        useQuoteStore.getState().setStep(1);
      }
      setHydrated(true);
    };
    try {
      const result = useQuoteStore.persist?.rehydrate();
      if (result && typeof (result as Promise<void>).then === "function") {
        void (result as Promise<void>).then(applyUrlAddress).catch(applyUrlAddress);
      } else {
        applyUrlAddress();
      }
    } catch {
      applyUrlAddress();
    }
  }, []);

  React.useEffect(() => {
    if (store.measurement) setAreaInput(String(Math.round(store.measurement.areaSqFt)));
  }, [store.measurement]);

  React.useEffect(() => {
    if (store.step !== 2 || store.measurement || store.latitude == null || store.longitude == null) return;
    let cancelled = false;
    const applyFallback = () => {
      const estimate = estimateLawnAreas(store.latitude!, store.longitude!, 2500);
      store.setMeasurement(buildMeasurement(estimate.polygons[0], estimate.area, 2, 19, estimate.polygons, estimate.parcelPolygons));
    };
    void fetch(`/api/lawn-detect?address=${encodeURIComponent(store.formattedAddress || store.address)}`, { cache: "no-store" })
      .then(async (response) => {
        if (!response.ok) throw new Error("lawn-detect");
        return (await response.json()) as LawnDetectionResponse;
      })
      .then((payload) => {
        if (cancelled) return;
        const polygons = payload.polygons?.filter((path) => path.length >= 3) ?? [];
        const areaSqFt = Number(payload.areaSqFt);
        if (!payload.ok || !polygons.length || !Number.isFinite(areaSqFt) || areaSqFt <= 0) {
          applyFallback();
          return;
        }
        if (typeof payload.latitude === "number" && typeof payload.longitude === "number") {
          store.setAddress({
            formattedAddress: payload.formattedAddress || store.formattedAddress,
            latitude: payload.latitude,
            longitude: payload.longitude,
          });
        }
        const parcelPolygons = payload.parcelPolygons?.filter((path) => path.length >= 3) ?? [];
        store.setMeasurement(buildMeasurement(polygons[0], areaSqFt, 2, 19, polygons, parcelPolygons.length ? parcelPolygons : undefined));
      })
      .catch(() => {
        if (!cancelled) applyFallback();
      });
    return () => { cancelled = true; };
  }, [
    store.address,
    store.formattedAddress,
    store.latitude,
    store.longitude,
    store.measurement,
    store.setAddress,
    store.setMeasurement,
    store.step,
  ]);

  const rate = matchMowRate(rates, store.measurement?.areaSqFt ?? 0, store.mowFrequency);
  const price = rate ? Number(rate.price) : null;

  const resolveCoordinates = async () => {
    const current = useQuoteStore.getState();
    if (current.latitude != null && current.longitude != null) return true;
    const response = await fetch(`/api/address-search?q=${encodeURIComponent(current.address)}`);
    const payload = (await response.json()) as { suggestions?: AddressSuggestion[] };
    const suggestion = payload.suggestions?.find((item) => item.zipCode === current.zipCode) ?? payload.suggestions?.[0];
    if (!suggestion) return false;
    current.setAddress({
      address: suggestion.label || suggestion.address,
      formattedAddress: suggestion.label,
      city: suggestion.city,
      zipCode: suggestion.zipCode || current.zipCode,
      state: suggestion.state || "TX",
      placeId: suggestion.id,
      latitude: suggestion.latitude,
      longitude: suggestion.longitude,
    });
    return true;
  };

  const next = async () => {
    const current = useQuoteStore.getState();
    if (current.step === 1) {
      const result = step1Schema.safeParse(current);
      if (!result.success) {
        setErrors(formatZodErrors(result.error));
        toast({ title: isEs ? "Revise la dirección y el código postal" : "Review the address and ZIP code", variant: "error" });
        return;
      }
      try {
        if (!(await resolveCoordinates())) {
          setErrors({ address: isEs ? "Seleccione una sugerencia de dirección para ubicar la propiedad." : "Select an address suggestion to locate the property." });
          return;
        }
      } catch {
        setErrors({ address: isEs ? "No se pudo ubicar la dirección. Seleccione una sugerencia." : "Could not locate the address. Select a suggestion." });
        return;
      }
    }
    if (current.step === 2 && !current.measurement) {
      setErrors({ measurement: isEs ? "No se pudo estimar el área de la propiedad." : "Could not estimate the property area." });
      return;
    }
    if (current.step === 3) {
      const result = step7Schema.safeParse(current);
      if (!result.success || !gateAnswer) {
        if (result.success) setErrors({ hasGateCode: isEs ? "Indique si el patio tiene candado o portón." : "Choose whether the yard has a lock or gate." });
        else setErrors(formatZodErrors(result.error));
        toast({ title: isEs ? "Complete los datos requeridos" : "Complete the required details", variant: "error" });
        return;
      }
    }
    setErrors({});
    current.goNext();
  };

  const updateArea = (value: string) => {
    setAreaInput(value);
    const area = Number(value);
    const current = useQuoteStore.getState();
    if (!Number.isFinite(area) || area < 500 || area > 250000 || current.latitude == null || current.longitude == null) return;
    const estimate = estimateLawnAreas(current.latitude, current.longitude, area);
    current.setMeasurement(buildMeasurement(estimate.polygons[0], estimate.area, 2, 19, estimate.polygons, estimate.parcelPolygons));
  };

  const submit = async () => {
    const current = useQuoteStore.getState();
    if (price === null || !current.measurement) {
      toast({ title: isEs ? "No se pudo calcular la tarifa." : "Could not calculate the rate.", variant: "error" });
      return;
    }
    if (!current.requestedDate) {
      setErrors({ requestedDate: isEs ? "Seleccione el día preferido para el corte." : "Choose your preferred service date." });
      return;
    }
    if (current.paymentMethod === "cash" && current.cashLocation.trim().length < 3) {
      setErrors({ cashLocation: isEs ? "Indique dónde dejará el efectivo." : "Tell us where you will leave cash." });
      return;
    }
    setSending(true);
    setErrors({});
    try {
      const referenceCode = current.ensureReferenceCode();
      const response = await fetch("/api/leads", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...pickSubmissionFields(useQuoteStore.getState()), referenceCode, quotedPrice: price, snapshotUrl: null }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok || !payload.ok) throw new Error(payload.error ?? (isEs ? "No se pudo enviar la solicitud." : "Failed to send the request."));

      const submitted = useQuoteStore.getState();
      const jobNames = submitted.selectedServices.map((key) => {
        const service = SERVICES.find((item) => item.key === key);
        return service ? (isEs ? service.nameEs : service.nameEn) : key;
      });
      const smsBody = [
        `${BUSINESS.name} - ${isEs ? "Cotización instantánea" : "Instant quote"}`,
        `Folio: ${referenceCode}`,
        `Dirección: ${submitted.address}`,
        `Área de césped: ${Math.round(submitted.measurement?.areaSqFt ?? 0).toLocaleString()} sq ft`,
        `Tarifa: $${Number(payload.data?.price ?? price).toFixed(2)} / ${submitted.mowFrequency === "weekly" ? "weekly" : "bi-weekly"}`,
        `Trabajos: ${jobNames.join(", ")}`,
        `Día preferido: ${submitted.requestedDate}`,
        `Cliente: ${submitted.customerName}`,
        `Teléfono: ${submitted.customerPhone}`,
        `Candado/portón: ${submitted.hasGateCode ? `Sí (${submitted.gateCode})` : "No"}`,
        submitted.additionalNotes.trim() ? `Notas: ${submitted.additionalNotes.trim()}` : "",
      ].filter(Boolean).join("\n");
      const smsUrl = `${BUSINESS.smsHref}?body=${encodeURIComponent(smsBody)}`;
      submitted.markSubmitted();
      window.location.href = smsUrl;
    } catch (error) {
      toast({ title: error instanceof Error ? error.message : (isEs ? "Error al enviar" : "Could not submit"), variant: "error" });
    } finally {
      setSending(false);
    }
  };

  if (!hydrated) return <div className="py-24 text-center text-slate-500">{isEs ? "Cargando cotizador…" : "Loading quote…"}</div>;
  if (store.submitted) return <Confirmation isEs={isEs} store={store} price={price} onReset={store.reset} />;

  const polygon = store.measurement?.polygons ?? (store.measurement?.polygon ? [store.measurement.polygon] : []);
  const parcelPolygon = store.measurement?.parcelPolygons;
  const lawnAreaSqFt = Math.round(store.measurement?.areaSqFt ?? 0);
  const lawnAreaSqM = Math.round(((store.measurement?.areaSqFt ?? 0) / SQ_FT_PER_SQ_M) * 100) / 100;

  return (
    <div className="mx-auto max-w-3xl space-y-5">
      {!embedded && <Link href="/" className="inline-flex items-center gap-2 text-sm font-semibold text-emerald-800 hover:text-emerald-600"><ArrowLeft className="size-4" />{isEs ? "Volver al inicio" : "Back to home"}</Link>}
      <Card className="border-emerald-300 bg-white shadow-xl shadow-emerald-950/10">
        <CardHeader className="space-y-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <CardTitle className="text-2xl font-bold text-slate-950">{isEs ? "Cotización instantánea de césped" : "Instant Lawn Quote"}</CardTitle>
            <span className="rounded-full bg-emerald-100 px-3 py-1 text-sm font-bold text-emerald-900">{isEs ? `Paso ${store.step} de ${TOTAL_STEPS}` : `Step ${store.step} of ${TOTAL_STEPS}`}</span>
          </div>
          <div className="grid grid-cols-4 gap-2" aria-label={isEs ? "Progreso de cotización" : "Quote progress"}>
            {Array.from({ length: TOTAL_STEPS }, (_, index) => <span key={index} className={`h-2 rounded-full ${index + 1 <= store.step ? "bg-emerald-500" : "bg-slate-200"}`} />)}
          </div>
        </CardHeader>

        <CardContent className="space-y-7">
          {store.step === 1 && <section className="space-y-5">
            <h2 className="text-xl font-bold text-slate-900">{isEs ? "1. Dirección y código postal" : "1. Address and ZIP code"}</h2>
            <div><Step1Address error={errors.address} isEs={isEs} /><Step1AddressHint isEs={isEs} /><FieldError>{errors.address}</FieldError></div>
            <div><Label htmlFor="quote-zip">{isEs ? "Código postal *" : "ZIP code *"}</Label><Input id="quote-zip" required inputMode="numeric" value={store.zipCode} maxLength={5} onChange={(event) => { const zipCode = event.target.value.replace(/\D/g, "").slice(0, 5); store.setAddress({ zipCode, city: ZIP_CITY_MAP[zipCode] ?? "" }); }} placeholder="78642" className="mt-2" /><FieldError>{errors.zipCode}</FieldError></div>
          </section>}

          {store.step === 2 && <section className="space-y-5">
            <div><h2 className="text-xl font-bold text-slate-900">{isEs ? "2. Estimación satelital" : "2. Satellite estimate"}</h2><p className="mt-1 text-sm text-slate-600">{isEs ? "Estimación aproximada basada en la ubicación. Ajuste los pies cuadrados para reflejar el césped que se cortará." : "Approximate location-based estimate. Adjust the square footage to match the lawn area to be mowed."}</p></div>
            <PropertySatellite address={store.address} latitude={store.latitude} longitude={store.longitude} isEs={isEs} polygon={polygon} parcelPolygon={parcelPolygon} />
            <p className="font-bold text-emerald-900">{isEs ? "Área del jardín" : "Lawn area"}: {lawnAreaSqM.toLocaleString()} m² · {lawnAreaSqFt.toLocaleString()} ft²</p>
            <div><Label htmlFor="quote-area">{isEs ? "Pies cuadrados estimados" : "Estimated square footage"}</Label><Input id="quote-area" type="number" min={500} max={250000} step={100} value={areaInput} onChange={(event) => updateArea(event.target.value)} className="mt-2 max-w-xs" /><FieldError>{errors.measurement}</FieldError></div>
            <div className="rounded-lg bg-emerald-50 p-4 text-sm font-semibold text-emerald-950">{price !== null ? `$${price.toFixed(2)} / ${store.mowFrequency === "weekly" ? (isEs ? "semanal" : "weekly") : (isEs ? "quincenal" : "bi-weekly")}` : (isEs ? "Calculando tarifa…" : "Calculating rate…")}</div>
          </section>}

          {store.step === 3 && <section className="space-y-6">
            <div><h2 className="text-xl font-bold text-slate-900">{isEs ? "SELECCIONE LOS TRABAJOS A REALIZAR" : "SELECT SERVICES TO PERFORM"}</h2><p className="mt-1 text-sm text-slate-600">{isEs ? "El servicio de césped está incluido. Seleccione cualquier trabajo adicional." : "Lawn service is included. Select any additional work."}</p></div>
            <div className="grid gap-2 sm:grid-cols-3">{SERVICES.filter((service) => service.key !== "weekly_biweekly_lawn_service").map((service) => {
              const selected = store.selectedServices.includes(service.key);
              return <button key={service.key} type="button" aria-pressed={selected} onClick={() => store.toggleService(service.key)} className={`min-h-12 rounded-lg border px-3 py-2 text-left text-sm font-semibold transition ${selected ? "border-emerald-700 bg-emerald-50 text-emerald-900" : "border-slate-200 bg-white text-slate-700 hover:border-emerald-400"}`}>{isEs ? service.nameEs : service.nameEn}</button>;
            })}</div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div><Label htmlFor="quote-customer-name">{isEs ? "Nombre completo *" : "Full name *"}</Label><Input id="quote-customer-name" required value={store.customerName} onChange={(event) => store.setPersonal({ customerName: event.target.value, firstName: event.target.value, lastName: "" })} className="mt-2" /><FieldError>{errors.customerName}</FieldError></div>
              <div><Label htmlFor="quote-customer-phone">{isEs ? "Teléfono *" : "Phone *"}</Label><Input id="quote-customer-phone" required type="tel" value={store.customerPhone} onChange={(event) => store.setPersonal({ customerPhone: event.target.value })} className="mt-2" /><FieldError>{errors.customerPhone}</FieldError></div>
            </div>
            <fieldset><legend className="text-sm font-semibold text-slate-800">{isEs ? "¿El patio tiene candado o portón? *" : "Does the yard have a lock or gate? *"}</legend><div className="mt-2 flex gap-3">{(["yes", "no"] as const).map((answer) => <button key={answer} type="button" aria-pressed={gateAnswer === answer} onClick={() => { setGateAnswer(answer); store.setGate(answer === "yes", answer === "yes" ? store.gateCode : ""); }} className={`rounded-lg border px-5 py-2 font-semibold ${gateAnswer === answer ? "border-emerald-700 bg-emerald-700 text-white" : "border-slate-300 bg-white text-slate-800"}`}>{answer === "yes" ? (isEs ? "Sí" : "Yes") : (isEs ? "No" : "No")}</button>)}</div><FieldError>{errors.hasGateCode}</FieldError>{store.hasGateCode && <div className="mt-3 max-w-sm"><Label htmlFor="quote-gate-code">{isEs ? "Código o número del candado *" : "Gate or lock code *"}</Label><Input id="quote-gate-code" required value={store.gateCode} onChange={(event) => store.setGate(true, event.target.value)} className="mt-2" /><FieldError>{errors.gateCode}</FieldError></div>}</fieldset>
            <div><Label htmlFor="quote-notes">{isEs ? "Comentarios / notas de la obra" : "Work comments / notes"}</Label><Textarea id="quote-notes" rows={3} maxLength={2000} value={store.additionalNotes} onChange={(event) => store.setPersonal({ additionalNotes: event.target.value })} className="mt-2" /></div>
          </section>}

          {store.step === 4 && <section className="space-y-6">
            <div className="grid gap-5 border-b border-emerald-100 pb-5 sm:grid-cols-[1fr_1fr]">
              <div><h2 className="text-2xl font-extrabold text-emerald-950">My Custom Lawn Mowing Plan</h2><p className="mt-3 text-2xl font-bold text-emerald-800">{price !== null ? `$${price.toFixed(2)} / ${store.mowFrequency === "weekly" ? (isEs ? "semanal" : "weekly") : (isEs ? "quincenal" : "bi-weekly")}` : ""}</p><p className="mt-2 text-sm text-slate-600">{store.address}</p></div>
              <PropertySatellite address={store.address} latitude={store.latitude} longitude={store.longitude} isEs={isEs} compact polygon={polygon} parcelPolygon={parcelPolygon} />
            </div>
            <p className="font-bold text-emerald-900">{isEs ? "Área del jardín" : "Lawn area"}: {lawnAreaSqM.toLocaleString()} m² · {lawnAreaSqFt.toLocaleString()} ft²</p>
            <div className="grid gap-3 text-sm sm:grid-cols-2"><p><strong>{isEs ? "Frecuencia" : "Frequency"}:</strong> {store.mowFrequency === "weekly" ? (isEs ? "Semanal" : "Weekly") : (isEs ? "Quincenal" : "Bi-weekly")}</p><p><strong>{isEs ? "Día preferido" : "Preferred service day"}:</strong> {store.requestedDate || (isEs ? "Seleccione una fecha" : "Choose a date")}</p><p className="sm:col-span-2"><strong>{isEs ? "Trabajos" : "Services"}:</strong> {store.selectedServices.map((key) => { const service = SERVICES.find((item) => item.key === key); return service ? (isEs ? service.nameEs : service.nameEn) : key; }).join(", ")}</p><p><strong>{isEs ? "Cliente" : "Customer"}:</strong> {store.customerName}</p><p><strong>{isEs ? "Teléfono" : "Phone"}:</strong> {store.customerPhone}</p><p><strong>{isEs ? "Candado/portón" : "Lock/gate"}:</strong> {store.hasGateCode ? `${isEs ? "Sí" : "Yes"} · ${store.gateCode}` : (isEs ? "No" : "No")}</p><p><strong>{isEs ? "Notas" : "Notes"}:</strong> {store.additionalNotes || "—"}</p></div>
            <div className="rounded-lg bg-slate-50 p-4"><p className="text-sm font-bold text-emerald-900">{isEs ? "Incluido en cada corte" : "Included with each mow"}</p><p className="mt-2 text-sm text-slate-700">Mow lawn · Line trim · Edge · Blow debris</p></div>
            <div className="max-w-sm"><Label htmlFor="quote-service-date">{isEs ? "Día preferido para el corte *" : "Preferred service day *"}</Label><Input id="quote-service-date" type="date" min={new Date().toISOString().slice(0, 10)} value={store.requestedDate ?? ""} onChange={(event) => store.setSchedule(event.target.value)} className="mt-2" /><FieldError>{errors.requestedDate}</FieldError></div>
            <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-4">
              <h3 className="font-bold text-emerald-950">{isEs ? "Método de pago" : "Payment method"}</h3>
              <select value={store.paymentMethod} onChange={(event) => store.setPaymentMethod(event.target.value as PaymentMethod)} className="mt-3 min-h-11 w-full max-w-sm rounded-lg border border-slate-300 bg-white px-3 text-slate-900">
                <option value="cash">{isEs ? "Efectivo" : "Cash"}</option><option value="cash_app">Cash App</option><option value="venmo">Venmo</option><option value="zelle">Zelle</option>
              </select>
              {store.paymentMethod === "cash" && <div className="mt-3 max-w-sm"><Label htmlFor="quote-cash-location">{isEs ? "¿Dónde dejará el efectivo? *" : "Where will you leave cash? *"}</Label><Input id="quote-cash-location" value={store.cashLocation} onChange={(event) => store.setPersonal({ cashLocation: event.target.value })} className="mt-2" /><FieldError>{errors.cashLocation}</FieldError></div>}
              <div className="mt-3 flex flex-wrap gap-3"><a href={BUSINESS.venmoUrl} target="_blank" rel="noreferrer" className="rounded-lg border border-slate-200 bg-white px-3 py-2 font-semibold text-slate-900">Venmo · {BUSINESS.venmoHandle}</a><a href={BUSINESS.cashAppUrl} target="_blank" rel="noreferrer" className="rounded-lg border border-slate-200 bg-white px-3 py-2 font-semibold text-slate-900">Cash App · {BUSINESS.cashAppTag}</a></div>
            </div>
            <p className="text-sm text-slate-600">{isEs ? "Gracias por elegir Nieto Green Care LLC. Al confirmar, guardaremos su solicitud y abriremos un SMS para el propietario." : "Thank you for choosing Nieto Green Care LLC. Confirming saves your request and opens a text to the owner."}</p>
          </section>}

          <div className="flex justify-between gap-3 border-t border-slate-200 pt-5">
            {store.step > 1 ? <Button type="button" variant="outline" onClick={store.goBack}>{isEs ? "Anterior" : "Back"}</Button> : <span />}
            {store.step < TOTAL_STEPS ? <Button type="button" onClick={() => void next()} className="bg-emerald-700 font-bold hover:bg-emerald-800">{isEs ? "Continuar" : "Continue"}</Button> : <Button type="button" onClick={() => void submit()} disabled={sending} className="bg-emerald-700 font-bold hover:bg-emerald-800"><Send className="mr-2 size-4" />{sending ? (isEs ? "Enviando…" : "Sending…") : (isEs ? "CONFIRMAR Y ENVIAR SMS" : "CONFIRM & TEXT OWNER")}</Button>}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function Confirmation({ isEs, store, price, onReset }: { isEs: boolean; store: QuoteStore; price: number | null; onReset: () => void }) {
  const smsBody = `${BUSINESS.name} - Folio ${store.referenceCode ?? ""}\n${store.address}\n${store.customerName} · ${store.customerPhone}`;
  return <Card className="mx-auto max-w-2xl space-y-5 p-8 text-center"><CardContent className="space-y-5"><ShieldCheck className="mx-auto size-14 text-emerald-700" /><h1 className="text-2xl font-extrabold text-slate-950">{isEs ? "¡Gracias por su preferencia!" : "Thank you for choosing us!"}</h1><p className="text-sm text-slate-600">{isEs ? "La solicitud se guardó. Envíe el mensaje para contactar al propietario." : "Your request was saved. Send the text to contact the owner."}</p><p className="text-xl font-bold text-emerald-800">{price !== null ? `$${price.toFixed(2)} / ${store.mowFrequency === "weekly" ? "weekly" : "bi-weekly"}` : ""}</p><a href={`${BUSINESS.smsHref}?body=${encodeURIComponent(smsBody)}`} className="inline-flex items-center rounded-lg bg-emerald-700 px-4 py-3 font-bold text-white"><MessageSquare className="mr-2 size-4" />{isEs ? "Enviar SMS al propietario" : "Text the owner"}</a><div><Button variant="outline" onClick={onReset}><CheckCircle2 className="mr-2 size-4" />{isEs ? "Nueva cotización" : "New quote"}</Button></div></CardContent></Card>;
}
