"use client";

import * as React from "react";
import Link from "next/link";
import { ArrowLeft, CheckCircle2, ChevronLeft, ChevronRight, MessageSquare, Send, ShieldCheck } from "lucide-react";

import { useLanguage } from "@/components/providers/language-provider";
import { useToast } from "@/components/providers/toast-provider";
import { PropertySatellite } from "@/components/quote/property-satellite";
import { Step1Address, Step1AddressHint } from "@/components/quote/step-1-address";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { FieldError, Input, Label, Textarea } from "@/components/ui/input";
import { BUSINESS, SERVICES, ZIP_CITY_MAP } from "@/lib/constants";
import { matchMowRate, type MowRate } from "@/lib/instant-pricing";
import { getCoverageCitiesForWeekday } from "@/lib/service-schedule";
import { formatZodErrors, step1Schema, step7Schema } from "@/lib/validation";
import type { LawnGeoJsonGeometry, PaymentMethod, PolygonPoint } from "@/lib/types";
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
  error?: string;
  warning?: string;
  formattedAddress?: string;
  latitude?: number;
  longitude?: number;
  poligonoJardin?: LawnGeoJsonGeometry;
  areaMetros?: number;
  areaPies?: number;
  centro?: { lat: number; lng: number };
  huellaCasaSimulada?: boolean;
  polygons?: PolygonPoint[][];
  areaSqM?: number;
  areaSqFt?: number;
};

type AvailabilityResponse = {
  ok?: boolean;
  occupiedDates?: string[];
};

const SQ_FT_PER_SQ_M = 10.7639;
const NO_PARCEL_ERROR = "No hay datos catastrales para esta dirección";
const LAWN_COMPUTE_ERROR = "No se pudo calcular el área del jardín";
const INVALID_LAWN_ERROR = "El área del jardín no es válida";

function resolveMeasurementError(error: string | undefined, isEs: boolean) {
  switch (error) {
    case NO_PARCEL_ERROR:
      return isEs ? error : "No parcel data is available for this address.";
    case LAWN_COMPUTE_ERROR:
      return isEs ? error : "Could not calculate the lawn area.";
    case INVALID_LAWN_ERROR:
      return isEs ? error : "The lawn area is not valid.";
    case "geocode_not_found":
      return isEs ? "No se pudo geocodificar esta dirección." : "Could not geocode this address.";
    case "lawn_detection_unavailable":
    case "lawn_detection_failed":
      return isEs ? LAWN_COMPUTE_ERROR : "Could not calculate the lawn area.";
    default:
      return error || (isEs ? LAWN_COMPUTE_ERROR : "Could not calculate the lawn area.");
  }
}

function ringToPath(ring: number[][]): PolygonPoint[] {
  return ring
    .map(([lng, lat]) => ({ lat, lng }))
    .filter((point) => Number.isFinite(point.lat) && Number.isFinite(point.lng));
}

