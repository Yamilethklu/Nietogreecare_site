// NOTE: Refactoring to Light Mode (bg-white, emerald accents)

"use client";

import * as React from "react";
import Link from "next/link";
import {
  ArrowLeft,
  Check,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  MessageSquare,
  Send,
  ShieldCheck,
} from "lucide-react";

import { useLanguage } from "@/components/providers/language-provider";
import { useToast } from "@/components/providers/toast-provider";
import { Step1Address, Step1AddressHint } from "@/components/quote/step-1-address";
import { LawnMeasurement } from "@/components/quote/lawn-measurement";
import { matchMowRate, type MowRate } from "@/lib/instant-pricing";
import { BUSINESS } from "@/lib/constants";
import { PropertySatellite } from "@/components/quote/property-satellite";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, LuxuryCard } from "@/components/ui/card";
import { Select } from "@/components/ui/controls";
import { FieldError, Input, Label, Textarea } from "@/components/ui/input";
import { buildOwnerSmsHref, TIME_WINDOWS, ZIP_CITY_MAP } from "@/lib/constants";
import { todayISO } from "@/lib/utils";
import {
  formatZodErrors,
  step1Schema,
  step2Schema,
  step3Schema,
  step4Schema,
  step5Schema,
  measurementStepSchema,
  step7Schema,
} from "@/lib/validation";
import { pickSubmissionFields, TOTAL_STEPS, useQuoteStore } from "@/store/quote-store";

