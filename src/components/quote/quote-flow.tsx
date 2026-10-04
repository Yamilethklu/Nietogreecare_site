"use client";

import * as React from "react";
import Link from "next/link";
import { ArrowLeft, CheckCircle2, ChevronLeft, ChevronRight, MessageSquare, Send, ShieldCheck } from "lucide-react";

import { useLanguage } from "@/components/providers/language-provider";
import { useToast } from "@/components/providers/toast-provider";
import { PropertySatellite } from "@/components/quote/property-satellite";
import { Step1Address, Step1AddressHint } from "@/components/quote/step-1-address";
import { SiteLogo } from "@/components/site/brand";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { FieldError, Input, Label, Textarea } from "@/components/ui/input";
import { BUSINESS, SERVICES, ZIP_CITY_MAP } from "@/lib/constants";
import { matchMowRate, type MowRate } from "@/lib/instant-pricing";
import { texasToday } from "@/lib/operations/schedule";
import { getCoverageCitiesForWeekday, isInitialServiceDate } from "@/lib/service-schedule";
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
  poligonoParcela?: LawnGeoJsonGeometry;
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
const BASE_LAWN_SERVICE_KEY = "weekly_biweekly_lawn_service";

function resolveMeasurementError(error: string | undefined, isEs: boolean) {
  switch (error) {
    case NO_PARCEL_ERROR:
      return isEs ? error : "No parcel data is available for this address.";
    case LAWN_COMPUTE_ERROR:
      return isEs ? error : "Could not calculate the lawn area.";
    case INVALID_LAWN_ERROR:
      return isEs ? error : "The lawn area is not valid.";
    case "building_footprint_unavailable":
      return isEs ? "No hay una huella real de la casa disponible para calcular esta propiedad. Contacte al propietario para verificar la medida." : "No reliable building footprint is available for this property. Contact the owner to verify the measurement.";
    case "solar_access_denied":
      return isEs ? "La medición está temporalmente no disponible: el proveedor no autorizó la consulta de la casa. Contacte al propietario." : "Measurement is temporarily unavailable: the provider did not authorize the building lookup. Please contact the owner.";
    case "solar_quota_exceeded":
    case "solar_temporarily_unavailable":
      return isEs ? "El proveedor de medición está temporalmente no disponible. Intente nuevamente más tarde." : "The measurement provider is temporarily unavailable. Please try again later.";
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
  const [detectedParcel, setDetectedParcel] = React.useState<PolygonPoint[][]>();

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
    const quoteServices = store.selectedServices.includes(BASE_LAWN_SERVICE_KEY) && store.selectedServices.length === 1
      ? store.selectedServices
      : [BASE_LAWN_SERVICE_KEY];
    if (quoteServices !== store.selectedServices) store.setServices(quoteServices);
  }, [store, store.selectedServices, store.setServices]);

  React.useEffect(() => {
    if (store.step !== 2 || gateAnswer) return;
    if (store.hasGateCode) {
      setGateAnswer("yes");
      return;
    }
    if (store.completedSteps.includes(5)) setGateAnswer("no");
  }, [gateAnswer, store.completedSteps, store.hasGateCode, store.step]);

  React.useEffect(() => {
    if (store.measurement && (store.measurement.geometryVersion !== 3 || store.measurement.areaSelection !== store.areaSelection)) {
      store.clearMeasurement();
      return;
    }
    if (store.step !== 5 || store.measurement || store.latitude == null || store.longitude == null) return;
    let cancelled = false;
    setErrors((current) => ({ ...current, measurement: "" }));
    setMeasurementWarning("");
    setMeasurementLoading(true);
    setDetectedParcel(undefined);
    const detectUrl = new URL("/api/lawn-detect", window.location.origin);
    detectUrl.searchParams.set("address", store.formattedAddress || store.address);
    detectUrl.searchParams.set("lat", String(store.latitude));
    detectUrl.searchParams.set("lng", String(store.longitude));
    detectUrl.searchParams.set("area", store.areaSelection);
    void fetch(detectUrl.toString(), { cache: "no-store" })
      .then(async (response) => {
        const payload = (await response.json().catch(() => ({}))) as LawnDetectionResponse;
        if (!cancelled && payload.poligonoParcela) setDetectedParcel(geoJsonGeometryToPolygons(payload.poligonoParcela));
        if (!response.ok) throw new Error(resolveMeasurementError(payload.error, isEs));
        return payload;
      })
      .then((payload) => {
        if (cancelled) return;
        const polygons = geoJsonGeometryToPolygons(payload.poligonoJardin);
        const parcelPolygons = geoJsonGeometryToPolygons(payload.poligonoParcela);
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
        const measurement = buildMeasurement(polygons[0], areaSqFt, 2, 19, polygons, parcelPolygons.length ? parcelPolygons : undefined, payload.poligonoJardin);
        measurement.areaSelection = store.areaSelection;
        measurement.geometryVersion = 3;
        measurement.warning = payload.warning;
        setMeasurementWarning(payload.warning || "");
        if (center) measurement.center = center;
        store.setMeasurement(measurement);
        setMeasurementWarning("");
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
    store.clearMeasurement,
    store.setAddress,
    store.setMeasurement,
    store.step,
    isEs,
  ]);

  const rate = matchMowRate(rates, store.measurement?.areaSqFt ?? 0, store.mowFrequency);
  const price = rate ? Number(rate.price) + (store.bagGrass ? 10 : 0) : null;
  const weeklyRate = matchMowRate(rates, store.measurement?.areaSqFt ?? 0, "weekly");
  const { descriptive: frequencyLabel, cadence: cadenceLabel } = getMowFrequencyLabels(store.mowFrequency, isEs);
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
    if (current.step === 4) {
      const nextErrors: Record<string, string> = {};
      if (current.customerName.trim().length < 2) nextErrors.customerName = isEs ? "Ingrese su nombre completo." : "Enter your full name.";
      if (!phoneSchema.safeParse(current.customerPhone).success) nextErrors.customerPhone = isEs ? "Ingrese un teléfono válido de 10 dígitos." : "Enter a valid 10-digit phone number.";
      if (Object.keys(nextErrors).length > 0) {
        setErrors(nextErrors);
        toast({ title: isEs ? "Complete los datos requeridos" : "Complete the required details", variant: "error" });
        return;
      }
    }
    if (current.step === 2) {
      if (!gateAnswer) {
        setErrors({ hasGateCode: isEs ? "Indique si su entrada cuenta con cerradura o código." : "Choose whether the entrance has a lock or code." });
        return;
      }
      if (current.hasGateCode && !current.gateCode.trim()) {
        setErrors({ gateCode: isEs ? "Ingrese el código o dígito de acceso." : "Enter the access code or digit." });
        return;
      }
    }
    if (current.step === 5 && (!current.measurement || !price)) {
      setErrors({ measurement: isEs ? "La medición o la tarifa de esta propiedad está pendiente de confirmación." : "The measurement or rate for this property is awaiting confirmation." });
      return;
    }
    if (current.step === 6 && !current.city.trim()) {
      setErrors({ requestedDate: isEs ? "No se pudo determinar la ciudad. Regrese al paso 1 y confirme su dirección y código postal." : "Could not determine the city. Go back to Step 1 and confirm your address and ZIP code." });
      return;
    }
    if (current.step === 6 && (!current.requestedDate || !isInitialServiceDate(current.requestedDate,current.city))) {
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
        `${isEs ? "Servicio" : "Service"}: ${jobNames.join(", ")}`,
        `${isEs ? "Día preferido" : "Preferred day"}: ${submitted.requestedDate}`,
        `${isEs ? "Cliente" : "Customer"}: ${submitted.customerName}`,
        `${isEs ? "Teléfono" : "Phone"}: ${submitted.customerPhone}`,
        `${isEs ? "Candado/portón" : "Lock/gate"}: ${submitted.hasGateCode ? `${isEs ? "Sí" : "Yes"} (${submitted.gateCode})` : (isEs ? "No" : "No")}`,
        `${isEs ? "Mascotas" : "Pets"}: ${submitted.hasPetsInBackyard ? (isEs ? "Sí" : "Yes") : "No"}`,
        `${isEs ? "Césped sobre 6 pulgadas" : "Grass over 6 inches"}: ${submitted.isGrassOver6 ? (isEs ? "Sí" : "Yes") : "No"}`,
        `${isEs ? "Pago" : "Payment"}: ${submitted.paymentMethod === "cash" ? (isEs ? "Efectivo" : "Cash") : submitted.paymentMethod === "venmo" ? "Venmo" : submitted.paymentMethod === "cash_app" ? "Cash App" : "Zelle"}`,
        submitted.additionalNotes.trim() ? `${isEs ? "Notas" : "Notes"}: ${submitted.additionalNotes.trim()}` : "",
        submitted.details.trim() ? `${isEs ? "Trabajo no listado" : "Unlisted work"}: ${submitted.details.trim()}` : "",
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
            <div className="flex flex-col items-center gap-3 text-center">
              <SiteLogo size="lg" showTagline />
              <h2 className="text-xl font-bold text-slate-900">{isEs ? "1. Dirección y código postal" : "1. Address and ZIP code"}</h2>
              <p className="max-w-xl text-sm font-semibold text-emerald-800">{isEs ? "Este cotizador es únicamente para corte de césped semanal o quincenal." : "This quote form is only for weekly or bi-weekly lawn mowing."}</p>
            </div>
            <div><Step1Address error={errors.address} isEs={isEs} /><Step1AddressHint isEs={isEs} /><FieldError>{errors.address}</FieldError></div>
            <div><Label htmlFor="quote-zip">{isEs ? "Código postal *" : "ZIP code *"}</Label><Input id="quote-zip" required inputMode="numeric" value={store.zipCode} maxLength={5} onChange={(event) => { const zipCode = event.target.value.replace(/\D/g, "").slice(0, 5); store.setAddress({ zipCode, city: ZIP_CITY_MAP[zipCode] ?? "" }); }} placeholder="78642" className="mt-2" /><FieldError>{errors.zipCode}</FieldError></div>
          </section>}

          {store.step === 2 && <section className="space-y-6">
            <div className="text-center"><h2 className="text-2xl font-extrabold text-emerald-700">{isEs ? "2. Preguntas del servicio" : "2. Service questions"}</h2><p className="mt-2 text-slate-700">{isEs ? "Estas respuestas ayudan a preparar la visita correctamente." : "These answers help prepare the visit correctly."}</p></div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <p className="text-sm font-bold uppercase tracking-[0.12em] text-slate-700">{isEs ? "¿Frecuencia del trabajo? *" : "Work frequency *"}</p>
                <div className="mt-2 space-y-2">
                  <button type="button" aria-pressed={store.mowFrequency === "weekly"} onClick={() => store.setLawnOptions({ mowFrequency: "weekly", serviceFrequency: "ongoing" })} className={`w-full rounded-lg border px-4 py-3 text-left font-semibold ${store.mowFrequency === "weekly" ? "border-emerald-600 bg-emerald-50 text-emerald-950" : "border-slate-200 bg-white text-slate-700"}`}>{isEs ? "Semanal" : "Weekly"}</button>
                  <button type="button" aria-pressed={store.mowFrequency === "bi_weekly"} onClick={() => store.setLawnOptions({ mowFrequency: "bi_weekly", serviceFrequency: "ongoing" })} className={`w-full rounded-lg border px-4 py-3 text-left font-semibold ${store.mowFrequency === "bi_weekly" ? "border-emerald-600 bg-emerald-50 text-emerald-950" : "border-slate-200 bg-white text-slate-700"}`}>{isEs ? "Quincenal" : "Bi-weekly"}</button>
                </div>
              </div>
              <div>
                <p className="text-sm font-bold uppercase tracking-[0.12em] text-slate-700">{isEs ? "¿Propiedad vacante? *" : "Vacant property? *"}</p>
                <div className="mt-2 space-y-2">
                  <button type="button" aria-pressed={store.propertyOccupancy === "occupied"} onClick={() => store.setLawnOptions({ propertyOccupancy: "occupied" })} className={`w-full rounded-lg border px-4 py-3 text-left font-semibold ${store.propertyOccupancy === "occupied" ? "border-emerald-600 bg-emerald-50 text-emerald-950" : "border-slate-200 bg-white text-slate-700"}`}>{isEs ? "Ocupada" : "Occupied"}</button>
                  <button type="button" aria-pressed={store.propertyOccupancy === "vacant"} onClick={() => store.setLawnOptions({ propertyOccupancy: "vacant" })} className={`w-full rounded-lg border px-4 py-3 text-left font-semibold ${store.propertyOccupancy === "vacant" ? "border-emerald-600 bg-emerald-50 text-emerald-950" : "border-slate-200 bg-white text-slate-700"}`}>{isEs ? "Deshabitada / vacante" : "Vacant"}</button>
                </div>
              </div>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <fieldset className="rounded-xl border border-slate-200 p-4">
                <legend className="px-1 text-sm font-bold text-slate-800">{isEs ? "¿Cuenta con cerradura su entrada? *" : "Does the entrance have a lock? *"}</legend>
                <div className="mt-3 flex gap-3">{(["yes", "no"] as const).map((answer) => <button key={answer} type="button" aria-pressed={gateAnswer === answer} onClick={() => { setGateAnswer(answer); store.setGate(answer === "yes", answer === "yes" ? store.gateCode : ""); setErrors((current) => ({ ...current, hasGateCode: "", gateCode: "" })); }} className={`rounded-lg border px-5 py-2 font-semibold ${gateAnswer === answer ? "border-emerald-700 bg-emerald-700 text-white" : "border-slate-300 bg-white text-slate-800"}`}>{answer === "yes" ? (isEs ? "Sí" : "Yes") : (isEs ? "No" : "No")}</button>)}</div>
                <FieldError>{errors.hasGateCode}</FieldError>
                {store.hasGateCode && <div className="mt-3"><Label htmlFor="quote-gate-code">{isEs ? "Ingrese el dígito o código" : "Enter the digit or code"}</Label><Input id="quote-gate-code" inputMode="numeric" value={store.gateCode} onChange={(event) => { store.setGate(true, event.target.value.replace(/[^\d]/g, "")); setErrors((current) => ({ ...current, gateCode: "" })); }} className="mt-2" /><FieldError>{errors.gateCode}</FieldError></div>}
              </fieldset>
              <fieldset className="rounded-xl border border-slate-200 p-4">
                <legend className="px-1 text-sm font-bold text-slate-800">{isEs ? "¿Mascotas?" : "Pets?"}</legend>
                <div className="mt-3 flex gap-3">
                  <button type="button" aria-pressed={store.hasPetsInBackyard} onClick={() => store.setPersonal({ hasPetsInBackyard: true })} className={`rounded-lg border px-5 py-2 font-semibold ${store.hasPetsInBackyard ? "border-emerald-700 bg-emerald-700 text-white" : "border-slate-300 bg-white text-slate-800"}`}>{isEs ? "Sí" : "Yes"}</button>
                  <button type="button" aria-pressed={!store.hasPetsInBackyard} onClick={() => store.setPersonal({ hasPetsInBackyard: false })} className={`rounded-lg border px-5 py-2 font-semibold ${!store.hasPetsInBackyard ? "border-emerald-700 bg-emerald-700 text-white" : "border-slate-300 bg-white text-slate-800"}`}>{isEs ? "No" : "No"}</button>
                </div>
                {store.hasPetsInBackyard && <p className="mt-3 rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 text-sm font-semibold text-amber-900">{isEs ? "Por favor, deje a sus mascotas dentro de casa el día del servicio." : "Please keep your pets inside the house on service day."}</p>}
              </fieldset>
            </div>
          </section>}

          {store.step === 3 && <section className="space-y-6">
            <div className="text-center"><h2 className="text-2xl font-extrabold text-emerald-700">{isEs ? "3. Área de corte" : "3. Mowing area"}</h2><p className="mt-2 text-slate-700">{isEs ? "Selecciona únicamente el área que requiere corte." : "Select only the area that needs mowing."}</p></div>
            <div className="space-y-4">
              {[
                { key: "front_back", labelEs: "Frente y atrás", labelEn: "Front & Back", art: "▣" },
                { key: "front_only", labelEs: "Solo frente", labelEn: "Front Only", art: "▔" },
                { key: "back_only", labelEs: "Solo atrás", labelEn: "Back Only", art: "▁" },
              ].map((option) => {
                const selected = store.areaSelection === option.key;
                return <button key={option.key} type="button" aria-pressed={selected} onClick={() => { store.setLawnOptions({ areaSelection: option.key as QuoteStore["areaSelection"] }); store.clearMeasurement(); }} className={`flex w-full items-center gap-4 rounded-2xl border p-4 text-left text-black transition ${selected ? "border-lime-500 bg-lime-200 ring-2 ring-lime-300" : "border-lime-300 bg-lime-50 hover:border-lime-500 hover:bg-lime-100"}`}>
                  <span className="grid size-20 shrink-0 place-items-center rounded-xl border border-lime-500 bg-lime-300 text-4xl font-black text-black">{option.art}</span>
                  <span className="flex items-center gap-3 text-lg font-bold text-black"><span className={`grid size-5 place-items-center rounded border ${selected ? "border-lime-600 bg-lime-500 text-black" : "border-lime-400 bg-white"}`}>{selected ? "✓" : ""}</span>{isEs ? option.labelEs : option.labelEn}</span>
                </button>;
              })}
            </div>
            <fieldset className="border-t border-slate-200 pt-5">
              <legend className="text-sm font-bold text-black">{isEs ? "¿El césped mide más de 6 pulgadas de alto?" : "Is the grass over 6 inches tall?"}</legend>
              <div className="mt-3 flex gap-3">
                <button type="button" aria-pressed={store.isGrassOver6} onClick={() => store.setPersonal({ isGrassOver6: true, isGrassOver12: false })} className={`rounded-lg border px-5 py-2 font-semibold ${store.isGrassOver6 ? "border-lime-600 bg-lime-300 text-black" : "border-lime-300 bg-white text-black"}`}>{isEs ? "Sí" : "Yes"}</button>
                <button type="button" aria-pressed={!store.isGrassOver6} onClick={() => store.setPersonal({ isGrassOver6: false, isGrassOver12: false })} className={`rounded-lg border px-5 py-2 font-semibold ${!store.isGrassOver6 ? "border-lime-600 bg-lime-300 text-black" : "border-lime-300 bg-white text-black"}`}>{isEs ? "No" : "No"}</button>
              </div>
              {store.isGrassOver6 && <p className="mt-3 rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 text-sm font-semibold text-amber-900">{isEs ? "Nota: este servicio puede tener costo extra." : "Note: this service may have an extra cost."}</p>}
            </fieldset>
          </section>}

          {store.step === 4 && <section className="space-y-5">
            <div><h2 className="text-xl font-bold text-slate-900">{isEs ? "4. Datos del cliente" : "4. Customer information"}</h2></div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div><Label htmlFor="quote-customer-name">{isEs ? "Nombre *" : "Name *"}</Label><Input id="quote-customer-name" required value={store.customerName} onChange={(event) => store.setPersonal({ customerName: event.target.value, firstName: event.target.value, lastName: "" })} className="mt-2" /><FieldError>{errors.customerName}</FieldError></div>
              <div><Label htmlFor="quote-customer-phone">{isEs ? "Teléfono *" : "Phone *"}</Label><Input id="quote-customer-phone" required type="tel" value={store.customerPhone} onChange={(event) => store.setPersonal({ customerPhone: event.target.value })} className="mt-2" /><FieldError>{errors.customerPhone}</FieldError></div>
              <div className="sm:col-span-2"><Label htmlFor="quote-email">{isEs ? "Correo" : "Email"}</Label><Input id="quote-email" type="email" value={store.customerEmail} onChange={(event) => store.setPersonal({ customerEmail: event.target.value })} className="mt-2" placeholder="you@company.com" /></div>
            </div>
            <div><Label htmlFor="quote-notes">{isEs ? "Nota: escriba algo que requiera" : "Note: write anything you need"}</Label><Textarea id="quote-notes" rows={3} maxLength={2000} value={store.additionalNotes} onChange={(event) => store.setPersonal({ additionalNotes: event.target.value })} className="mt-2" /></div>
          </section>}

          {store.step === 5 && <section className="space-y-6">
            {measurementLoading && <p className="rounded-lg bg-slate-100 px-4 py-3 text-sm font-semibold text-slate-700">{isEs ? "Analizando tu propiedad por satélite..." : "Analyzing your property by satellite..."}</p>}
            <div className="grid gap-5 border-b border-emerald-100 pb-5 sm:grid-cols-[1fr_1fr]">
              <div><h2 className="text-2xl font-extrabold text-emerald-950">{isEs ? "5. Resumen de cotización" : "5. Quote summary"}</h2><p className="mt-3 text-2xl font-bold text-emerald-800">{price !== null ? `$${price.toFixed(2)} / ${cadenceLabel}` : (isEs ? "Tarifa pendiente de confirmación" : "Rate awaiting confirmation")}</p><p className="mt-2 text-sm text-slate-600">{store.address}</p>
                <h3 className="mt-5 font-bold text-emerald-950">{isEs ? "Servicios incluidos" : "Included services"}</h3>
                <ul className="mt-2 space-y-2 text-sm text-slate-900">{(isEs ? ["Corte de césped", "Recorte con desbrozadora", "Perfilado de bordes", "Limpieza con sopladora"] : ["Mow Lawn", "Line Trim", "Edge", "Blow Debris"]).map(label => <li key={label}>✓ {label}</li>)}</ul>
                <label className="mt-4 flex cursor-pointer items-center gap-2 text-sm font-semibold text-slate-900"><input type="checkbox" checked={Boolean(store.bagGrass)} onChange={event => store.setLawnOptions({bagGrass:event.target.checked})} />{isEs ? "Recoger el césped en bolsas (+$10 por corte)" : "Bag Grass (+$10 per cut)"}</label>
                {store.mowFrequency === "bi_weekly" && <div className="mt-5 rounded-lg border border-lime-400 bg-lime-50 p-4 text-slate-950">
                  <p className="font-bold">{weeklyRate && rate && Number(weeklyRate.price) < Number(rate.price) ? (isEs ? "Ahorra por corte con el servicio semanal" : "Save per cut with weekly service") : (isEs ? "Conoce la opción de servicio semanal" : "Explore weekly lawn service")}</p>
                  {weeklyRate ? <>
                    <p className="mt-2">${(Number(weeklyRate.price) + (store.bagGrass ? 10 : 0)).toFixed(2)} {isEs ? "por corte, cada 7 días" : "per cut, every 7 days"}</p>
                    {rate && Number(weeklyRate.price) < Number(rate.price) && <p className="mt-1 text-sm font-semibold">{isEs ? "Ahorro por corte:" : "Savings per cut:"} ${(Number(rate.price) - Number(weeklyRate.price)).toFixed(2)}</p>}
                  </> : <p className="mt-2 text-sm">{isEs ? "La tarifa semanal está pendiente de confirmación por el propietario." : "The weekly rate is awaiting confirmation from the owner."}</p>}
                  <Button type="button" disabled={!weeklyRate} className="mt-3" onClick={() => store.setLawnOptions({ mowFrequency: "weekly", serviceFrequency: "ongoing" })}>{isEs ? "Cambiar a semanal" : "Switch to weekly"}</Button>
                </div>}
              </div>
              <PropertySatellite address={store.address} latitude={store.latitude} longitude={store.longitude} isEs={isEs} compact polygon={polygon} geometry={lawnGeometry} parcelPolygons={store.measurement?.parcelPolygons ?? detectedParcel} center={markerCenter} loadingText={isEs ? "Analizando tu propiedad por satélite..." : "Analyzing your property by satellite..."} showMarker={false} />
            </div>
            <FieldError>{errors.measurement}</FieldError>
            <div className="grid gap-3 text-sm sm:grid-cols-2">
              <p><strong>{isEs ? "Cliente" : "Customer"}:</strong> {store.customerName}</p><p><strong>{isEs ? "Teléfono" : "Phone"}:</strong> {store.customerPhone}</p>
              <p><strong>{isEs ? "Frecuencia" : "Frequency"}:</strong> {cadenceLabel}</p><p><strong>{isEs ? "Propiedad" : "Property"}:</strong> {store.propertyOccupancy === "occupied" ? (isEs ? "Ocupada" : "Occupied") : (isEs ? "Deshabitada" : "Vacant")}</p>
              <p><strong>{isEs ? "Área elegida" : "Selected area"}:</strong> {store.areaSelection === "front_back" ? (isEs ? "Adelante y atrás" : "Front & Back") : store.areaSelection === "front_only" ? (isEs ? "Adelante" : "Front") : (isEs ? "Atrás" : "Back")}</p>
              <p><strong>{isEs ? "Césped calculado" : "Calculated lawn"}:</strong> {store.measurement ? `${lawnAreaSqFt.toLocaleString()} ft² / ${lawnAreaSqM.toLocaleString(undefined, { maximumFractionDigits: 1 })} m²` : (isEs ? "Pendiente de medición" : "Measurement pending")}</p>
              <p><strong>{isEs ? "Mascotas" : "Pets"}:</strong> {store.hasPetsInBackyard ? (isEs ? "Sí" : "Yes") : "No"}</p><p><strong>{isEs ? "Cerradura" : "Lock"}:</strong> {store.hasGateCode ? `${isEs ? "Sí" : "Yes"} (${store.gateCode})` : "No"}</p>
            </div>
            {(store.additionalNotes.trim() || store.details.trim()) && <div className="rounded-lg border border-slate-200 bg-white p-4 text-sm text-slate-700">{store.additionalNotes.trim() && <p><strong>{isEs ? "Nota" : "Note"}:</strong> {store.additionalNotes}</p>}{store.details.trim() && <p className="mt-2"><strong>{isEs ? "Trabajo adicional" : "Additional work"}:</strong> {store.details}</p>}</div>}
          </section>}

          {store.step === 6 && <section className="space-y-6">
            <div><h2 className="text-xl font-bold text-slate-900">{isEs ? "6. Calendario de servicio" : "6. Service calendar"}</h2><p className="mt-1 text-sm text-slate-600">{isEs ? `Ciudad detectada: ${store.city || "Sin ciudad"}` : `Detected city: ${store.city || "No city"}`}</p></div>
            <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-950">
              <p><strong>{isEs ? "Lunes y Martes" : "Monday and Tuesday"}:</strong> Liberty Hill, Georgetown</p>
              <p><strong>{isEs ? "Miércoles" : "Wednesday"}:</strong> Leander, Cedar Park, Georgetown, Liberty Hill</p>
              <p><strong>{isEs ? "Jueves y Viernes" : "Thursday and Friday"}:</strong> Hutto, Round Rock, Georgetown, Liberty Hill, Leander</p>
            </div>
            {store.city.trim() ? <MowingCalendar selected={store.requestedDate} city={store.city} isEs={isEs} onSelect={(date) => store.setSchedule(date, store.requestedTimeWindow ?? "08:00 - 18:00")} price={price} /> : <div className="rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 text-sm font-semibold text-amber-900">{isEs ? "Primero confirme una dirección con ciudad válida en el Paso 1 para habilitar el calendario." : "Please confirm an address with a valid city in Step 1 to unlock the calendar."}</div>}
            <FieldError>{errors.requestedDate}</FieldError>
          </section>}

          {store.step === 7 && <section className="space-y-6">
            <div><h2 className="text-xl font-bold text-slate-900">{isEs ? "7. Métodos de pago" : "7. Payment methods"}</h2></div>
            <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-4">
              <h3 className="font-bold text-emerald-950">{isEs ? "Métodos de pago" : "Payment options"}</h3>
              <select value={store.paymentMethod} onChange={(event) => store.setPaymentMethod(event.target.value as PaymentMethod)} className="mt-3 min-h-11 w-full max-w-sm rounded-lg border border-slate-300 bg-white px-3 text-slate-900">
                <option value="cash">{isEs ? "Efectivo" : "Cash"}</option><option value="venmo">Venmo</option><option value="cash_app">Cash App</option><option value="zelle">Zelle</option>
              </select>
              <div className="mt-3 flex flex-wrap gap-3"><span className="rounded-lg border border-slate-200 bg-white px-3 py-2 font-semibold text-slate-900">{isEs ? "Efectivo al finalizar" : "Cash after service"}</span><a href={BUSINESS.venmoUrl} target="_blank" rel="noreferrer" className="rounded-lg border border-slate-200 bg-white px-3 py-2 font-semibold text-slate-900">Venmo · {BUSINESS.venmoUrl}</a><a href={BUSINESS.cashAppUrl} target="_blank" rel="noreferrer" className="rounded-lg border border-slate-200 bg-white px-3 py-2 font-semibold text-slate-900">Cash App · {BUSINESS.cashAppTag}</a><span className="rounded-lg border border-slate-200 bg-white px-3 py-2 font-semibold text-slate-900">Zelle · {BUSINESS.zellePhoneDisplay}</span></div>
            </div>
            <div className="rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 text-sm font-bold text-amber-900">{isEs ? "NOTA IMPORTANTE: Siempre que envíe su pago, asegúrese de poner su dirección en la nota del pago." : "IMPORTANT NOTE: Whenever you send your payment, make sure to put your address in the payment note."}</div>
          </section>}

          {store.step === 8 && <section className="space-y-6 text-center">
            <ShieldCheck className="mx-auto size-14 text-emerald-700" />
            <div><h2 className="text-2xl font-extrabold text-slate-950">{isEs ? "¡Gracias por su preferencia!" : "Thank you for choosing us!"}</h2><p className="mt-2 text-slate-600">{isEs ? "Revise su cotización y envíela directo al propietario para confirmar los detalles." : "Review your quote and send it directly to the owner to confirm the details."}</p></div>
            <div className="mx-auto max-w-md rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-left text-sm text-slate-800">
              <p><strong>{isEs ? "Cliente" : "Customer"}:</strong> {store.customerName}</p>
              <p><strong>{isEs ? "Dirección" : "Address"}:</strong> {store.address}</p>
              <p><strong>{isEs ? "Precio" : "Price"}:</strong> {price !== null ? `$${price.toFixed(2)} / ${cadenceLabel}` : "—"}</p>
              <p><strong>{isEs ? "Área" : "Area"}:</strong> {lawnAreaSqFt.toLocaleString()} ft²</p>
            </div>
            <p className="text-sm text-slate-600">{isEs ? "Al enviar, se guarda la solicitud y se abre el mensaje SMS con la cotización completa." : "When sending, the request is saved and the SMS message opens with the complete quote."}</p>
          </section>}

          <div className="flex justify-between gap-3 border-t border-slate-200 pt-5">
            {store.step > 1 ? <Button type="button" variant="outline" onClick={store.goBack}>{isEs ? "Anterior" : "Back"}</Button> : <span />}
            {store.step < TOTAL_STEPS ? <Button type="button" onClick={() => void next()} className="bg-emerald-700 font-bold hover:bg-emerald-800">{store.step === 1 ? (isEs ? "Siguiente" : "Next") : (isEs ? "Continuar" : "Continue")}</Button> : <Button type="button" onClick={() => void submit()} disabled={sending} className="bg-emerald-700 font-bold hover:bg-emerald-800"><Send className="mr-2 size-4" />{sending ? (isEs ? "Enviando…" : "Sending…") : (isEs ? "Enviar cotización" : "Send quote")}</Button>}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function Confirmation({ isEs, store, price, onReset }: { isEs: boolean; store: QuoteStore; price: number | null; onReset: () => void }) {
  const smsBody = `${BUSINESS.name} - Folio ${store.referenceCode ?? ""}\n${store.address}\n${store.customerName} · ${store.customerPhone}`;
  const { cadence: cadenceLabel } = getMowFrequencyLabels(store.mowFrequency, isEs);
  return <Card className="mx-auto max-w-2xl space-y-5 p-8 text-center"><CardContent className="space-y-5"><ShieldCheck className="mx-auto size-14 text-emerald-700" /><h1 className="text-2xl font-extrabold text-slate-950">{isEs ? "¡Muchas gracias por su preferencia! Su solicitud ha sido procesada." : "Thank you! Your request has been processed."}</h1><p className="text-sm text-slate-600">{isEs ? "La solicitud se guardó en Supabase. Si el SMS no se abrió automáticamente, use el botón de abajo para contactar al propietario." : "Your request was saved to Supabase. If the SMS app did not open automatically, use the button below to contact the owner."}</p><p className="text-xl font-bold text-emerald-800">{price !== null ? `$${price.toFixed(2)} / ${cadenceLabel}` : (isEs ? "Tarifa pendiente de confirmación" : "Rate awaiting confirmation")}</p><a href={`${BUSINESS.smsHref}?body=${encodeURIComponent(smsBody)}`} className="inline-flex items-center rounded-lg bg-emerald-700 px-4 py-3 font-bold text-white"><MessageSquare className="mr-2 size-4" />{isEs ? "Abrir SMS al propietario" : "Open owner SMS"}</a><div><Button variant="outline" onClick={onReset}><CheckCircle2 className="mr-2 size-4" />{isEs ? "Nueva cotización" : "New quote"}</Button></div></CardContent></Card>;
}

function MowingCalendar({ selected, city, isEs, onSelect, price }: { selected: string | null; city: string; isEs: boolean; onSelect: (date: string) => void; price: number | null }) {
  const normalizeCityKey = (value: string) => value.toLocaleLowerCase("en-US").replace(/[^a-z]/g, "");
  const todayISO = texasToday;
  const [monthOffset, setMonthOffset] = React.useState(0);
  const now = new Date();
  const month = new Date(now.getFullYear(), now.getMonth() + monthOffset, 1);
  const firstDay = (month.getDay() + 6) % 7;
  const days = new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate();
  const labels = isEs ? ["L", "M", "M", "J", "V", "S", "D"] : ["M", "T", "W", "T", "F", "S", "S"];
  const monthKey = `${month.getFullYear()}-${String(month.getMonth() + 1).padStart(2, "0")}`;
  const cityQuery = city.trim();
  const normalizedCity = normalizeCityKey(city.trim());

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
          const isWeekend = weekday === 0 || weekday === 6;
          const isCovered = normalizedCity
            ? getCoverageCitiesForWeekday(weekday).some((coveredCity) => normalizeCityKey(coveredCity) === normalizedCity)
            : false;
          const isOutOfZone = isWeekend || !isCovered;
          const isOccupied = false;
          const disabled = iso < todayISO() || isOutOfZone || index + 1 > 14;
          const occupiedClass = isOccupied ? "border-red-300 bg-red-50 text-red-700 line-through" : "";
          const unavailableClass = !isOccupied && disabled ? "border-slate-100 bg-slate-50 text-slate-300" : "";
          const selectedClass = selected === iso && !disabled ? "border-green-500 bg-emerald-50 text-emerald-900 ring-2 ring-emerald-200" : "";
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
        <p>{isEs ? "El primer servicio se puede elegir del día 1 al 14 de cada mes. Sin límite de solicitudes por día." : "Choose the first service between the 1st and 14th of each month. No daily booking limit."}</p>

      </div>
    </div>
  );
}
