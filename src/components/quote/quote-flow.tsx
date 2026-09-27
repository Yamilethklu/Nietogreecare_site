"use client";

import * as React from "react";
import Link from "next/link";
import { ArrowLeft, CalendarDays, CheckCircle2, ChevronLeft, ChevronRight, MessageSquare, Send, ShieldCheck } from "lucide-react";

import { useLanguage } from "@/components/providers/language-provider";
import { useToast } from "@/components/providers/toast-provider";
import { PropertySatellite } from "@/components/quote/property-satellite";
import { Step1Address, Step1AddressHint } from "@/components/quote/step-1-address";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { FieldError, Input, Label } from "@/components/ui/input";
import { BUSINESS, SERVICES, ZIP_CITY_MAP } from "@/lib/constants";
import { buildMonthMatrix, isDateSelectable, toDateKey } from "@/lib/calendar";
import { matchMowRate, type MowRate } from "@/lib/instant-pricing";
import { getCoverageCitiesForWeekday, isDateCoveredForCity } from "@/lib/service-schedule";
import { formatZodErrors, step1Schema, step7Schema } from "@/lib/validation";
import type { GardenGeometry, PaymentMethod, PolygonPoint } from "@/lib/types";
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

export function QuoteFlow({ embedded = false }: { embedded?: boolean }) {
  const { isEs } = useLanguage();
  const { toast } = useToast();
  const store = useQuoteStore();
  const [hydrated, setHydrated] = React.useState(false);
  const [errors, setErrors] = React.useState<Record<string, string>>({});
  const [rates, setRates] = React.useState<MowRate[]>([]);
  const [sending, setSending] = React.useState(false);
  const [gateAnswer, setGateAnswer] = React.useState<"yes" | "no" | "">("");
  const [calendarMonth, setCalendarMonth] = React.useState(() => {
    const today = new Date();
    return new Date(today.getFullYear(), today.getMonth(), 1);
  });
  const [occupiedDates, setOccupiedDates] = React.useState<string[]>([]);
  const [availabilityLoading, setAvailabilityLoading] = React.useState(false);
  const [availabilityError, setAvailabilityError] = React.useState("");
  const [geometryLoading, setGeometryLoading] = React.useState(false);
  const [geometryError, setGeometryError] = React.useState("");
  const [simulatedHouseFootprint, setSimulatedHouseFootprint] = React.useState(false);
  const geometryAddress = React.useRef("");
  const geometryInFlight = React.useRef(false);

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
    if (!hydrated || store.step !== 2 || store.latitude == null || store.longitude == null) return;
    const requestKey = `${store.placeId ?? ""}|${store.address}|${store.zipCode}|${store.latitude},${store.longitude}`;
    if (geometryAddress.current === requestKey && (store.measurement?.gardenGeometry || geometryInFlight.current)) return;

    let cancelled = false;
    geometryAddress.current = requestKey;
    geometryInFlight.current = true;
    setGeometryLoading(true);
    setGeometryError("");
    setSimulatedHouseFootprint(false);
    useQuoteStore.setState({ measurement: null });

    void fetch("/api/lawn-geometry", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ address: store.address, zipCode: store.zipCode }),
      cache: "no-store",
    }).then(async (response) => {
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || "No se pudo calcular el área del jardín.");
      const gardenGeometry = payload.poligonoJardin as GardenGeometry;
      const components = gardenGeometry.type === "Polygon" ? [gardenGeometry.coordinates] : gardenGeometry.coordinates;
      const ring = components[0]?.[0] ?? [];
      const vertices = ring.slice(0, -1);
      const pointCount = Math.min(vertices.length, 40);
      const polygon = Array.from({ length: pointCount }, (_, index) => {
        const [lng, lat] = vertices[Math.floor(index * vertices.length / pointCount)];
        return { lat, lng } satisfies PolygonPoint;
      });
      if (polygon.length < 3 || !Number.isFinite(payload.areaPies) || !Number.isFinite(payload.areaMetros)) {
        throw new Error("No se pudo calcular el área del jardín.");
      }
      if (cancelled) return;
      store.setMeasurement({
        ...buildMeasurement(polygon, payload.areaPies, 2, 19, [polygon]),
        gardenGeometry,
        areaSqM: payload.areaMetros,
        center: payload.centro,
        simulatedHouseFootprint: Boolean(payload.huellaCasaSimulada),
      });
      setSimulatedHouseFootprint(Boolean(payload.huellaCasaSimulada));
    }).catch((error: unknown) => {
      if (!cancelled) setGeometryError(error instanceof Error ? error.message : "No se pudo calcular el área del jardín.");
    }).finally(() => {
      geometryInFlight.current = false;
      if (!cancelled) setGeometryLoading(false);
    });

    return () => { cancelled = true; };
  }, [hydrated, store.address, store.latitude, store.longitude, store.measurement, store.placeId, store.setMeasurement, store.step, store.zipCode]);

  React.useEffect(() => {
    if (store.step !== 5) return;
    let cancelled = false;
    const month = `${calendarMonth.getFullYear()}-${String(calendarMonth.getMonth() + 1).padStart(2, "0")}`;
    setAvailabilityLoading(true);
    setAvailabilityError("");
    void fetch(`/api/availability?month=${month}`, { cache: "no-store" })
      .then(async (response) => {
        const payload = await response.json();
        if (!response.ok || !payload.ok || !Array.isArray(payload.occupiedDates)) throw new Error("availability");
        if (!cancelled) setOccupiedDates(payload.occupiedDates);
      })
      .catch(() => {
        if (!cancelled) {
          setOccupiedDates([]);
          setAvailabilityError(isEs ? "No se pudo verificar la agenda. Intente de nuevo más tarde." : "Availability could not be verified. Please try again later.");
        }
      })
      .finally(() => {
        if (!cancelled) setAvailabilityLoading(false);
      });
    return () => { cancelled = true; };
  }, [calendarMonth, isEs, store.step]);

  const rate = matchMowRate(rates, store.measurement?.areaSqFt ?? 0, store.mowFrequency);
  const price = rate ? Number(rate.price) : null;
  const biWeeklyRate = matchMowRate(rates, store.measurement?.areaSqFt ?? 0, "bi_weekly");
  const biWeeklyPrice = biWeeklyRate ? Number(biWeeklyRate.price) : null;

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
    if (current.step === 2 && (!current.measurement || current.measurement.polygon.length < 3)) {
      setErrors({ measurement: geometryError || (isEs ? "No se pudo calcular el área catastral." : "Could not calculate the cadastral area.") });
      return;
    }
    if (current.step === 3) {
      const result = step7Schema.safeParse({ ...current, hasGateCode: false, gateCode: "" });
      if (current.selectedServices.length === 0 || !result.success) {
        setErrors({
          ...(current.selectedServices.length === 0 ? { selectedServices: isEs ? "Seleccione al menos un trabajo." : "Select at least one service." } : {}),
          ...(!result.success ? formatZodErrors(result.error) : {}),
        });
        toast({ title: isEs ? "Complete los datos requeridos" : "Complete the required details", variant: "error" });
        return;
      }
    }
    if (current.step === 5) {
      if (availabilityError) {
        setErrors({ requestedDate: availabilityError });
        return;
      }
      if (!current.requestedDate || !isDateCoveredForCity(current.requestedDate, current.city)) {
        setErrors({ requestedDate: isEs ? "Seleccione una fecha disponible para la ruta de su ciudad." : "Choose an available date on your city's route." });
        return;
      }
      if (availabilityLoading || occupiedDates.includes(current.requestedDate)) {
        setErrors({ requestedDate: isEs ? "Ese día no está disponible. Seleccione otro." : "That day is unavailable. Choose another." });
        return;
      }
      if (!current.gateQuestionAnswered || (current.hasGateCode && !current.gateCode.trim())) {
        setErrors({ hasGateCode: isEs ? "Responda la pregunta del candado y agregue el código si corresponde." : "Answer the lock question and add the code if needed." });
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
    if (!current.requestedDate || !isDateCoveredForCity(current.requestedDate, current.city) || occupiedDates.includes(current.requestedDate)) {
      setErrors({ requestedDate: isEs ? "La fecha ya no está disponible. Regrese al calendario y elija otra." : "That date is no longer available. Return to the calendar and choose another." });
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
      if (!response.ok || !payload.ok) {
        if (response.status === 409) useQuoteStore.getState().setStep(5);
        throw new Error(payload.error ?? (isEs ? "No se pudo enviar la solicitud." : "Failed to send the request."));
      }

      useQuoteStore.getState().markSubmitted();
    } catch (error) {
      toast({ title: error instanceof Error ? error.message : (isEs ? "Error al enviar" : "Could not submit"), variant: "error" });
    } finally {
      setSending(false);
    }
  };

  if (!hydrated) return <div className="py-24 text-center text-slate-500">{isEs ? "Cargando cotizador…" : "Loading quote…"}</div>;
  if (store.submitted) return <Confirmation isEs={isEs} store={store} price={price} onReset={store.reset} />;

  const cityHasCoverageDays = [1, 2, 3, 4, 5].some((weekday) => getCoverageCitiesForWeekday(weekday).some((city) => city.toLocaleLowerCase("en-US") === store.city.trim().toLocaleLowerCase("en-US")));

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
            <div><h2 className="text-xl font-bold text-slate-900">{isEs ? "2. Medición catastral automática" : "2. Automatic cadastral measurement"}</h2></div>
            <PropertySatellite address={store.address} latitude={store.latitude} longitude={store.longitude} isEs={isEs} geometry={store.measurement?.gardenGeometry} center={store.measurement?.center} />
            {geometryLoading && <p role="status" className="text-sm text-slate-600">{isEs ? "Calculando el área catastral…" : "Calculating cadastral area…"}</p>}
            {geometryError && <p role="alert" className="font-semibold text-red-700">{geometryError}</p>}
            {store.measurement && <p className="font-bold text-emerald-900">{isEs ? "Área de césped calculada automáticamente:" : "Automatically calculated lawn area:"} {store.measurement.areaSqM?.toLocaleString(isEs ? "es-US" : "en-US", { maximumFractionDigits: 1 })} m² ({Math.round(store.measurement.areaSqFt).toLocaleString()} ft²)</p>}
            {simulatedHouseFootprint && <p role="alert" className="rounded-lg bg-amber-50 p-3 text-sm font-semibold text-amber-900">{isEs ? "Aviso: Google Solar no proporcionó la huella de la casa. Se usó temporalmente una huella simulada; el área no es exacta." : "Warning: Google Solar did not provide the house footprint. A simulated footprint was used temporarily; the area is not exact."}</p>}
            <FieldError>{errors.measurement}</FieldError>
            <div className="rounded-lg bg-emerald-50 p-4 text-sm font-semibold text-emerald-950">{price !== null ? `$${price.toFixed(2)} / ${store.mowFrequency === "weekly" ? (isEs ? "semanal" : "weekly") : (isEs ? "quincenal" : "bi-weekly")}` : (isEs ? "Calculando tarifa…" : "Calculating rate…")}</div>
          </section>}

          {store.step === 3 && <section className="space-y-6">
            <div><h2 className="text-xl font-bold text-slate-900">{isEs ? "SELECCIONE LOS TRABAJOS A REALIZAR" : "SELECT SERVICES TO PERFORM"}</h2><p className="mt-1 text-sm text-slate-600">{isEs ? "Puede seleccionar uno o varios trabajos." : "Select one or more services."}</p></div>
            <div className="grid gap-2 sm:grid-cols-3">{SERVICES.map((service) => {
              const selected = store.selectedServices.includes(service.key);
              return <button key={service.key} type="button" aria-pressed={selected} onClick={() => store.toggleService(service.key)} className={`min-h-12 rounded-lg border px-3 py-2 text-left text-sm font-semibold transition ${selected ? "border-emerald-700 bg-emerald-50 text-emerald-900" : "border-slate-200 bg-white text-slate-700 hover:border-emerald-400"}`}>{isEs ? service.nameEs : service.nameEn}</button>;
            })}</div>
            <FieldError>{errors.selectedServices}</FieldError>
            <div className="grid gap-4 sm:grid-cols-2">
              <div><Label htmlFor="quote-customer-name">{isEs ? "Nombre completo *" : "Full name *"}</Label><Input id="quote-customer-name" required value={store.customerName} onChange={(event) => store.setPersonal({ customerName: event.target.value, firstName: event.target.value, lastName: "" })} className="mt-2" /><FieldError>{errors.customerName}</FieldError></div>
              <div><Label htmlFor="quote-customer-phone">{isEs ? "Teléfono *" : "Phone *"}</Label><Input id="quote-customer-phone" required type="tel" value={store.customerPhone} onChange={(event) => store.setPersonal({ customerPhone: event.target.value })} className="mt-2" /><FieldError>{errors.customerPhone}</FieldError></div>
            </div>
          </section>}

          {store.step === 4 && <section className="space-y-6">
            <div><h2 className="text-xl font-bold text-slate-900">{isEs ? "4. Frecuencia, ocupación y zona de corte" : "4. Frequency, occupancy and mowing area"}</h2></div>
            <fieldset><legend className="text-sm font-bold text-slate-800">{isEs ? "Frecuencia" : "Frequency"}</legend><div className="mt-2 grid gap-3 sm:grid-cols-2">
              {([{ key: "ongoing", label: isEs ? "Atención continua" : "Ongoing service", mow: "weekly" }, { key: "one_time", label: isEs ? "Servicio quincenal" : "Bi-weekly service", mow: "bi_weekly" }] as const).map((option) => <button key={option.key} type="button" aria-pressed={store.mowFrequency === option.mow} onClick={() => store.setLawnOptions({ serviceFrequency: option.key, mowFrequency: option.mow })} className={`min-h-12 rounded-lg border px-4 py-3 text-left font-semibold ${store.mowFrequency === option.mow ? "border-emerald-700 bg-emerald-50 text-emerald-950" : "border-slate-300 bg-white text-slate-800"}`}>{option.label}</button>)}
            </div></fieldset>
            <fieldset><legend className="text-sm font-bold text-slate-800">{isEs ? "Estado de la propiedad" : "Property status"}</legend><div className="mt-2 flex flex-wrap gap-3">{([{ key: "occupied", label: isEs ? "Ocupado" : "Occupied" }, { key: "vacant", label: isEs ? "Vacante" : "Vacant" }] as const).map((option) => <button key={option.key} type="button" aria-pressed={store.propertyOccupancy === option.key} onClick={() => store.setLawnOptions({ propertyOccupancy: option.key })} className={`rounded-lg border px-5 py-2 font-semibold ${store.propertyOccupancy === option.key ? "border-emerald-700 bg-emerald-700 text-white" : "border-slate-300 bg-white text-slate-800"}`}>{option.label}</button>)}</div></fieldset>
            <fieldset><legend className="text-sm font-bold text-slate-800">{isEs ? "Zona de corte" : "Mowing area"}</legend><div className="mt-2 grid gap-3 sm:grid-cols-3">{([{ key: "front_back", label: isEs ? "Frente y trasera" : "Front and back" }, { key: "front_only", label: isEs ? "Solo delantera" : "Front only" }, { key: "back_only", label: isEs ? "Solo trasera" : "Back only" }] as const).map((option) => <button key={option.key} type="button" aria-pressed={store.areaSelection === option.key} onClick={() => store.setLawnOptions({ areaSelection: option.key })} className={`min-h-12 rounded-lg border px-3 py-2 text-sm font-semibold ${store.areaSelection === option.key ? "border-emerald-700 bg-emerald-50 text-emerald-950" : "border-slate-300 bg-white text-slate-800"}`}>{option.label}</button>)}</div></fieldset>
            <div className="rounded-lg bg-emerald-50 p-4 font-bold text-emerald-950">{price !== null ? `$${price.toFixed(2)}` : (isEs ? "Calculando tarifa…" : "Calculating rate…")}</div>
          </section>}

          {store.step === 5 && <section className="space-y-6">
            <div><h2 className="text-xl font-bold text-slate-900">{isEs ? "5. Calendario y programación" : "5. Calendar and scheduling"}</h2><p className="mt-1 text-sm text-slate-600">{isEs ? `Ciudad de servicio: ${store.city || "No identificada"}` : `Service city: ${store.city || "Not identified"}`}</p></div>
            <aside className="rounded-lg border-l-4 border-emerald-700 bg-emerald-50 p-4 text-sm text-emerald-950">
              <h3 className="font-bold">{isEs ? "Días de cobertura" : "Coverage days"}</h3>
              <p className="mt-2"><strong>{isEs ? "Lunes y martes:" : "Monday and Tuesday:"}</strong> Liberty Hill, Georgetown.</p>
              <p><strong>{isEs ? "Miércoles:" : "Wednesday:"}</strong> Leander, Cedar Park, Georgetown, Liberty Hill.</p>
              <p><strong>{isEs ? "Jueves y viernes:" : "Thursday and Friday:"}</strong> Hutto, Round Rock, Georgetown, Liberty Hill, Leander.</p>
            </aside>
            {store.city && !cityHasCoverageDays && <p role="alert" className="rounded-lg bg-amber-50 p-3 text-sm font-semibold text-amber-900">{isEs ? `No hay días de ruta configurados para ${store.city}. Contáctenos para coordinar el servicio.` : `No route days are configured for ${store.city}. Contact us to arrange service.`}</p>}
            <div className="rounded-lg border border-slate-200 bg-white p-4">
              <div className="mb-4 flex items-center justify-between gap-3">
                <Button type="button" variant="outline" aria-label={isEs ? "Mes anterior" : "Previous month"} onClick={() => setCalendarMonth(new Date(calendarMonth.getFullYear(), calendarMonth.getMonth() - 1, 1))}><ChevronLeft className="size-4" /></Button>
                <h3 className="flex items-center gap-2 text-base font-bold capitalize text-slate-900"><CalendarDays className="size-5 text-emerald-700" />{calendarMonth.toLocaleDateString(isEs ? "es-US" : "en-US", { month: "long", year: "numeric" })}</h3>
                <Button type="button" variant="outline" aria-label={isEs ? "Mes siguiente" : "Next month"} onClick={() => setCalendarMonth(new Date(calendarMonth.getFullYear(), calendarMonth.getMonth() + 1, 1))}><ChevronRight className="size-4" /></Button>
              </div>
              <div className="grid grid-cols-7 gap-1 text-center text-xs font-bold text-slate-600">{(isEs ? ["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"] : ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"]).map((day) => <span key={day} className="py-2">{day}</span>)}</div>
              <div className="grid grid-cols-7 gap-1">{buildMonthMatrix(calendarMonth.getFullYear(), calendarMonth.getMonth()).flatMap((week, weekIndex) => week.map((date, dayIndex) => {
                if (!date) return <span key={`empty-${weekIndex}-${dayIndex}`} className="aspect-square" />;
                const dateKey = toDateKey(date);
                const busy = occupiedDates.includes(dateKey);
                const onRoute = isDateCoveredForCity(dateKey, store.city);
                const selectable = Boolean(store.city) && onRoute && isDateSelectable(date) && !busy && !availabilityLoading && !availabilityError;
                const selected = store.requestedDate === dateKey;
                return <button key={dateKey} type="button" disabled={!selectable} aria-pressed={selected} aria-label={`${date.toLocaleDateString(isEs ? "es-US" : "en-US", { dateStyle: "full" })}${busy ? (isEs ? ", ocupado" : ", occupied") : ""}`} onClick={() => { store.setSchedule(dateKey); setErrors((current) => ({ ...current, requestedDate: "" })); }} className={`aspect-square rounded-md text-sm font-semibold transition disabled:cursor-not-allowed ${busy ? "bg-red-100 text-red-700 line-through" : selected ? "bg-emerald-700 text-white" : selectable ? "bg-emerald-50 text-emerald-950 hover:bg-emerald-100" : "bg-slate-50 text-slate-300"}`}>{date.getDate()}</button>;
              }))}</div>
              <div className="mt-4 flex flex-wrap gap-x-5 gap-y-2 text-xs text-slate-600"><span className="inline-flex items-center gap-2"><i className="size-3 rounded-sm bg-emerald-100" />{isEs ? "Disponible según cobertura" : "Available on your route"}</span><span className="inline-flex items-center gap-2"><i className="size-3 rounded-sm bg-red-200" />{isEs ? "Solicitado / ocupado" : "Requested / occupied"}</span></div>
            </div>
            <p className="font-bold text-emerald-900">Lawn square footage: {Math.round(store.measurement?.areaSqFt ?? 0).toLocaleString()} sq ft</p>
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
            <div className="rounded-lg bg-emerald-50 p-4"><p className="text-lg font-bold text-emerald-950">{price !== null ? `$${price.toFixed(2)} / ${store.mowFrequency === "weekly" ? (isEs ? "semanal" : "weekly") : (isEs ? "quincenal" : "bi-weekly")}` : (isEs ? "Tarifa no disponible" : "Rate unavailable")}</p></div>
          </section>}

          {store.step === 7 && <section className="space-y-6">
            <div><h2 className="text-xl font-bold text-slate-900">{isEs ? "7. Método de pago" : "7. Payment method"}</h2></div>
            <fieldset><legend className="text-sm font-bold text-slate-800">{isEs ? "Seleccione cómo realizará el pago" : "Choose how you will pay"}</legend><div className="mt-2 grid gap-3 sm:grid-cols-3">{([{ key: "venmo", label: "Venmo", detail: BUSINESS.venmoHandle }, { key: "cash_app", label: "Cash App", detail: BUSINESS.cashAppTag }, { key: "zelle", label: "Zelle", detail: "737 314 4215" }] as const).map((method) => <button key={method.key} type="button" aria-pressed={store.paymentMethod === method.key} onClick={() => store.setPaymentMethod(method.key as PaymentMethod)} className={`rounded-lg border p-4 text-left ${store.paymentMethod === method.key ? "border-emerald-700 bg-emerald-50 text-emerald-950" : "border-slate-300 bg-white text-slate-800"}`}><span className="block font-bold">{method.label}</span><span className="mt-1 block text-sm">{method.detail}</span></button>)}</div></fieldset>
            <div className="rounded-lg border-2 border-amber-500 bg-amber-50 p-5 text-lg font-extrabold text-amber-950">{isEs ? "NOTA IMPORTANTE: Siempre que envíe su pago, asegúrese de poner su dirección en la nota del pago." : "IMPORTANT NOTE: Whenever you send your payment, be sure to include your address in the payment note."}</div>
            <div className="flex flex-wrap gap-3"><a href={BUSINESS.venmoUrl} target="_blank" rel="noreferrer" className="rounded-lg border border-slate-300 bg-white px-4 py-3 font-semibold text-slate-900">Venmo · {BUSINESS.venmoHandle}</a><a href={BUSINESS.cashAppUrl} target="_blank" rel="noreferrer" className="rounded-lg border border-slate-300 bg-white px-4 py-3 font-semibold text-slate-900">Cash App · {BUSINESS.cashAppTag}</a><span className="rounded-lg border border-slate-300 bg-white px-4 py-3 font-semibold text-slate-900">Zelle · 737 314 4215</span></div>
            <FieldError>{errors.paymentMethod}</FieldError>
          </section>}

          <div className="flex justify-between gap-3 border-t border-slate-200 pt-5">
            {store.step > 1 ? <Button type="button" variant="outline" onClick={store.goBack}>{isEs ? "Anterior" : "Back"}</Button> : <span />}
            {store.step < TOTAL_STEPS ? <Button type="button" onClick={() => void next()} disabled={store.step === 2 && (geometryLoading || !store.measurement)} className="bg-emerald-700 font-bold hover:bg-emerald-800">{isEs ? "Continuar" : "Continue"}</Button> : <Button type="button" onClick={() => void submit()} disabled={sending} className="bg-emerald-700 font-bold hover:bg-emerald-800"><Send className="mr-2 size-4" />{sending ? (isEs ? "Guardando…" : "Saving…") : (isEs ? "GUARDAR SOLICITUD" : "SAVE REQUEST")}</Button>}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function MowingCalendar({ selected, isEs, onSelect, price }: { selected: string | null; isEs: boolean; onSelect: (date: string) => void; price: number | null }) {
  const [monthOffset, setMonthOffset] = React.useState(0);
  const now = new Date();
  const month = new Date(now.getFullYear(), now.getMonth() + monthOffset, 1);
  const firstDay = (month.getDay() + 6) % 7;
  const days = new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate();
  const labels = isEs ? ["L", "M", "M", "J", "V", "S", "D"] : ["M", "T", "W", "T", "F", "S", "S"];

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
          const disabled = iso < todayISO() || date.getDay() === 0;
          return <button key={iso} type="button" disabled={disabled} onClick={() => onSelect(iso)} aria-pressed={selected === iso} aria-label={date.toLocaleDateString(isEs ? "es-MX" : "en-US", { dateStyle: "long" })} className={`min-h-14 rounded-lg border px-1 py-2 text-xs sm:min-h-16 ${selected === iso ? "border-green-500 bg-emerald-50 text-emerald-900" : "border-slate-100 text-slate-900 hover:border-emerald-300"} disabled:cursor-not-allowed disabled:bg-slate-50 disabled:text-slate-300`}>
            <span className="block font-semibold">{index + 1}</span>{!disabled && price !== null && <span className="block text-[10px] font-bold text-emerald-700">${price.toFixed(0)}</span>}
          </button>;
        })}
      </div>
      <p className="mt-4 text-xs text-slate-500">{isEs ? "Elige tu fecha preferida; te contactaremos para confirmar disponibilidad." : "Choose your preferred date; we will contact you to confirm availability."}</p>
    </div>
  );
}

