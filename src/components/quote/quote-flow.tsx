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
import { getCoverageCitiesForWeekday, getCoverageNoteLines } from "@/lib/service-schedule";
import { formatZodErrors, phoneSchema, step1Schema } from "@/lib/validation";
import type { LawnGeoJsonGeometry, PaymentMethod, PolygonPoint } from "@/lib/types";
import { buildMeasurement, pickSubmissionFields, TOTAL_STEPS, useQuoteStore, type MowFrequency, type QuoteStore } from "@/store/quote-store";

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

function getMowFrequencyLabels(mowFrequency: MowFrequency, isEs: boolean) {
  if (mowFrequency === "weekly") {
    return {
      descriptive: isEs ? "Atención continua" : "Continuous attention",
      cadence: isEs ? "Semanal" : "Weekly",
    };
  }
  return {
    descriptive: isEs ? "Servicio quincenal" : "Biweekly service",
    cadence: isEs ? "Quincenal" : "Bi-weekly",
  };
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
  }, [store, store.paymentMethod, store.setPaymentMethod]);

  React.useEffect(() => {
    if (store.step !== 6 || gateAnswer) return;
    if (store.hasGateCode) {
      setGateAnswer("yes");
      return;
    }
    if (store.completedSteps.includes(5)) setGateAnswer("no");
  }, [gateAnswer, store.completedSteps, store.hasGateCode, store.step]);

  React.useEffect(() => {
    if (store.step !== 4 || store.measurement || store.latitude == null || store.longitude == null) return;
    let cancelled = false;
    setErrors((current) => ({ ...current, measurement: "" }));
    setMeasurementWarning("");
    setMeasurementLoading(true);
    const detectUrl = new URL("/api/lawn-detect", window.location.origin);
    detectUrl.searchParams.set("address", store.formattedAddress || store.address);
    detectUrl.searchParams.set("lat", String(store.latitude));
    detectUrl.searchParams.set("lng", String(store.longitude));
    detectUrl.searchParams.set("area", store.areaSelection);
    void fetch(detectUrl.toString(), { cache: "no-store" })
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
    store,
    store.address,
    store.formattedAddress,
    store.latitude,
    store.longitude,
    store.measurement,
    store.areaSelection,
    store.setAddress,
    store.setMeasurement,
    store.step,
    isEs,
  ]);

  const rate = matchMowRate(rates, store.measurement?.areaSqFt ?? 0, store.mowFrequency);
  const price = rate ? Number(rate.price) : null;
  const weeklyRate = matchMowRate(rates, store.measurement?.areaSqFt ?? 0, "weekly");
  const biWeeklyRate = matchMowRate(rates, store.measurement?.areaSqFt ?? 0, "bi_weekly");
  const weeklyPrice = weeklyRate ? Number(weeklyRate.price) : null;
  const biWeeklyPrice = biWeeklyRate ? Number(biWeeklyRate.price) : null;
  const { descriptive: frequencyLabel, cadence: cadenceLabel } = getMowFrequencyLabels(store.mowFrequency, isEs);
  const coverageNoteLines = getCoverageNoteLines(isEs);
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
    if (current.step === 4 && !current.measurement) {
      setErrors({ measurement: isEs ? "No se pudo estimar el área de la propiedad." : "Could not estimate the property area." });
      return;
    }
    if (current.step === 5 && !current.city.trim()) {
      setErrors({ requestedDate: isEs ? "No se pudo determinar la ciudad. Regrese al paso 1 y confirme su dirección y código postal." : "Could not determine the city. Go back to Step 1 and confirm your address and ZIP code." });
      return;
    }
    if (current.step === 5 && !current.requestedDate) {
      setErrors({ requestedDate: isEs ? "Seleccione el día preferido para el corte." : "Choose your preferred service date." });
      return;
    }
    if (current.step === 6) {
      const nextErrors: Record<string, string> = {};
      if (current.customerName.trim().length < 2) nextErrors.customerName = isEs ? "Ingrese su nombre completo." : "Enter your full name.";
      if (!phoneSchema.safeParse(current.customerPhone).success) nextErrors.customerPhone = isEs ? "Ingrese un teléfono válido de 10 dígitos." : "Enter a valid 10-digit phone number.";
      if (Object.keys(nextErrors).length > 0) {
        setErrors(nextErrors);
        toast({ title: isEs ? "Complete los datos requeridos" : "Complete the required details", variant: "error" });
        return;
      }
      if (!gateAnswer) {
        setErrors({ hasGateCode: isEs ? "Indique si el patio tiene candado o portón." : "Choose whether the yard has a lock or gate." });
        return;
      }
      if (current.hasGateCode && !current.gateCode.trim()) {
        setErrors({ gateCode: isEs ? "Indique el código del candado o acceso." : "Enter the lock or gate code." });
        return;
      }
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
        `${isEs ? "Folio" : "Reference"}: ${referenceCode}`,
        `${isEs ? "Dirección" : "Address"}: ${submitted.address}`,
        `${isEs ? "Área de césped" : "Lawn area"}: ${Math.round(submitted.measurement?.areaSqFt ?? 0).toLocaleString()} sq ft`,
        `${isEs ? "Tarifa" : "Rate"}: $${Number(payload.data?.price ?? price).toFixed(2)} / ${getMowFrequencyLabels(submitted.mowFrequency, isEs).cadence}`,
        `${isEs ? "Frecuencia" : "Frequency"}: ${getMowFrequencyLabels(submitted.mowFrequency, isEs).descriptive}`,
        `${isEs ? "Estado de propiedad" : "Property status"}: ${submitted.propertyOccupancy === "occupied" ? (isEs ? "Ocupada" : "Occupied") : (isEs ? "Vacante" : "Vacant")}`,
        `${isEs ? "Zona de corte" : "Mowing zone"}: ${submitted.areaSelection === "front_back" ? (isEs ? "Frente y trasera" : "Front and back") : submitted.areaSelection === "front_only" ? (isEs ? "Solo delantera" : "Front only") : (isEs ? "Solo trasera" : "Back only")}`,
        `${isEs ? "Trabajos" : "Jobs"}: ${jobNames.join(", ")}`,
        `${isEs ? "Día preferido" : "Preferred day"}: ${submitted.requestedDate}`,
        `${isEs ? "Cliente" : "Customer"}: ${submitted.customerName}`,
        `${isEs ? "Teléfono" : "Phone"}: ${submitted.customerPhone}`,
        `${isEs ? "Candado/portón" : "Lock/gate"}: ${submitted.hasGateCode ? `${isEs ? "Sí" : "Yes"} (${submitted.gateCode})` : (isEs ? "No" : "No")}`,
        `${isEs ? "Pago" : "Payment"}: ${submitted.paymentMethod === "venmo" ? "Venmo" : submitted.paymentMethod === "cash_app" ? "Cash App" : "Zelle"}`,
        submitted.additionalNotes.trim() ? `${isEs ? "Notas" : "Notes"}: ${submitted.additionalNotes.trim()}` : "",
      ].filter(Boolean).join("\n");
      const smsUrl = `${BUSINESS.smsHref}?body=${encodeURIComponent(smsBody)}`;
      submitted.markSubmitted();
      window.location.href = smsUrl;
      return;
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

          {store.step === 2 && <section className="space-y-6">
            <div className="text-center"><h2 className="text-2xl font-extrabold text-emerald-700">{isEs ? "Cotización gratis" : "Free price quote."}</h2><p className="mt-2 text-slate-700">{isEs ? "¡Buenas noticias! Damos servicio en tu área." : "You're in luck! Nieto Green Care services your area."}</p></div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <p className="text-sm font-bold uppercase tracking-[0.12em] text-slate-700">{isEs ? "Frecuencia del servicio *" : "Choose your service frequency *"}</p>
                <div className="mt-2 space-y-2">
                  <button type="button" aria-pressed={store.serviceFrequency === "ongoing"} onClick={() => store.setLawnOptions({ serviceFrequency: "ongoing" })} className={`w-full rounded-lg border px-4 py-3 text-left font-semibold ${store.serviceFrequency === "ongoing" ? "border-emerald-600 bg-emerald-50 text-emerald-950" : "border-slate-200 bg-white text-slate-700"}`}>{isEs ? "Servicio continuo" : "Ongoing"}</button>
                  <button type="button" aria-pressed={store.serviceFrequency === "one_time"} onClick={() => store.setLawnOptions({ serviceFrequency: "one_time" })} className={`w-full rounded-lg border px-4 py-3 text-left font-semibold ${store.serviceFrequency === "one_time" ? "border-emerald-600 bg-emerald-50 text-emerald-950" : "border-slate-200 bg-white text-slate-700"}`}>{isEs ? "Una sola vez" : "One-time"}</button>
                </div>
              </div>
              <div>
                <p className="text-sm font-bold uppercase tracking-[0.12em] text-slate-700">{isEs ? "¿La casa está ocupada o vacante? *" : "Is your home occupied or vacant? *"}</p>
                <div className="mt-2 space-y-2">
                  <button type="button" aria-pressed={store.propertyOccupancy === "occupied"} onClick={() => store.setLawnOptions({ propertyOccupancy: "occupied" })} className={`w-full rounded-lg border px-4 py-3 text-left font-semibold ${store.propertyOccupancy === "occupied" ? "border-emerald-600 bg-emerald-50 text-emerald-950" : "border-slate-200 bg-white text-slate-700"}`}>{isEs ? "Ocupada" : "Occupied"}</button>
                  <button type="button" aria-pressed={store.propertyOccupancy === "vacant"} onClick={() => store.setLawnOptions({ propertyOccupancy: "vacant" })} className={`w-full rounded-lg border px-4 py-3 text-left font-semibold ${store.propertyOccupancy === "vacant" ? "border-emerald-600 bg-emerald-50 text-emerald-950" : "border-slate-200 bg-white text-slate-700"}`}>{isEs ? "Vacante" : "Vacant"}</button>
                </div>
              </div>
            </div>
          </section>}

          {store.step === 3 && <section className="space-y-6">
            <div className="text-center"><h2 className="text-2xl font-extrabold text-emerald-700">{isEs ? "Cotización gratis" : "Free price quote."}</h2><p className="mt-2 text-slate-700">{isEs ? "Selecciona el área a cortar." : "Select your mow area."}</p></div>
            <div className="space-y-4">
              {[
                { key: "front_back", labelEs: "Frente y atrás", labelEn: "Front & Back", art: "▣" },
                { key: "front_only", labelEs: "Solo frente", labelEn: "Front Only", art: "▔" },
                { key: "back_only", labelEs: "Solo atrás", labelEn: "Back Only", art: "▁" },
              ].map((option) => {
                const selected = store.areaSelection === option.key;
                return <button key={option.key} type="button" aria-pressed={selected} onClick={() => store.setLawnOptions({ areaSelection: option.key as QuoteStore["areaSelection"] })} className={`flex w-full items-center gap-4 rounded-2xl border p-4 text-left transition ${selected ? "border-emerald-600 bg-emerald-50 ring-2 ring-emerald-200" : "border-slate-200 bg-white hover:border-emerald-300"}`}>
                  <span className="grid size-20 shrink-0 place-items-center rounded-xl border border-emerald-100 bg-emerald-100 text-4xl font-black text-emerald-500">{option.art}</span>
                  <span className="flex items-center gap-3 text-lg font-bold text-slate-950"><span className={`grid size-5 place-items-center rounded border ${selected ? "border-emerald-600 bg-emerald-500 text-white" : "border-slate-300 bg-white"}`}>{selected ? "✓" : ""}</span>{isEs ? option.labelEs : option.labelEn}</span>
                </button>;
              })}
            </div>
            <fieldset className="border-t border-slate-200 pt-5">
              <legend className="text-sm font-bold text-slate-800">{isEs ? "¿La propiedad está en esquina? *" : "Is your property a corner lot? *"}</legend>
              <div className="mt-3 flex gap-3">
                <button type="button" aria-pressed={store.isCornerLot} onClick={() => store.setLawnOptions({ isCornerLot: true })} className={`rounded-lg border px-5 py-2 font-semibold ${store.isCornerLot ? "border-emerald-700 bg-emerald-700 text-white" : "border-slate-300 bg-white text-slate-800"}`}>{isEs ? "Sí" : "Yes"}</button>
                <button type="button" aria-pressed={!store.isCornerLot} onClick={() => store.setLawnOptions({ isCornerLot: false })} className={`rounded-lg border px-5 py-2 font-semibold ${!store.isCornerLot ? "border-emerald-700 bg-emerald-700 text-white" : "border-slate-300 bg-white text-slate-800"}`}>{isEs ? "No" : "No"}</button>
              </div>
            </fieldset>
          </section>}

          {store.step === 4 && <section className="space-y-5">
            <div><h2 className="text-xl font-bold text-slate-900">{isEs ? "4. Mapa satelital y precio automático" : "4. Satellite map and automatic price"}</h2><p className="mt-1 text-sm text-slate-600">{isEs ? "El sistema calcula el área seleccionada y excluye la casa cuando la huella está disponible." : "The system calculates the selected mow area and excludes the house when the footprint is available."}</p></div>
            {measurementLoading && <p className="rounded-lg bg-slate-100 px-4 py-3 text-sm font-semibold text-slate-700">{isEs ? "Analizando tu propiedad por satélite..." : "Analyzing your property by satellite..."}</p>}
            <PropertySatellite address={store.address} latitude={store.latitude} longitude={store.longitude} isEs={isEs} polygon={polygon} geometry={lawnGeometry} center={markerCenter} loadingText={isEs ? "Analizando tu propiedad por satélite..." : "Analyzing your property by satellite..."} showMarker={false} />
            <div className="grid gap-3 sm:grid-cols-3">
              <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-4">
                <p className="text-sm font-semibold text-emerald-900">{isEs ? "Área calculada" : "Calculated area"}</p>
                <p className="mt-2 text-2xl font-extrabold text-emerald-950">{lawnAreaSqM.toLocaleString(undefined, { maximumFractionDigits: 1 })} m²</p>
                <p className="text-sm text-emerald-900">({lawnAreaSqFt.toLocaleString(undefined, { maximumFractionDigits: 1 })} ft²)</p>
              </div>
              <button type="button" aria-pressed={store.mowFrequency === "weekly"} onClick={() => store.setLawnOptions({ mowFrequency: "weekly" })} className={`rounded-lg border p-4 text-left ${store.mowFrequency === "weekly" ? "border-emerald-600 bg-emerald-50 ring-2 ring-emerald-200" : "border-emerald-200 bg-white"}`}>
                <p className="text-sm font-semibold text-slate-700">{isEs ? "Semanal" : "Weekly"}</p>
                <p className="mt-2 text-2xl font-extrabold text-emerald-900">{weeklyPrice !== null ? `$${weeklyPrice.toFixed(2)}` : "—"}</p>
              </button>
              <button type="button" aria-pressed={store.mowFrequency === "bi_weekly"} onClick={() => store.setLawnOptions({ mowFrequency: "bi_weekly" })} className={`rounded-lg border p-4 text-left ${store.mowFrequency === "bi_weekly" ? "border-emerald-600 bg-emerald-50 ring-2 ring-emerald-200" : "border-emerald-200 bg-white"}`}>
                <p className="text-sm font-semibold text-slate-700">{isEs ? "Quincenal" : "Bi-weekly"}</p>
                <p className="mt-2 text-2xl font-extrabold text-emerald-900">{biWeeklyPrice !== null ? `$${biWeeklyPrice.toFixed(2)}` : "—"}</p>
              </button>
            </div>
            <FieldError>{errors.measurement}</FieldError>
            {measurementWarning && <div className="rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 text-sm font-semibold text-amber-900">{measurementWarning}</div>}
          </section>}

          {store.step === 5 && <section className="space-y-6">
            <div><h2 className="text-xl font-bold text-slate-900">{isEs ? "5. Calendario y cobertura por ciudad" : "5. Calendar and city coverage"}</h2><p className="mt-1 text-sm text-slate-600">{isEs ? `Ciudad detectada: ${store.city || "Sin ciudad"} · Seleccione un día disponible.` : `Detected city: ${store.city || "No city"} · Select an available day.`}</p></div>
            <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-950">
              {coverageNoteLines.map((line) => <p key={line}>{line}</p>)}
            </div>
            {store.city.trim() ? <MowingCalendar selected={store.requestedDate} city={store.city} isEs={isEs} onSelect={(date) => store.setSchedule(date, store.requestedTimeWindow ?? "08:00 - 18:00")} price={price} /> : <div className="rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 text-sm font-semibold text-amber-900">{isEs ? "Primero confirme una dirección con ciudad válida en el Paso 1 para habilitar el calendario." : "Please confirm an address with a valid city in Step 1 to unlock the calendar."}</div>}
            <FieldError>{errors.requestedDate}</FieldError>
          </section>}

          {store.step === 6 && <section className="space-y-6">
            <div className="grid gap-5 border-b border-emerald-100 pb-5 sm:grid-cols-[1fr_1fr]">
              <div><h2 className="text-2xl font-extrabold text-emerald-950">My Custom Lawn Mowing Plan</h2><p className="mt-3 text-2xl font-bold text-emerald-800">{price !== null ? `$${price.toFixed(2)} / ${cadenceLabel}` : ""}</p><p className="mt-2 text-sm text-slate-600">{store.address}</p></div>
              <PropertySatellite address={store.address} latitude={store.latitude} longitude={store.longitude} isEs={isEs} compact polygon={polygon} geometry={lawnGeometry} center={markerCenter} />
            </div>
            <p className="font-bold text-emerald-900">{isEs ? "Pies cuadrados de césped" : "Lawn square footage"}: {lawnAreaSqFt.toLocaleString()} sq ft</p>
            <div className="grid gap-3 text-sm sm:grid-cols-2"><p><strong>{isEs ? "Frecuencia" : "Frequency"}:</strong> {frequencyLabel}</p><p><strong>{isEs ? "Día elegido" : "Chosen day"}:</strong> {store.requestedDate || (isEs ? "Seleccione una fecha" : "Choose a date")}</p><p><strong>{isEs ? "Estado de propiedad" : "Property state"}:</strong> {store.propertyOccupancy === "occupied" ? (isEs ? "Ocupada" : "Occupied") : (isEs ? "Vacante" : "Vacant")}</p><p><strong>{isEs ? "Zona de corte" : "Mow area"}:</strong> {store.areaSelection === "front_back" ? (isEs ? "Frente y atrás" : "Front & Back") : store.areaSelection === "front_only" ? (isEs ? "Solo frente" : "Front Only") : (isEs ? "Solo atrás" : "Back Only")}</p></div>
            <div className="rounded-lg bg-slate-50 p-4"><p className="text-sm font-bold text-emerald-900">{isEs ? "Servicios incluidos" : "Included services"}</p><div className="mt-2 grid gap-2 text-sm text-slate-700 sm:grid-cols-2">{["Mow Lawn", "Line Trim", "Edge", "Blow Debris", "24/7 Text Support"].map((item) => <span key={item} className="flex items-center gap-2"><CheckCircle2 className="size-4 text-emerald-600" />{item}</span>)}</div></div>
            <div><p className="mb-2 text-sm font-bold text-emerald-900">{isEs ? "Servicios opcionales" : "Optional services"}</p><div className="grid gap-2 sm:grid-cols-2">{SERVICES.filter((service) => service.key !== "weekly_biweekly_lawn_service").map((service) => { const selected = store.selectedServices.includes(service.key); return <button key={service.key} type="button" aria-pressed={selected} onClick={() => store.toggleService(service.key)} className={`min-h-12 rounded-lg border px-3 py-2 text-left text-sm font-semibold transition ${selected ? "border-emerald-700 bg-emerald-50 text-emerald-900" : "border-slate-200 bg-white text-slate-700 hover:border-emerald-400"}`}>{selected ? "✓ " : ""}{isEs ? service.nameEs : service.nameEn}</button>; })}</div></div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div><Label htmlFor="quote-first-name">{isEs ? "Nombre *" : "First name *"}</Label><Input id="quote-first-name" required value={store.firstName} onChange={(event) => store.setAccountDetails({ firstName: event.target.value })} className="mt-2" /><FieldError>{errors.customerName}</FieldError></div>
              <div><Label htmlFor="quote-last-name">{isEs ? "Apellido" : "Last name"}</Label><Input id="quote-last-name" value={store.lastName} onChange={(event) => store.setAccountDetails({ lastName: event.target.value })} className="mt-2" /></div>
              <div><Label htmlFor="quote-email">Email</Label><Input id="quote-email" type="email" value={store.customerEmail} onChange={(event) => store.setPersonal({ customerEmail: event.target.value })} className="mt-2" placeholder="you@company.com" /></div>
              <div><Label htmlFor="quote-customer-phone">{isEs ? "Teléfono *" : "Phone number *"}</Label><Input id="quote-customer-phone" required type="tel" value={store.customerPhone} onChange={(event) => store.setPersonal({ customerPhone: event.target.value })} className="mt-2" /><FieldError>{errors.customerPhone}</FieldError></div>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              {[
                ["isCellphone", isEs ? "¿Es celular?" : "Is it a cellphone?"],
                ["isGrassOver6", isEs ? "¿El pasto mide más de 6 pulgadas?" : "Is your grass 6 inches or taller?"],
                ["isGrassOver12", isEs ? "¿El pasto mide 12 pulgadas o más?" : "Is your grass 12 inches or taller?"],
                ["hasCommunityGate", isEs ? "¿Hay portón de comunidad?" : "Community gate?"],
                ["hasBackyardGate", isEs ? "¿Hay portón al patio?" : "Backyard gate?"],
                ["hasPetsInBackyard", isEs ? "¿Hay perros en el patio?" : "Pets in backyard?"],
              ].map(([key, label]) => <label key={key} className="flex items-center gap-3 rounded-lg border border-slate-200 bg-white p-3 text-sm font-semibold text-slate-800"><input type="checkbox" checked={Boolean(store[key as keyof QuoteStore])} onChange={(event) => store.setPersonal({ [key]: event.target.checked } as Partial<QuoteStore>)} className="size-4 accent-emerald-600" />{label}</label>)}
            </div>
            <fieldset><legend className="text-sm font-semibold text-slate-800">{isEs ? "¿Acceso con candado o portón? *" : "Lock or gate access? *"}</legend><div className="mt-2 flex gap-3">{(["yes", "no"] as const).map((answer) => <button key={answer} type="button" aria-pressed={gateAnswer === answer} onClick={() => { setGateAnswer(answer); store.setGate(answer === "yes", answer === "yes" ? store.gateCode : ""); setErrors((current) => ({ ...current, hasGateCode: "", gateCode: "" })); }} className={`rounded-lg border px-5 py-2 font-semibold ${gateAnswer === answer ? "border-emerald-700 bg-emerald-700 text-white" : "border-slate-300 bg-white text-slate-800"}`}>{answer === "yes" ? (isEs ? "Sí" : "Yes") : (isEs ? "No" : "No")}</button>)}</div><FieldError>{errors.hasGateCode}</FieldError>{store.hasGateCode && <div className="mt-3 max-w-sm"><Label htmlFor="quote-gate-code">{isEs ? "Código o número del candado *" : "Lock or gate code *"}</Label><Input id="quote-gate-code" required inputMode="numeric" value={store.gateCode} onChange={(event) => { store.setGate(true, event.target.value.replace(/[^\d]/g, "")); setErrors((current) => ({ ...current, gateCode: "" })); }} className="mt-2" /><FieldError>{errors.gateCode}</FieldError></div>}</fieldset>
            <div><Label htmlFor="quote-notes">{isEs ? "Comentarios / notas de la obra" : "Work comments / notes"}</Label><Textarea id="quote-notes" rows={3} maxLength={2000} value={store.additionalNotes} onChange={(event) => store.setPersonal({ additionalNotes: event.target.value })} className="mt-2" /></div>
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
            <div className="rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 text-sm font-bold text-amber-900">{isEs ? "NOTA IMPORTANTE: Siempre que envíe su pago, asegúrese de poner su dirección en la nota del pago." : "IMPORTANT NOTE: Whenever you send your payment, make sure to put your address in the payment note."}</div>
            <p className="text-sm text-slate-600">{isEs ? "Al confirmar, se guarda la solicitud en Supabase y se abre el SMS consolidado para el propietario." : "When you confirm, your request is saved to Supabase and the consolidated SMS for the owner opens."}</p>
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
  const cityQuery = city.trim();
  const normalizedCity = normalizeCityKey(city.trim());
  const availabilityKey = `${monthKey}:${normalizedCity || "unknown"}`;

  React.useEffect(() => {
    let cancelled = false;
    const cachedDates = availabilityCacheRef.current[availabilityKey];
    if (cachedDates) {
      setAvailabilityReady(true);
      setOccupiedDates(new Set(cachedDates));
      return () => { cancelled = true; };
    }
    setAvailabilityReady(false);
    void fetch(`/api/availability?month=${monthKey}&city=${encodeURIComponent(cityQuery)}`, { cache: "no-store" })
      .then(async (response) => {
        const payload = (await response.json().catch(() => ({}))) as AvailabilityResponse;
        if (!response.ok || !payload.ok) throw new Error("availability");
        return payload.occupiedDates ?? [];
      })
      .then((dates) => {
        availabilityCacheRef.current[availabilityKey] = dates;
        if (!cancelled) {
          setOccupiedDates(new Set(dates));
          setAvailabilityReady(true);
        }
      })
      .catch(() => {
        delete availabilityCacheRef.current[availabilityKey];
        if (!cancelled) {
          setAvailabilityReady(false);
          setOccupiedDates(new Set());
        }
      });
    return () => { cancelled = true; };
  }, [availabilityKey, cityQuery, monthKey]);

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
          return <button key={iso} type="button" disabled={disabled} onClick={() => onSelect(iso)} aria-pressed={!disabled && selected === iso ? true : undefined} aria-label={`${date.toLocaleDateString(isEs ? "es-MX" : "en-US", { dateStyle: "long" })} · ${dayStatusLabel}`} className={`min-h-14 rounded-lg border px-1 py-2 text-xs sm:min-h-16 ${selectedClass || occupiedClass || unavailableClass || normalClass} disabled:cursor-not-allowed`}>
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
  const { cadence: cadenceLabel } = getMowFrequencyLabels(store.mowFrequency, isEs);
  return <Card className="mx-auto max-w-2xl space-y-5 p-8 text-center"><CardContent className="space-y-5"><ShieldCheck className="mx-auto size-14 text-emerald-700" /><h1 className="text-2xl font-extrabold text-slate-950">{isEs ? "¡Muchas gracias por su preferencia! Su solicitud ha sido procesada." : "Thank you! Your request has been processed."}</h1><p className="text-sm text-slate-600">{isEs ? "La solicitud se guardó en Supabase. Si el SMS no se abrió automáticamente, use el botón de abajo para contactar al propietario." : "Your request was saved to Supabase. If the SMS app did not open automatically, use the button below to contact the owner."}</p><p className="text-xl font-bold text-emerald-800">{price !== null ? `$${price.toFixed(2)} / ${cadenceLabel}` : ""}</p><a href={`${BUSINESS.smsHref}?body=${encodeURIComponent(smsBody)}`} className="inline-flex items-center rounded-lg bg-emerald-700 px-4 py-3 font-bold text-white"><MessageSquare className="mr-2 size-4" />{isEs ? "Abrir SMS al propietario" : "Open owner SMS"}</a><div><Button variant="outline" onClick={onReset}><CheckCircle2 className="mr-2 size-4" />{isEs ? "Nueva cotización" : "New quote"}</Button></div></CardContent></Card>;
}