function geoJsonGeometryToPolygons(geometry: LawnGeoJsonGeometry | undefined): PolygonPoint[][] {
  if (!geometry) return [];
  if (geometry.type === "Polygon") return [ringToPath(geometry.coordinates[0] ?? [])].filter((path) => path.length >= 3);
  return geometry.coordinates.map((polygon) => ringToPath(polygon[0] ?? [])).filter((path) => path.length >= 3);
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
  const [measurementWarning, setMeasurementWarning] = React.useState("");
  const [measurementLoading, setMeasurementLoading] = React.useState(false);

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
    if (store.paymentMethod === "cash") store.setPaymentMethod("venmo");
  }, [store.paymentMethod, store.setPaymentMethod]);

  React.useEffect(() => {
    if (store.step !== 2 || store.measurement || store.latitude == null || store.longitude == null) return;
    let cancelled = false;
    setErrors((current) => ({ ...current, measurement: "" }));
    setMeasurementWarning("");
    setMeasurementLoading(true);
    void fetch(`/api/lawn-detect?address=${encodeURIComponent(store.formattedAddress || store.address)}`, { cache: "no-store" })
      .then(async (response) => {
        const payload = (await response.json().catch(() => ({}))) as LawnDetectionResponse;
        if (!response.ok) throw new Error(resolveMeasurementError(payload.error, isEs));
        return payload;
      })
      .then((payload) => {
        if (cancelled) return;
        const polygons = geoJsonGeometryToPolygons(payload.poligonoJardin);
        const areaSqFt = Number(payload.areaPies);
        const center = payload.centro && Number.isFinite(payload.centro.lat) && Number.isFinite(payload.centro.lng) ? payload.centro : null;
        if (!payload.ok || !polygons.length || !Number.isFinite(areaSqFt) || areaSqFt <= 0) {
          setMeasurementWarning(payload.warning || "");
          setErrors((current) => ({
            ...current,
            measurement: resolveMeasurementError(payload.error, isEs),
          }));
          return;
        }
        if (typeof payload.latitude === "number" && typeof payload.longitude === "number") {
          store.setAddress({
            formattedAddress: payload.formattedAddress || store.formattedAddress,
            latitude: payload.latitude,
            longitude: payload.longitude,
          });
        }
        const measurement = buildMeasurement(polygons[0], areaSqFt, 2, 19, polygons, undefined, payload.poligonoJardin);
        if (center) measurement.center = center;
        store.setMeasurement(measurement);
        setMeasurementWarning(payload.warning || "");
      })
      .catch((error: unknown) => {
        if (!cancelled) {
          const message = error instanceof Error && error.message ? error.message : resolveMeasurementError(undefined, isEs);
          setErrors((current) => ({
            ...current,
            measurement: message,
          }));
          setMeasurementWarning("");
        }
      })
      .finally(() => {
        if (!cancelled) setMeasurementLoading(false);
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
    isEs,
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
    if (current.step === 5 && !current.city.trim()) {
      setErrors({ requestedDate: isEs ? "No se pudo determinar la ciudad. Regrese al paso 1 y confirme su dirección y código postal." : "Could not determine the city. Go back to Step 1 and confirm your address and ZIP code." });
      return;
    }
    if (current.step === 5 && !current.requestedDate) {
      setErrors({ requestedDate: isEs ? "Seleccione el día preferido para el corte." : "Choose your preferred service date." });
      return;
    }
    setErrors({});
    current.goNext();
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
        `Frecuencia: ${submitted.mowFrequency === "weekly" ? (isEs ? "Semanal" : "Weekly") : (isEs ? "Quincenal" : "Bi-weekly")}`,
        `Estado de propiedad: ${submitted.propertyOccupancy === "occupied" ? (isEs ? "Ocupada" : "Occupied") : (isEs ? "Vacante" : "Vacant")}`,
        `Zona de corte: ${submitted.areaSelection === "front_back" ? (isEs ? "Frente y trasera" : "Front and back") : submitted.areaSelection === "front_only" ? (isEs ? "Solo delantera" : "Front only") : (isEs ? "Solo trasera" : "Back only")}`,
        `Trabajos: ${jobNames.join(", ")}`,
        `Día preferido: ${submitted.requestedDate}`,
        `Cliente: ${submitted.customerName}`,
        `Teléfono: ${submitted.customerPhone}`,
        `Candado/portón: ${submitted.hasGateCode ? `Sí (${submitted.gateCode})` : "No"}`,
        `Pago: ${submitted.paymentMethod === "venmo" ? "Venmo" : submitted.paymentMethod === "cash_app" ? "Cash App" : "Zelle"}`,
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
  const markerCenter = store.measurement?.center ?? null;
  const lawnGeometry = store.measurement?.lawnGeometry;
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
          <div className="grid grid-cols-7 gap-2" aria-label={isEs ? "Progreso de cotización" : "Quote progress"}>
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
            <div><h2 className="text-xl font-bold text-slate-900">{isEs ? "2. Estimación y mapa satelital automático" : "2. Automatic estimate and satellite map"}</h2><p className="mt-1 text-sm text-slate-600">{isEs ? "El sistema calcula automáticamente el jardín, excluyendo la casa." : "The system automatically calculates the lawn area excluding the house."}</p></div>
            {measurementLoading && <p className="rounded-lg bg-slate-100 px-4 py-3 text-sm font-semibold text-slate-700">{isEs ? "Analizando tu propiedad por satélite..." : "Analyzing your property by satellite..."}</p>}
            <PropertySatellite address={store.address} latitude={store.latitude} longitude={store.longitude} isEs={isEs} polygon={polygon} geometry={lawnGeometry} center={markerCenter} loadingText={isEs ? "Analizando tu propiedad por satélite..." : "Analyzing your property by satellite..."} />
            <p className="font-bold text-emerald-900">{isEs ? "Área del jardín" : "Lawn area"}: {lawnAreaSqM.toLocaleString()} m² · {lawnAreaSqFt.toLocaleString()} ft²</p>
            <FieldError>{errors.measurement}</FieldError>
            {measurementWarning && <div className="rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 text-sm font-semibold text-amber-900">{measurementWarning}</div>}
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
            <div>
              <h2 className="text-xl font-bold text-slate-900">{isEs ? "4. Opciones de servicio y frecuencia" : "4. Service options and frequency"}</h2>
            </div>
            <div className="grid gap-4 sm:grid-cols-3">
              <div>
                <p className="text-sm font-semibold text-slate-800">{isEs ? "Frecuencia" : "Frequency"}</p>
                <div className="mt-2 space-y-2">
                  <button type="button" onClick={() => store.setLawnOptions({ mowFrequency: "weekly" })} className={`w-full rounded-lg border px-3 py-2 text-left text-sm font-semibold ${store.mowFrequency === "weekly" ? "border-emerald-700 bg-emerald-50 text-emerald-900" : "border-slate-200 bg-white text-slate-700"}`}>{isEs ? "Semanal" : "Weekly"}</button>
                  <button type="button" onClick={() => store.setLawnOptions({ mowFrequency: "bi_weekly" })} className={`w-full rounded-lg border px-3 py-2 text-left text-sm font-semibold ${store.mowFrequency === "bi_weekly" ? "border-emerald-700 bg-emerald-50 text-emerald-900" : "border-slate-200 bg-white text-slate-700"}`}>{isEs ? "Quincenal" : "Bi-weekly"}</button>
                </div>
              </div>
              <div>
                <p className="text-sm font-semibold text-slate-800">{isEs ? "Estado de la propiedad" : "Property state"}</p>
                <div className="mt-2 space-y-2">
                  <button type="button" onClick={() => store.setLawnOptions({ propertyOccupancy: "occupied" })} className={`w-full rounded-lg border px-3 py-2 text-left text-sm font-semibold ${store.propertyOccupancy === "occupied" ? "border-emerald-700 bg-emerald-50 text-emerald-900" : "border-slate-200 bg-white text-slate-700"}`}>{isEs ? "Ocupado" : "Occupied"}</button>
                  <button type="button" onClick={() => store.setLawnOptions({ propertyOccupancy: "vacant" })} className={`w-full rounded-lg border px-3 py-2 text-left text-sm font-semibold ${store.propertyOccupancy === "vacant" ? "border-emerald-700 bg-emerald-50 text-emerald-900" : "border-slate-200 bg-white text-slate-700"}`}>{isEs ? "Vacante" : "Vacant"}</button>
                </div>
              </div>
              <div>
                <p className="text-sm font-semibold text-slate-800">{isEs ? "Zona de corte" : "Cut area"}</p>
                <div className="mt-2 space-y-2">
                  <button type="button" onClick={() => store.setLawnOptions({ areaSelection: "front_back" })} className={`w-full rounded-lg border px-3 py-2 text-left text-sm font-semibold ${store.areaSelection === "front_back" ? "border-emerald-700 bg-emerald-50 text-emerald-900" : "border-slate-200 bg-white text-slate-700"}`}>{isEs ? "Frente y trasera" : "Front and back"}</button>
                  <button type="button" onClick={() => store.setLawnOptions({ areaSelection: "front_only" })} className={`w-full rounded-lg border px-3 py-2 text-left text-sm font-semibold ${store.areaSelection === "front_only" ? "border-emerald-700 bg-emerald-50 text-emerald-900" : "border-slate-200 bg-white text-slate-700"}`}>{isEs ? "Solo delantera" : "Front only"}</button>
                  <button type="button" onClick={() => store.setLawnOptions({ areaSelection: "back_only" })} className={`w-full rounded-lg border px-3 py-2 text-left text-sm font-semibold ${store.areaSelection === "back_only" ? "border-emerald-700 bg-emerald-50 text-emerald-900" : "border-slate-200 bg-white text-slate-700"}`}>{isEs ? "Solo trasera" : "Back only"}</button>
                </div>
              </div>
            </div>
          </section>}

          {store.step === 5 && <section className="space-y-6">
            <div><h2 className="text-xl font-bold text-slate-900">{isEs ? "5. Calendario y cobertura por ciudad" : "5. Calendar and city coverage"}</h2><p className="mt-1 text-sm text-slate-600">{isEs ? `Ciudad detectada: ${store.city || "Sin ciudad"} · Seleccione un día disponible.` : `Detected city: ${store.city || "No city"} · Select an available day.`}</p></div>
            {store.city.trim() ? <MowingCalendar selected={store.requestedDate} city={store.city} isEs={isEs} onSelect={(date) => store.setSchedule(date, store.requestedTimeWindow ?? "08:00 - 18:00")} price={price} /> : <div className="rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 text-sm font-semibold text-amber-900">{isEs ? "Primero confirme una dirección con ciudad válida en el Paso 1 para habilitar el calendario." : "Please confirm an address with a valid city in Step 1 to unlock the calendar."}</div>}
            <FieldError>{errors.requestedDate}</FieldError>
          </section>}

          {store.step === 6 && <section className="space-y-6">
            <div className="grid gap-5 border-b border-emerald-100 pb-5 sm:grid-cols-[1fr_1fr]">
              <div><h2 className="text-2xl font-extrabold text-emerald-950">My Custom Lawn Mowing Plan</h2><p className="mt-3 text-2xl font-bold text-emerald-800">{price !== null ? `$${price.toFixed(2)} / ${store.mowFrequency === "weekly" ? (isEs ? "semanal" : "weekly") : (isEs ? "quincenal" : "bi-weekly")}` : ""}</p><p className="mt-2 text-sm text-slate-600">{store.address}</p></div>
              <PropertySatellite address={store.address} latitude={store.latitude} longitude={store.longitude} isEs={isEs} compact polygon={polygon} geometry={lawnGeometry} center={markerCenter} />
            </div>
            <p className="font-bold text-emerald-900">{isEs ? "Pies cuadrados de césped" : "Lawn square footage"}: {lawnAreaSqFt.toLocaleString()} sq ft</p>
            <div className="grid gap-3 text-sm sm:grid-cols-2"><p><strong>{isEs ? "Frecuencia" : "Frequency"}:</strong> {store.mowFrequency === "weekly" ? (isEs ? "Semanal" : "Weekly") : (isEs ? "Quincenal" : "Bi-weekly")}</p><p><strong>{isEs ? "Día elegido" : "Chosen day"}:</strong> {store.requestedDate || (isEs ? "Seleccione una fecha" : "Choose a date")}</p><p><strong>{isEs ? "Estado de propiedad" : "Property state"}:</strong> {store.propertyOccupancy === "occupied" ? (isEs ? "Ocupada" : "Occupied") : (isEs ? "Vacante" : "Vacant")}</p><p><strong>{isEs ? "Zona de corte" : "Cut area"}:</strong> {store.areaSelection === "front_back" ? (isEs ? "Frente y trasera" : "Front and back") : store.areaSelection === "front_only" ? (isEs ? "Solo delantera" : "Front only") : (isEs ? "Solo trasera" : "Back only")}</p><p className="sm:col-span-2"><strong>{isEs ? "Trabajos adicionales" : "Additional services"}:</strong> {store.selectedServices.map((key) => { const service = SERVICES.find((item) => item.key === key); return service ? (isEs ? service.nameEs : service.nameEn) : key; }).join(", ")}</p><p><strong>{isEs ? "Cliente" : "Customer"}:</strong> {store.customerName}</p><p><strong>{isEs ? "Teléfono" : "Phone"}:</strong> {store.customerPhone}</p><p><strong>{isEs ? "Candado/portón" : "Lock/gate"}:</strong> {store.hasGateCode ? `${isEs ? "Sí" : "Yes"} · ${store.gateCode}` : (isEs ? "No" : "No")}</p><p><strong>{isEs ? "Notas" : "Notes"}:</strong> {store.additionalNotes || "—"}</p></div>
            <div className="rounded-lg bg-slate-50 p-4"><p className="text-sm font-bold text-emerald-900">{isEs ? "Incluido en cada corte" : "Included with each mow"}</p><p className="mt-2 text-sm text-slate-700">Mow lawn · Line trim · Edge · Blow debris</p></div>
          </section>}

          {store.step === 7 && <section className="space-y-6">
            <div><h2 className="text-xl font-bold text-slate-900">{isEs ? "7. Pago y confirmación" : "7. Payment and confirmation"}</h2></div>
            <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-4">
              <h3 className="font-bold text-emerald-950">{isEs ? "Métodos de pago" : "Payment options"}</h3>
              <select value={store.paymentMethod} onChange={(event) => store.setPaymentMethod(event.target.value as PaymentMethod)} className="mt-3 min-h-11 w-full max-w-sm rounded-lg border border-slate-300 bg-white px-3 text-slate-900">
                <option value="venmo">Venmo</option><option value="cash_app">Cash App</option><option value="zelle">Zelle</option>
              </select>
              <div className="mt-3 flex flex-wrap gap-3"><a href={BUSINESS.venmoUrl} target="_blank" rel="noreferrer" className="rounded-lg border border-slate-200 bg-white px-3 py-2 font-semibold text-slate-900">Venmo · {BUSINESS.venmoUrl}</a><a href={BUSINESS.cashAppUrl} target="_blank" rel="noreferrer" className="rounded-lg border border-slate-200 bg-white px-3 py-2 font-semibold text-slate-900">Cash App · {BUSINESS.cashAppTag}</a><span className="rounded-lg border border-slate-200 bg-white px-3 py-2 font-semibold text-slate-900">Zelle · {BUSINESS.zellePhoneDisplay}</span></div>
            </div>
            <div className="rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 text-sm font-bold text-amber-900">{isEs ? "NOTA IMPORTANTE: Siempre que envíe su pago, asegúrese de poner su dirección en la nota del pago." : "IMPORTANT NOTE: When you send your payment, make sure to include your address in the payment note."}</div>
            <p className="text-sm text-slate-600">{isEs ? "Al confirmar, se guarda la solicitud en Supabase y se abre el SMS nativo para enviar el resumen completo al propietario." : "On confirm, your request is saved to Supabase and the native SMS app opens with the full summary for the owner."}</p>
          </section>}

          <div className="flex justify-between gap-3 border-t border-slate-200 pt-5">
            {store.step > 1 ? <Button type="button" variant="outline" onClick={store.goBack}>{isEs ? "Anterior" : "Back"}</Button> : <span />}
            {store.step < TOTAL_STEPS ? <Button type="button" onClick={() => void next()} className="bg-emerald-700 font-bold hover:bg-emerald-800">{store.step === 1 ? (isEs ? "Siguiente" : "Next") : (isEs ? "Continuar" : "Continue")}</Button> : <Button type="button" onClick={() => void submit()} disabled={sending} className="bg-emerald-700 font-bold hover:bg-emerald-800"><Send className="mr-2 size-4" />{sending ? (isEs ? "Enviando…" : "Sending…") : (isEs ? "CONFIRMAR Y ENVIAR SMS" : "CONFIRM & TEXT OWNER")}</Button>}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function MowingCalendar({ selected, city, isEs, onSelect, price }: { selected: string | null; city: string; isEs: boolean; onSelect: (date: string) => void; price: number | null }) {
  const normalizeCityKey = (value: string) => value.toLocaleLowerCase("en-US").replace(/[^a-z]/g, "");
  const todayISO = () => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  };
  const [monthOffset, setMonthOffset] = React.useState(0);
  const [occupiedDates, setOccupiedDates] = React.useState<Set<string>>(new Set());
  const [availabilityReady, setAvailabilityReady] = React.useState(true);
  const availabilityCacheRef = React.useRef<Record<string, string[]>>({});
  const now = new Date();
  const month = new Date(now.getFullYear(), now.getMonth() + monthOffset, 1);
  const firstDay = (month.getDay() + 6) % 7;
  const days = new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate();
  const labels = isEs ? ["L", "M", "M", "J", "V", "S", "D"] : ["M", "T", "W", "T", "F", "S", "S"];
  const monthKey = `${month.getFullYear()}-${String(month.getMonth() + 1).padStart(2, "0")}`;
  const normalizedCity = normalizeCityKey(city.trim());

  React.useEffect(() => {
    let cancelled = false;
    const cachedDates = availabilityCacheRef.current[monthKey];
    if (cachedDates) {
      setAvailabilityReady(true);
      setOccupiedDates(new Set(cachedDates));
      return () => { cancelled = true; };
    }
    setAvailabilityReady(false);
    void fetch(`/api/availability?month=${monthKey}`, { cache: "no-store" })
      .then(async (response) => {
        const payload = (await response.json().catch(() => ({}))) as AvailabilityResponse;
        if (!response.ok || !payload.ok) throw new Error("availability");
        return payload.occupiedDates ?? [];
      })
      .then((dates) => {
        availabilityCacheRef.current[monthKey] = dates;
        if (!cancelled) {
          setOccupiedDates(new Set(dates));
          setAvailabilityReady(true);
        }
      })
      .catch(() => {
        delete availabilityCacheRef.current[monthKey];
        if (!cancelled) {
          setAvailabilityReady(false);
        }
      });
    return () => { cancelled = true; };
  }, [monthKey]);

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 sm:p-6" aria-label={isEs ? "Calendario de corte" : "Mowing calendar"}>
      <div className="mb-5 flex items-center justify-between gap-3">
        <button type="button" disabled={monthOffset === 0} onClick={() => setMonthOffset((offset) => offset - 1)} className="rounded-lg border border-slate-200 p-2 text-slate-700 disabled:opacity-30" aria-label={isEs ? "Mes anterior" : "Previous month"}><ChevronLeft className="size-5" /></button>
        <strong className="text-sm capitalize text-slate-900">{month.toLocaleDateString(isEs ? "es-MX" : "en-US", { month: "long", year: "numeric" })}</strong>
        <button type="button" disabled={monthOffset === 3} onClick={() => setMonthOffset((offset) => offset + 1)} className="rounded-lg border border-slate-200 p-2 text-slate-700 disabled:opacity-30" aria-label={isEs ? "Mes siguiente" : "Next month"}><ChevronRight className="size-5" /></button>
      </div>
      <div className="grid grid-cols-7 gap-1 text-center sm:gap-2">
        {labels.map((label, index) => <span key={index} className="pb-1 text-xs font-bold text-slate-500">{label}</span>)}
        {Array.from({ length: firstDay }, (_, index) => <span key={`empty-${index}`} />)}
        {Array.from({ length: days }, (_, index) => {
          const date = new Date(month.getFullYear(), month.getMonth(), index + 1);
          const iso = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
          const weekday = date.getDay();
          const isWeekend = weekday === 0;
          const isCovered = normalizedCity
            ? getCoverageCitiesForWeekday(weekday).some((coveredCity) => normalizeCityKey(coveredCity) === normalizedCity)
            : false;
          const isOutOfZone = isWeekend || !isCovered;
          const isOccupied = occupiedDates.has(iso);
          const disabled = iso < todayISO() || isOutOfZone || (availabilityReady && isOccupied);
          const occupiedClass = isOccupied ? "border-red-300 bg-red-50 text-red-700 line-through" : "";
          const unavailableClass = !isOccupied && disabled ? "border-slate-100 bg-slate-50 text-slate-300" : "";
          const selectedClass = selected === iso && !disabled ? "border-green-500 bg-emerald-50 text-emerald-900" : "";
          const normalClass = !selectedClass && !occupiedClass && !unavailableClass ? "border-slate-100 text-slate-900 hover:border-emerald-300" : "";
          const dayStatusLabel = isOccupied
            ? (isEs ? "ocupado" : "occupied")
            : isOutOfZone
              ? (isEs ? "fuera de zona" : "out of zone")
              : (isEs ? "disponible" : "available");
          return <button key={iso} type="button" disabled={disabled} onClick={() => onSelect(iso)} aria-pressed={selected === iso} aria-label={`${date.toLocaleDateString(isEs ? "es-MX" : "en-US", { dateStyle: "long" })} · ${dayStatusLabel}`} className={`min-h-14 rounded-lg border px-1 py-2 text-xs sm:min-h-16 ${selectedClass || occupiedClass || unavailableClass || normalClass} disabled:cursor-not-allowed`}>
            <span className="block font-semibold">{index + 1}</span>{isOccupied ? <span className="block text-[10px] font-bold">{isEs ? "Ocupado" : "Occupied"}</span> : isOutOfZone ? <span className="block text-[10px] font-bold">{isEs ? "Fuera" : "Out"}</span> : null}{!disabled && price !== null && <span className="block text-[10px] font-bold text-emerald-700">${price.toFixed(0)}</span>}
          </button>;
        })}
      </div>
      <div className="mt-4 space-y-1 text-xs text-slate-500">
        <p>{isEs ? "Días fuera de zona y fines de semana aparecen en gris." : "Out-of-zone days and weekends appear in gray."}</p>
        <p>{isEs ? "Días ocupados aparecen en rojo y tachados." : "Occupied days appear in red with strikethrough."}</p>
        {!availabilityReady && <p className="font-semibold text-amber-700">{isEs ? "No se pudo cargar la disponibilidad. Intente nuevamente en unos segundos." : "Could not load availability. Please try again in a few seconds."}</p>}
      </div>
    </div>
  );
}

function Confirmation({ isEs, store, price, onReset }: { isEs: boolean; store: QuoteStore; price: number | null; onReset: () => void }) {
  const smsBody = `${BUSINESS.name} - Folio ${store.referenceCode ?? ""}\n${store.address}\n${store.customerName} · ${store.customerPhone}`;
  return <Card className="mx-auto max-w-2xl space-y-5 p-8 text-center"><CardContent className="space-y-5"><ShieldCheck className="mx-auto size-14 text-emerald-700" /><h1 className="text-2xl font-extrabold text-slate-950">{isEs ? "¡Muchas gracias por su preferencia! Su solicitud ha sido procesada." : "Thank you! Your request has been processed."}</h1><p className="text-sm text-slate-600">{isEs ? "La solicitud se guardó. Envíe el mensaje para contactar al propietario." : "Your request was saved. Send the text to contact the owner."}</p><p className="text-xl font-bold text-emerald-800">{price !== null ? `$${price.toFixed(2)} / ${store.mowFrequency === "weekly" ? "weekly" : "bi-weekly"}` : ""}</p><a href={`${BUSINESS.smsHref}?body=${encodeURIComponent(smsBody)}`} className="inline-flex items-center rounded-lg bg-emerald-700 px-4 py-3 font-bold text-white"><MessageSquare className="mr-2 size-4" />{isEs ? "Enviar SMS al propietario" : "Text the owner"}</a><div><Button variant="outline" onClick={onReset}><CheckCircle2 className="mr-2 size-4" />{isEs ? "Nueva cotización" : "New quote"}</Button></div></CardContent></Card>;
}