export function QuoteFlow({ embedded = false }: { embedded?: boolean }) {
  const { isEs } = useLanguage();
  const { toast } = useToast();
  const store = useQuoteStore();
  const [hydrated, setHydrated] = React.useState(false);
  const [errors, setErrors] = React.useState<Record<string, string>>({});
  const [sending, setSending] = React.useState(false);
  const [rates, setRates] = React.useState<MowRate[]>([]);

  React.useEffect(() => { void fetch("/api/lawn-rates", {cache:"no-store"}).then(async (response) => { if (!response.ok) throw new Error("rates"); const payload = await response.json(); setRates(payload.data ?? []); }).catch(() => {}); }, []);
  const rate = matchMowRate(rates, store.measurement?.areaSqFt ?? 0, store.mowFrequency);
  const price = rate ? Number(rate.price) : null;

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
      if (useQuoteStore.persist?.rehydrate) {
        const res = useQuoteStore.persist.rehydrate();
        if (res && typeof (res as Promise<void>).then === "function") {
          void (res as Promise<void>).then(applyUrlAddress).catch(applyUrlAddress);
        } else {
          applyUrlAddress();
        }
      } else {
        applyUrlAddress();
      }
    } catch {
      applyUrlAddress();
    }
  }, []);


  const next = () => {
    let result: { success: boolean; error?: any } = { success: true };
    if (store.step === 1) result = step1Schema.safeParse(store);
    else if (store.step === 2) result = step2Schema.safeParse(store);
    else if (store.step === 3) result = step3Schema.safeParse(store);
    else if (store.step === 4) result = step4Schema.safeParse(store);
    else if (store.step === 5) result = measurementStepSchema.safeParse(store);
    else if (store.step === 6) result = step5Schema.safeParse(store);
    else if (store.step === 7 && price === null) { toast({ title: isEs ? "El dueño aún debe configurar el precio para esta medida." : "The owner needs to configure pricing for this area.", variant: "error" }); return; }

    if (!result.success && result.error) {
      setErrors(formatZodErrors(result.error));
      toast({ title: isEs ? "Revise los campos requeridos" : "Please review required fields", variant: "error" });
      return;
    }
    setErrors({});
    store.goNext();
  };

  const submit = async () => {
    const result = step7Schema.safeParse(store);
    if (price === null || !store.measurement) { toast({ title: isEs ? "No hay tarifa disponible para esta medida." : "No rate available for this lawn size.", variant: "error" }); return; }
    if (store.paymentMethod === "cash" && store.cashLocation.trim().length < 3) { setErrors({cashLocation:isEs ? "Indique dónde dejará el efectivo." : "Tell us where you will leave cash."}); return; }
    if (!result.success) {
      setErrors(formatZodErrors(result.error));
      toast({ title: isEs ? "Complete sus datos de contacto" : "Complete contact details", variant: "error" });
      return;
    }

    setSending(true);
    try {
      const referenceCode = store.ensureReferenceCode();
      const response = await fetch("/api/leads", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...pickSubmissionFields(store), referenceCode, quotedPrice: price, snapshotUrl: null }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok || !payload.ok) {
        throw new Error(payload.error ?? (isEs ? "No se pudo enviar la solicitud." : "Failed to send request."));
      }

      const acceptedPrice = Number(payload.data.price);
      const smsBody = [
        `Nieto Green Care LLC - Cotización de Yarda`,
        `Folio: ${referenceCode}`,
        `Dirección: ${store.address}`,
        `Servicio: corte de yarda; $${acceptedPrice.toFixed(2)} por corte + impuestos aplicables`,
        `Césped: ${Math.round(store.measurement.areaSqFt)} pies cuadrados`,
        `Pago: ${store.paymentMethod}${store.paymentMethod === "cash" ? `; efectivo en ${store.cashLocation}` : ""}`,
        `Servicio: ${store.serviceFrequency === "ongoing" ? "Ongoing" : "One-time"}`,
        `Frecuencia: ${store.mowFrequency === "weekly" ? "Weekly" : "Bi-Weekly"}`,
        `Área: ${store.areaSelection === "front_back" ? "Front & Back" : store.areaSelection === "front_only" ? "Front Only" : "Back Only"}`,
        `Lote esquina: ${store.isCornerLot ? "Sí" : "No"}`,
        `Fecha preferida: ${store.requestedDate}`,
        `Cliente: ${store.firstName} ${store.lastName}`,
        `Tel: ${store.customerPhone}`,
        `Email: ${store.customerEmail}`,
        ...(store.additionalNotes.trim() ? [`Notas: ${store.additionalNotes.trim()}`] : []),
      ].join("\n");

      const smsUrl = buildOwnerSmsHref(store.address, smsBody);
      store.markSubmitted();
      window.location.href = smsUrl;
    } catch (error) {
      toast({ title: error instanceof Error ? error.message : "Error al enviar", variant: "error" });
    } finally {
      setSending(false);
    }
  };

  if (!hydrated) {
    return <div className="py-24 text-center text-slate-500">Cargando cotizador…</div>;
  }

  if (store.submitted) {
    return <Confirmation isEs={isEs} address={store.address} onReset={store.reset} price={price} paymentMethod={store.paymentMethod} cashLocation={store.cashLocation} />;
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        {!embedded && <Link
          href="/"
          className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-widest text-green-600 hover:text-green-700"
        >
          <ArrowLeft className="size-4" />
          {isEs ? "Volver al inicio" : "Back to Home"}
        </Link>}
        <Badge className="border-emerald-200 bg-emerald-50 text-green-700">
          {isEs ? `Paso ${store.step} de ${TOTAL_STEPS}` : `Step ${store.step} of ${TOTAL_STEPS}`}
        </Badge>
      </div>

      <Card className="border-lime-300 bg-white/95 shadow-xl shadow-emerald-900/10">
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-2xl font-bold text-slate-900">
              {isEs ? "Solicitud de corte de yarda" : "Lawn Mowing Request"}
            </CardTitle>
            <span className="rounded-full border border-lime-300 bg-lime-100 px-3 py-1 text-sm font-bold text-emerald-900">{isEs ? "Precio instantáneo" : "Instant price"}</span>
          </div>

          <div className="mt-4 grid grid-cols-8 gap-1">
            {Array.from({ length: TOTAL_STEPS }, (_, i) => i + 1).map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => {
                  if (s < store.step) store.setStep(s);
                }}
                disabled={s > store.step}
                className={`h-2 rounded-full transition-all ${
                  s === store.step
                    ? "bg-lime-500"
                    : s < store.step
                      ? "bg-lime-500 cursor-pointer"
                      : "bg-slate-200"
                }`}
                title={`Paso ${s}`}
              />
            ))}
          </div>
        </CardHeader>

        <CardContent className="space-y-8">
          {store.step === 1 && (
            <section className="space-y-5">
              <h2 className="text-2xl font-bold text-slate-900">
                {isEs ? "1. Dirección y Código Postal" : "1. Address & ZIP Code"}
              </h2>
              <div>
                <Step1Address error={errors.address} isEs={isEs} />
                <Step1AddressHint isEs={isEs} />
                <FieldError>{errors.address}</FieldError>
              </div>
              <div>
                <Label htmlFor="quote-zip" className="text-slate-900">{isEs ? "Código postal *" : "ZIP Code *"}</Label>
                <Input
                  id="quote-zip"
                  value={store.zipCode ?? ""}
                  maxLength={5}
                  onChange={(event) => {
                    const zipCode = event.target.value.replace(/\D/g, "").slice(0, 5);
                    store.setAddress({ zipCode, city: ZIP_CITY_MAP[zipCode] ?? store.city ?? "" });
                  }}
                  placeholder="78642"
                  className="mt-2 text-slate-900"
                />
                <FieldError>{errors.zipCode}</FieldError>
              </div>
              <div className="space-y-3">
                <p className="text-sm font-bold text-emerald-950">{isEs ? "Ubicación del trabajo" : "Job location"}</p>
                <PropertySatellite address={store.address} latitude={store.latitude} longitude={store.longitude} isEs={isEs} />
                <p className="text-xs text-slate-600">{isEs ? "El punto verde indica la dirección seleccionada. Confirma que sea la propiedad correcta." : "The green marker shows the selected address. Check that this is the right property."}</p>
              </div>
            </section>
          )}

          {store.step === 2 && (
            <section className="space-y-6">
              <h2 className="text-2xl font-bold text-slate-900">
                {isEs ? "2. Frecuencia de Servicio y Ocupación" : "2. Service Frequency & Occupancy"}
              </h2>

              <div>
                <Label className="text-sm font-semibold text-slate-700">
                  {isEs ? "¿Tipo de servicio?" : "Service Type"}
                </Label>
                <div className="mt-3 grid gap-3 sm:grid-cols-2">
                  <button
                    type="button"
                    onClick={() => store.setLawnOptions({ serviceFrequency: "ongoing" })}
                    className={`rounded-2xl border p-4 text-left transition ${
                      store.serviceFrequency === "ongoing"
                        ? "border-green-500 bg-emerald-50 text-slate-900 shadow-lg"
                        : "border-slate-200 bg-slate-50 text-slate-600 hover:border-slate-200"
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-base">{isEs ? "Continuo (Ongoing)" : "Ongoing Care"}</span>
                      {store.serviceFrequency === "ongoing" && <Check className="size-5 text-emerald-400" />}
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() => store.setLawnOptions({ serviceFrequency: "one_time" })}
                    className={`rounded-2xl border p-4 text-left transition ${
                      store.serviceFrequency === "one_time"
                        ? "border-green-500 bg-emerald-50 text-slate-900 shadow-lg"
                        : "border-slate-200 bg-slate-50 text-slate-600 hover:border-slate-200"
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-base">{isEs ? "Ocasional (One-Time)" : "One-Time Service"}</span>
                      {store.serviceFrequency === "one_time" && <Check className="size-5 text-emerald-400" />}
                    </div>
                  </button>
                </div>
              </div>

              <div>
                <Label className="text-sm font-semibold text-slate-700">
                  {isEs ? "Estado de la propiedad" : "Property Status"}
                </Label>
                <div className="mt-3 grid gap-3 sm:grid-cols-2">
                  <button
                    type="button"
                    onClick={() => store.setLawnOptions({ propertyOccupancy: "occupied" })}
                    className={`rounded-2xl border p-4 text-left transition ${
                      store.propertyOccupancy === "occupied"
                        ? "border-green-400 bg-emerald-50 text-slate-900 shadow-lg"
                        : "border-slate-200 bg-slate-50 text-slate-600 hover:border-slate-200"
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-base">{isEs ? "Ocupada (Occupied)" : "Occupied"}</span>
                      {store.propertyOccupancy === "occupied" && <Check className="size-5 text-green-700" />}
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() => store.setLawnOptions({ propertyOccupancy: "vacant" })}
                    className={`rounded-2xl border p-4 text-left transition ${
                      store.propertyOccupancy === "vacant"
                        ? "border-green-400 bg-emerald-50 text-slate-900 shadow-lg"
                        : "border-slate-200 bg-slate-50 text-slate-600 hover:border-slate-200"
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-base">{isEs ? "Desocupada (Vacant)" : "Vacant"}</span>
                      {store.propertyOccupancy === "vacant" && <Check className="size-5 text-green-700" />}
                    </div>
                  </button>
                </div>
              </div>
            </section>
          )}
          {store.step === 3 && (
            <section className="space-y-5">
              <h2 className="text-2xl font-bold text-slate-900">
                {isEs ? "3. Frecuencia de Corte" : "3. Mowing Frequency"}
              </h2>

              <div className="grid gap-4 sm:grid-cols-2">
                <button
                  type="button"
                  onClick={() => store.setLawnOptions({ mowFrequency: "weekly" })}
                  className={`rounded-2xl border p-5 text-left transition ${
                    store.mowFrequency === "weekly"
                      ? "border-green-500 bg-emerald-50 text-slate-900 shadow-luxury"
                      : "border-slate-200 bg-slate-50 text-slate-600 hover:border-slate-200"
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xl font-bold text-slate-900">
                      {isEs ? "Semanal (Weekly)" : "Weekly"}
                    </span>
                    {store.mowFrequency === "weekly" && <Check className="size-6 text-emerald-400" />}
                  </div>
                  <p className="mt-2 text-xs text-slate-700">
                    {isEs ? "Recomendado para primavera/verano." : "Recommended for peak growing season."}
                  </p>

                </button>

                <button
                  type="button"
                  onClick={() => store.setLawnOptions({ mowFrequency: "bi_weekly" })}
                  className={`rounded-2xl border p-5 text-left transition ${
                    store.mowFrequency === "bi_weekly"
                      ? "border-green-500 bg-emerald-50 text-slate-900 shadow-luxury"
                      : "border-slate-200 bg-slate-50 text-slate-600 hover:border-slate-200"
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xl font-bold text-slate-900">
                      {isEs ? "Quincenal (Bi-Weekly)" : "Bi-Weekly"}
                    </span>
                    {store.mowFrequency === "bi_weekly" && <Check className="size-6 text-emerald-400" />}
                  </div>
                  <p className="mt-2 text-xs text-slate-700">
                    {isEs ? "Corte cada dos semanas." : "Serviced every two weeks."}
                  </p>

                </button>
              </div>
            </section>
          )}

          {store.step === 4 && (
            <section className="space-y-6">
              <h2 className="text-2xl font-bold text-slate-900">
                {isEs ? "4. Áreas de Corte y Lote de Esquina" : "4. Mowing Areas & Corner Lot"}
              </h2>

              <div>
                <Label className="text-sm font-semibold text-slate-700">
                  {isEs ? "¿Qué áreas desea cortar?" : "Lawn Areas to Mow"}
                </Label>
                <div className="mt-3 grid gap-3 sm:grid-cols-3">
                  {[
                    { key: "front_back", labelEs: "Frente y Trasero", labelEn: "Front & Back" },
                    { key: "front_only", labelEs: "Solo Frente", labelEn: "Front Only" },
                    { key: "back_only", labelEs: "Solo Trasero", labelEn: "Back Only" },
                  ].map((area) => (
                    <button
                      key={area.key}
                      type="button"
                      onClick={() => store.setLawnOptions({ areaSelection: area.key as any })}
                      className={`rounded-2xl border p-4 text-center transition ${
                        store.areaSelection === area.key
                          ? "border-green-400 bg-emerald-50 text-slate-900 font-bold"
                          : "border-slate-200 bg-slate-50 text-slate-600 hover:border-slate-200"
                      }`}
                    >
                      {isEs ? area.labelEs : area.labelEn}
                    </button>
                  ))}
                </div>
              </div>

              <div className="rounded-2xl border border-lime-200 bg-lime-50 p-5 space-y-3">
                <Label className="text-sm font-semibold text-slate-900">
                  {isEs ? "¿Es su propiedad un lote de esquina? (Is your property a corner lot?)" : "Is your property a corner lot?"}
                </Label>
                <div className="flex gap-4">
                  <button
                    type="button"
                    onClick={() => store.setLawnOptions({ isCornerLot: true })}
                    className={`flex-1 rounded-xl border p-3 font-bold transition ${
                      store.isCornerLot
                        ? "border-green-500 bg-white text-green-700"
                        : "border-slate-200 bg-slate-50 text-slate-600"
                    }`}
                  >
                    {isEs ? "Sí (Yes)" : "Yes"}
                  </button>
                  <button
                    type="button"
                    onClick={() => store.setLawnOptions({ isCornerLot: false })}
                    className={`flex-1 rounded-xl border p-3 font-bold transition ${
                      !store.isCornerLot
                        ? "border-green-500 bg-white text-green-700"
                        : "border-slate-200 bg-slate-50 text-slate-600"
                    }`}
                  >
                    {isEs ? "No (No)" : "No"}
                  </button>
                </div>
              </div>
            </section>
          )}

          {store.step === 5 && (
            <section className="space-y-5"><h2 className="text-2xl font-bold text-slate-900">{isEs ? "5. Mide el césped" : "5. Measure Your Lawn"}</h2><LawnMeasurement latitude={store.latitude} longitude={store.longitude} measurement={store.measurement} onChange={store.setMeasurement} onClear={store.clearMeasurement} isEs={isEs} /><FieldError>{errors.measurement}</FieldError></section>
          )}

          {store.step === 6 && (
            <section className="space-y-6">
              <h2 className="text-2xl font-bold text-slate-900 flex items-center justify-between">
                <span>{isEs ? "6. Calendario de Servicio" : "6. Service Calendar"}</span>

              </h2>

              <MowingCalendar selected={store.requestedDate} isEs={isEs} onSelect={store.setSchedule} price={price} />
              <div>
                <Label htmlFor="service-date">{isEs ? "Fecha preferida *" : "Preferred Date *"}</Label>
                <Input
                  id="service-date"
                  type="date"
                  min={todayISO()}
                  value={store.requestedDate ?? ""}
                  onChange={(event) => {
                    const value = event.target.value;
                    if (value && new Date(`${value}T12:00:00`).getDay() !== 0) store.setSchedule(value, store.requestedTimeWindow ?? "");
                  }}
                  className="mt-2 text-lg font-bold"
                />
                <FieldError>{errors.requestedDate}</FieldError>
              </div>

              <div>
                <Label>{isEs ? "Horario preferido" : "Preferred Time Window"}</Label>
                <Select
                  value={store.requestedTimeWindow ?? "08:00 - 18:00"}
                  onChange={(event) => store.setSchedule(store.requestedDate ?? todayISO(), event.target.value)}
                  className="mt-2"
                >
                  <option value="08:00 - 18:00">{isEs ? "Flexible (Todo el día)" : "Flexible (All Day)"}</option>
                  {TIME_WINDOWS.map((time) => (
                    <option key={time} value={time}>
                      {time}
                    </option>
                  ))}
                </Select>
              </div>

              <p className="rounded-xl bg-green-50 p-4 text-sm text-green-800">
                {price !== null ? (isEs ? `$${price.toFixed(2)} por corte + impuestos aplicables` : `$${price.toFixed(2)} per cut + applicable tax`) : (isEs ? "El dueño aún debe configurar la tarifa para esta medida." : "The owner must configure the rate for this lawn size.")}
              </p>
            </section>
          )}

          {store.step === 7 && (
            <section className="space-y-6">
              <div className="grid items-start gap-5 border-b border-lime-200 pb-6 sm:grid-cols-[1fr_1.05fr]">
                <div>
                  <h2 className="text-3xl font-extrabold leading-tight text-emerald-950 sm:text-4xl">My Custom<br />Lawn Mowing<br />Plan</h2>
                  <p className="mt-4 rounded-xl bg-lime-100 p-3 text-sm font-semibold text-emerald-950">
                    {price !== null ? (isEs ? `$${price.toFixed(2)} por corte · ${store.mowFrequency === "weekly" ? "semanal" : "quincenal"} + impuestos aplicables` : `$${price.toFixed(2)} per cut · ${store.mowFrequency === "weekly" ? "weekly" : "bi-weekly"} + applicable tax`) : (isEs ? "No hay tarifa configurada para esta medida. El dueño debe establecerla en el panel." : "No rate configured for this area. The owner must set it in the admin panel.")}
                  </p>
                </div>
                <PropertySatellite address={store.address} latitude={store.latitude} longitude={store.longitude} isEs={isEs} compact polygon={store.measurement?.polygons ?? (store.measurement?.polygon ? [store.measurement.polygon] : [])} />
              </div>

              <p className="font-bold text-emerald-900">{isEs ? "Área de césped" : "Lawn square footage"}: {Math.round(store.measurement?.areaSqFt ?? 0).toLocaleString()} sq ft</p>
              <div className="grid gap-4 border-b border-lime-200 pb-6 text-sm sm:grid-cols-3">
                <div><p className="text-xs font-extrabold uppercase tracking-wider text-emerald-950">Address</p><p className="mt-1 text-slate-800">{store.address}</p></div>
                <div><p className="text-xs font-extrabold uppercase tracking-wider text-emerald-950">{isEs ? "Fecha preferida" : "Preferred date"}</p><p className="mt-1 text-slate-800">{store.requestedDate ? new Date(`${store.requestedDate}T12:00:00`).toLocaleDateString(isEs ? "es-MX" : "en-US", { dateStyle: "long" }) : "—"}</p></div>
                <div><p className="text-xs font-extrabold uppercase tracking-wider text-emerald-950">{isEs ? "Servicio" : "Service"}</p><p className="mt-1 text-slate-800">{store.serviceFrequency === "ongoing" ? (isEs ? "Continuo" : "Ongoing") : (isEs ? "Una vez" : "One-time")}</p></div>
              </div>
              <div className="grid gap-4 border-b border-lime-200 pb-6 text-sm sm:grid-cols-3">
                <div><p className="text-xs font-extrabold uppercase tracking-wider text-emerald-950">{isEs ? "Frecuencia de corte" : "Mow frequency"}</p><p className="mt-1 text-slate-800">{store.mowFrequency === "weekly" ? "Weekly" : "Bi-Weekly"}</p></div>
                <div><p className="text-xs font-extrabold uppercase tracking-wider text-emerald-950">{isEs ? "Área de corte" : "Mow area"}</p><p className="mt-1 text-slate-800">{store.areaSelection === "front_back" ? "Front & Back" : store.areaSelection === "front_only" ? "Front Only" : "Back Only"}</p></div>
                <div><p className="text-xs font-extrabold uppercase tracking-wider text-emerald-950">{isEs ? "Lote de esquina" : "Corner lot"}</p><p className="mt-1 text-slate-800">{store.isCornerLot ? (isEs ? "Sí" : "Yes") : "No"}</p></div>
              </div>

              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-5 space-y-3">
                <h3 className="text-sm font-bold text-green-700 uppercase tracking-wider">
                  {isEs ? "Servicios Incluidos:" : "Services Included:"}
                </h3>
                <div className="grid gap-2 sm:grid-cols-2 text-xs font-semibold text-slate-900">
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="size-4 text-emerald-400 shrink-0" />
                    <span>Mow Lawn</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="size-4 text-emerald-400 shrink-0" />
                    <span>Line Trim</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="size-4 text-emerald-400 shrink-0" />
                    <span>Edge</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="size-4 text-emerald-400 shrink-0" />
                    <span>Blow Debris</span>
                  </div>
                </div>
              </div>
            </section>
          )}

          {store.step === 8 && (
            <section className="space-y-6">
              <h2 className="text-2xl font-bold text-slate-900">
                {isEs ? "8. Datos de Cuenta y Detalles del Patio" : "8. Account & Yard Details"}
              </h2>

              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <Label htmlFor="first-name">{isEs ? "Nombre (First Name) *" : "First Name *"}</Label>
                  <Input
                    id="first-name"
                    value={store.firstName ?? ""}
                    onChange={(e) => store.setAccountDetails({ firstName: e.target.value })}
                    className="mt-1"
                  />
                  <FieldError>{errors.firstName}</FieldError>
                </div>

                <div>
                  <Label htmlFor="last-name">{isEs ? "Apellido (Last Name) *" : "Last Name *"}</Label>
                  <Input
                    id="last-name"
                    value={store.lastName ?? ""}
                    onChange={(e) => store.setAccountDetails({ lastName: e.target.value })}
                    className="mt-1"
                  />
                  <FieldError>{errors.lastName}</FieldError>
                </div>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <Label htmlFor="cust-email">{isEs ? "Correo electrónico *" : "Email *"}</Label>
                  <Input
                    id="cust-email"
                    type="email"
                    value={store.customerEmail ?? ""}
                    onChange={(e) => store.setAccountDetails({ customerEmail: e.target.value })}
                    className="mt-1"
                  />
                  <FieldError>{errors.customerEmail}</FieldError>
                </div>

                <div>
                  <Label htmlFor="cust-phone">{isEs ? "Teléfono *" : "Phone *"}</Label>
                  <Input
                    id="cust-phone"
                    type="tel"
                    value={store.customerPhone ?? ""}
                    onChange={(e) => store.setAccountDetails({ customerPhone: e.target.value })}
                    className="mt-1"
                  />
                  <FieldError>{errors.customerPhone}</FieldError>
                </div>
              </div>

              <div className="space-y-3 rounded-2xl border border-slate-200 bg-slate-50 p-5">
                <h3 className="text-sm font-bold text-slate-900 mb-2">
                  {isEs ? "Detalles del Patio / Acceso:" : "Yard & Access Details:"}
                </h3>

                <label className="flex items-center gap-3 text-xs text-slate-700 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={store.isCellphone ?? true}
                    onChange={(e) => store.setAccountDetails({ isCellphone: e.target.checked })}
                    className="size-4 rounded accent-emerald-500"
                  />
                  <span>Is this a Cellphone?</span>
                </label>

                <label className="flex items-center gap-3 text-xs text-slate-700 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={store.isGrassOver6 ?? false}
                    onChange={(e) => store.setAccountDetails({ isGrassOver6: e.target.checked })}
                    className="size-4 rounded accent-emerald-500"
                  />
                  <span>Grass height &gt; 6&quot;?</span>
                </label>

                <label className="flex items-center gap-3 text-xs text-slate-700 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={store.hasCommunityGate ?? false}
                    onChange={(e) => store.setAccountDetails({ hasCommunityGate: e.target.checked })}
                    className="size-4 rounded accent-emerald-500"
                  />
                  <span>Community gate?</span>
                </label>

                <label className="flex items-center gap-3 text-xs text-slate-700 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={store.hasBackyardGate ?? false}
                    onChange={(e) => store.setAccountDetails({ hasBackyardGate: e.target.checked })}
                    className="size-4 rounded accent-emerald-500"
                  />
                  <span>Backyard gate?</span>
                </label>

                <label className="flex items-center gap-3 text-xs text-slate-700 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={store.hasPetsInBackyard ?? false}
                    onChange={(e) => store.setAccountDetails({ hasPetsInBackyard: e.target.checked })}
                    className="size-4 rounded accent-emerald-500"
                  />
                  <span>Pets in backyard?</span>
                </label>

                <label className="flex items-center gap-3 text-sm text-slate-900 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={store.hasGateCode}
                    onChange={(event) => store.setGate(event.target.checked)}
                    className="size-4 accent-emerald-600"
                  />
                  <span>{isEs ? "¿La puerta o portón tiene candado con código?" : "Does a gate have a coded lock?"}</span>
                </label>
                {store.hasGateCode && (
                  <div>
                    <Label htmlFor="gate-code">{isEs ? "Código de acceso *" : "Gate access code *"}</Label>
                    <Input id="gate-code" value={store.gateCode} onChange={(event) => store.setGate(true, event.target.value)} className="mt-2" autoComplete="off" />
                    <FieldError>{errors.gateCode}</FieldError>
                  </div>
                )}
              </div>
              <div className="rounded-2xl border border-emerald-300 bg-emerald-50 p-5 space-y-3"><h3 className="font-bold text-emerald-950">{isEs ? "Forma de pago" : "Payment method"}</h3><p className="text-sm text-slate-800">{isEs ? "Preferimos el pago después de cada corte. Máximo dos cortes pendientes de pago." : "Payment after each cut is preferred. No more than two cuts may remain unpaid."}</p><div className="grid gap-2 sm:grid-cols-4">{(["cash", "cash_app", "venmo", "zelle"] as const).map((method) => <button type="button" key={method} aria-pressed={store.paymentMethod === method} onClick={() => store.setPaymentMethod(method)} className={`rounded-lg border px-3 py-3 font-semibold ${store.paymentMethod === method ? "border-emerald-600 bg-emerald-600 text-white" : "border-slate-300 bg-white text-slate-900"}`}>{method === "cash" ? "Cash" : method === "cash_app" ? "Cash App" : method === "venmo" ? "Venmo" : "Zelle"}</button>)}</div>{store.paymentMethod === "cash" && <div><Label htmlFor="cash-location">{isEs ? "¿Dónde dejará el efectivo después de cada corte? *" : "Where will you leave cash after each cut? *"}</Label><Input id="cash-location" value={store.cashLocation} onChange={(event) => store.setPersonal({cashLocation:event.target.value})} className="mt-2" /><FieldError>{errors.cashLocation}</FieldError></div>}{store.paymentMethod === "cash_app" && <p>Cash App: {BUSINESS.cashAppTag}</p>}{store.paymentMethod === "venmo" && <p>Venmo: {BUSINESS.venmoHandle}</p>}{store.paymentMethod === "zelle" && <p>Zelle: {BUSINESS.zellePhone}</p>}</div>
              <div>
                <Label htmlFor="special-notes">{isEs ? "Notas o indicaciones especiales" : "Special requests or notes"}</Label>
                <Textarea id="special-notes" value={store.additionalNotes} onChange={(event) => store.setPersonal({ additionalNotes: event.target.value })} maxLength={2000} placeholder={isEs ? "Cuéntanos si hay algo especial sobre tu patio o el acceso." : "Tell us anything special about your lawn or access."} className="mt-2" />
              </div>
            </section>
          )}

          <div className="flex justify-between gap-3 border-t border-slate-200 pt-6">
            {store.step > 1 ? (
              <Button variant="outline" onClick={store.goBack}>
                {isEs ? "Anterior" : "Back"}
              </Button>
            ) : (
              <span />
            )}

            {store.step < TOTAL_STEPS ? (
              <Button onClick={next} className="font-bold bg-green-500 hover:bg-green-600">
                {isEs ? "Continuar" : "Next Step"}
              </Button>
            ) : (
              <Button onClick={submit} disabled={sending} className="font-bold bg-green-500 hover:bg-green-600">
                <Send className="mr-2 size-4" />
                {sending
                  ? isEs
                    ? "Guardando..."
                    : "Saving..."
                  : isEs
                    ? "CONFIRMAR Y ENVIAR SMS"
                    : "CONFIRM & SEND SMS"}
              </Button>
            )}
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

function Confirmation({
  isEs,
  address,
  onReset,
  price,
  paymentMethod,
  cashLocation,
}: {
  isEs: boolean;
  price: number | null;
  paymentMethod: string;
  cashLocation: string;
  address: string;
  onReset: () => void;
}) {
  return (
    <div className="flex min-h-[60vh] max-w-2xl items-center mx-auto py-12">
      <Card className="w-full text-center space-y-6 p-8 border-slate-200">
        <ShieldCheck className="mx-auto size-16 text-green-600" />
        <h1 className="text-3xl font-extrabold text-slate-900">
          {isEs ? "¡Solicitud Enviada!" : "Request Submitted!"}
        </h1>
        <p className="text-slate-600 text-sm">
          {isEs
            ? "Tu solicitud se ha guardado correctamente. Si tu app de SMS no se abrió de forma automática, puedes hacer clic abajo para contactar al propietario."
            : "Your request has been saved. If your SMS app did not open automatically, click below to text the owner."}
        </p>

        <div className="rounded-2xl border border-emerald-100 bg-emerald-50 p-4"><p className="text-xl font-bold text-emerald-900">{price !== null ? `$${price.toFixed(2)} / ${isEs ? "corte" : "cut"} + ${isEs ? "impuestos aplicables" : "applicable tax"}` : ""}</p>
          <p className="font-semibold text-slate-900 text-sm">{address}</p>
        </div>

        <div className="rounded-xl bg-lime-50 p-4 text-left text-sm text-slate-800"><p className="font-bold text-emerald-950">{isEs ? "Pago elegido" : "Selected payment"}: {paymentMethod === "cash_app" ? "Cash App" : paymentMethod === "venmo" ? "Venmo" : paymentMethod === "zelle" ? "Zelle" : "Cash"}</p>{paymentMethod === "cash" && <p>{isEs ? "Efectivo en" : "Leave cash at"}: {cashLocation}</p>}{paymentMethod === "cash_app" && <a className="text-emerald-700 underline" href={BUSINESS.cashAppUrl} target="_blank" rel="noreferrer">{BUSINESS.cashAppTag}</a>}{paymentMethod === "venmo" && <a className="text-emerald-700 underline" href={BUSINESS.venmoUrl} target="_blank" rel="noreferrer">{BUSINESS.venmoHandle}</a>}{paymentMethod === "zelle" && <p>{BUSINESS.zellePhone}</p>}<p className="mt-2">{isEs ? "Preferimos el pago después de cada corte; máximo dos cortes sin pagar." : "Payment after every cut is preferred; at most two cuts may remain unpaid."}</p></div>
        <div className="flex flex-wrap justify-center gap-3">
          <Button asChild className="bg-green-500 hover:bg-green-600">
            <a href={buildOwnerSmsHref(address)}>
              <MessageSquare className="mr-2 size-4" />
              {isEs ? "Enviar SMS al Dueño (+17373144215)" : "Text Owner (+17373144215)"}
            </a>
          </Button>

          <Button onClick={onReset} variant="outline">
            {isEs ? "Nueva cotización" : "New quote"}
          </Button>
        </div>
      </Card>
    </div>
  );
}