function Confirmation({ isEs, store, price, onReset }: { isEs: boolean; store: QuoteStore; price: number | null; onReset: () => void }) {
  const serviceNames = store.selectedServices.map((key) => {
    const service = SERVICES.find((item) => item.key === key);
    return service ? (isEs ? service.nameEs : service.nameEn) : key;
  });
  const smsBody = [
    `${BUSINESS.name} · ${isEs ? "Solicitud de cotización" : "Quote request"}`,
    `Folio: ${store.referenceCode ?? ""}`,
    `Dirección: ${store.address}, ${store.city}, TX ${store.zipCode}`,
    `Área de césped: ${Math.round(store.measurement?.areaSqFt ?? 0).toLocaleString()} sq ft`,
    `Trabajos: ${serviceNames.join(", ")}`,
    `Día solicitado: ${store.requestedDate ?? ""}`,
    `Cliente: ${store.customerName} · ${store.customerPhone}`,
  ].join("\n");
  const smsHref = `sms:${BUSINESS.phoneE164}?body=${encodeURIComponent(smsBody)}`;
  return <Card className="mx-auto max-w-2xl space-y-5 p-8 text-center"><CardContent className="space-y-5"><ShieldCheck className="mx-auto size-14 text-emerald-700" /><h1 className="text-2xl font-extrabold text-slate-950">{isEs ? "¡Gracias por su preferencia!" : "Thank you for choosing us!"}</h1><p className="text-sm text-slate-600">{isEs ? "Su solicitud fue guardada. Para avisar al propietario por SMS, abra el mensaje preparado y presione enviar." : "Your request was saved. To notify the owner by text, open the prepared message and press send."}</p><p className="font-bold text-slate-800">{isEs ? "Propietario" : "Owner"}: +1 737 314 4215</p><p className="text-xl font-bold text-emerald-800">{price !== null ? `$${price.toFixed(2)}` : ""}</p><a href={smsHref} className="inline-flex items-center rounded-lg bg-emerald-700 px-4 py-3 font-bold text-white"><MessageSquare className="mr-2 size-4" />{isEs ? "Abrir SMS al propietario" : "Text the owner"}</a><div><Button variant="outline" onClick={onReset}><CheckCircle2 className="mr-2 size-4" />{isEs ? "Nueva cotización" : "New quote"}</Button></div></CardContent></Card>;
}
