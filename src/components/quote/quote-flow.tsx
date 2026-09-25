// NOTE: Refactoring to Light Mode (bg-white, emerald accents)

"use client";

import * as React from "react";
import Link from "next/link";
import {
  ArrowLeft,
  Check,
  CheckCircle2,
  MapPin,
  MessageSquare,
  Send,
  ShieldCheck,
} from "lucide-react";

import { useLanguage } from "@/components/providers/language-provider";
import { useToast } from "@/components/providers/toast-provider";
import { Step1Address, Step1AddressHint } from "@/components/quote/step-1-address";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, LuxuryCard } from "@/components/ui/card";
import { Select } from "@/components/ui/controls";
import { FieldError, Input, Label } from "@/components/ui/input";
import { buildOwnerSmsHref, GOOGLE_MAPS_API_KEY, TIME_WINDOWS, ZIP_CITY_MAP } from "@/lib/constants";
import { todayISO } from "@/lib/utils";
import {
  formatZodErrors,
  step1Schema,
  step2Schema,
  step3Schema,
  step4Schema,
  step5Schema,
  step7Schema,
} from "@/lib/validation";
import { calculateLawnQuote, pickSubmissionFields, TOTAL_STEPS, useQuoteStore } from "@/store/quote-store";

export function QuoteFlow() {
  const { isEs } = useLanguage();
  const { toast } = useToast();
  const store = useQuoteStore();
  const [hydrated, setHydrated] = React.useState(false);
  const [errors, setErrors] = React.useState<Record<string, string>>({});
  const [sending, setSending] = React.useState(false);

  React.useEffect(() => {
    try {
      if (useQuoteStore.persist?.rehydrate) {
        const res = useQuoteStore.persist.rehydrate();
        if (res && typeof (res as Promise<void>).then === "function") {
          void (res as Promise<void>).then(() => setHydrated(true)).catch(() => setHydrated(true));
        } else {
          setHydrated(true);
        }
      } else {
        setHydrated(true);
      }
    } catch {
      setHydrated(true);
    }
  }, []);

  const lawnQuote = calculateLawnQuote(store);

  const next = () => {
    let result: { success: boolean; error?: any } = { success: true };
    if (store.step === 1) result = step1Schema.safeParse(store);
    else if (store.step === 2) result = step2Schema.safeParse(store);
    else if (store.step === 3) result = step3Schema.safeParse(store);
    else if (store.step === 4) result = step4Schema.safeParse(store);
    else if (store.step === 5) result = step5Schema.safeParse(store);
    else if (store.step === 6) result = { success: true };
    else if (store.step === 7) result = step7Schema.safeParse(store);

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
        body: JSON.stringify({ ...pickSubmissionFields(store), referenceCode, snapshotUrl: null }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok || !payload.ok) {
        throw new Error(payload.error ?? (isEs ? "No se pudo enviar la solicitud." : "Failed to send request."));
      }

      const smsBody = [
        `Nieto Green Care LLC - Cotización de Yarda`,
        `Folio: ${referenceCode}`,
        `Dirección: ${store.address}`,
        `Plan: ${lawnQuote.rateText}`,
        `Servicio: ${store.serviceFrequency === "ongoing" ? "Ongoing" : "One-time"}`,
        `Frecuencia: ${store.mowFrequency === "weekly" ? "Weekly" : "Bi-Weekly"}`,
        `Área: ${store.areaSelection === "front_back" ? "Front & Back" : store.areaSelection === "front_only" ? "Front Only" : "Back Only"}`,
        `Lote esquina: ${store.isCornerLot ? "Sí" : "No"}`,
        `Fecha preferida: ${store.requestedDate}`,
        `Cliente: ${store.firstName} ${store.lastName}`,
        `Tel: ${store.customerPhone}`,
        `Email: ${store.customerEmail}`,
      ].join("\n");

      const smsUrl = buildOwnerSmsHref(store.address, smsBody);
      window.location.href = smsUrl;

      store.markSubmitted();
    } catch (error) {
      toast({ title: error instanceof Error ? error.message : "Error al enviar", variant: "error" });
    } finally {
      setSending(false);
    }
  };

  if (!hydrated) {
    return <div className="py-24 text-center text-ink-300">Cargando cotizador…</div>;
  }

  if (store.submitted) {
    return <Confirmation isEs={isEs} address={store.address} rateText={lawnQuote.rateText} onReset={store.reset} />;
  }

  const staticMapUrl =
    store.latitude && store.longitude && GOOGLE_MAPS_API_KEY
      ? `https://maps.googleapis.com/maps/api/staticmap?center=${store.latitude},${store.longitude}&zoom=19&size=600x320&scale=2&maptype=satellite&markers=color:0x10B981|${store.latitude},${store.longitude}&key=${GOOGLE_MAPS_API_KEY}`
      : GOOGLE_MAPS_API_KEY
        ? `https://maps.googleapis.com/maps/api/staticmap?center=${encodeURIComponent(store.address || "Austin, TX")}&zoom=19&size=600x320&scale=2&maptype=satellite&key=${GOOGLE_MAPS_API_KEY}`
        : null;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <Link
          href="/"
          className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-widest text-gold-400 hover:text-gold-300"
        >
          <ArrowLeft className="size-4" />
          {isEs ? "Volver al inicio" : "Back to Home"}
        </Link>
        <Badge className="border-gold-500/30 bg-gold-500/10 text-gold-300">
          {isEs ? `Paso ${store.step} de ${TOTAL_STEPS}` : `Step ${store.step} of ${TOTAL_STEPS}`}
        </Badge>
      </div>

      <Card className="border-gold-500/20 bg-ink-950/90 shadow-luxury">
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-2xl font-bold text-white">
              {isEs ? "Cotización Instantánea de Yarda" : "Instant Lawn Quote"}
            </CardTitle>
            <span className="text-sm font-bold text-emerald-400 bg-emerald-950/60 border border-emerald-500/30 px-3 py-1 rounded-full">
              {lawnQuote.perCutText}
            </span>
          </div>

          <div className="mt-4 grid grid-cols-7 gap-1">
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
                    ? "bg-gold-400"
                    : s < store.step
                      ? "bg-emerald-500 cursor-pointer"
                      : "bg-white/10"
                }`}
                title={`Paso ${s}`}
              />
            ))}
          </div>
        </CardHeader>

        <CardContent className="space-y-8">
          {store.step === 1 && (
            <section className="space-y-5">
              <h2 className="text-2xl font-bold text-white">
                {isEs ? "1. Dirección y Código Postal" : "1. Address & ZIP Code"}
              </h2>
              <div>
                <Step1Address error={errors.address} isEs={isEs} />
                <Step1AddressHint isEs={isEs} />
                <FieldError>{errors.address}</FieldError>
              </div>
              <div>
                <Label htmlFor="quote-zip">{isEs ? "Código postal *" : "ZIP Code *"}</Label>
                <Input
                  id="quote-zip"
                  value={store.zipCode ?? ""}
                  maxLength={5}
                  onChange={(event) => {
                    const zipCode = event.target.value.replace(/\D/g, "").slice(0, 5);
                    store.setAddress({ zipCode, city: ZIP_CITY_MAP[zipCode] ?? store.city ?? "" });
                  }}
                  placeholder="78701"
                  className="mt-2"
                />
                <FieldError>{errors.zipCode}</FieldError>
              </div>
            </section>
          )}

          {store.step === 2 && (
            <section className="space-y-6">
              <h2 className="text-2xl font-bold text-white">
                {isEs ? "2. Frecuencia de Servicio y Ocupación" : "2. Service Frequency & Occupancy"}
              </h2>

              <div>
                <Label className="text-sm font-semibold text-ink-200">
                  {isEs ? "¿Tipo de servicio?" : "Service Type"}
                </Label>
                <div className="mt-3 grid gap-3 sm:grid-cols-2">
                  <button
                    type="button"
                    onClick={() => store.setLawnOptions({ serviceFrequency: "ongoing" })}
                    className={`rounded-2xl border p-4 text-left transition ${
                      store.serviceFrequency === "ongoing"
                        ? "border-emerald-400 bg-emerald-950/40 text-white shadow-lg"
                        : "border-white/10 bg-black/40 text-ink-300 hover:border-white/20"
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
                        ? "border-emerald-400 bg-emerald-950/40 text-white shadow-lg"
                        : "border-white/10 bg-black/40 text-ink-300 hover:border-white/20"
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
                <Label className="text-sm font-semibold text-ink-200">
                  {isEs ? "Estado de la propiedad" : "Property Status"}
                </Label>
                <div className="mt-3 grid gap-3 sm:grid-cols-2">
                  <button
                    type="button"
                    onClick={() => store.setLawnOptions({ propertyOccupancy: "occupied" })}
                    className={`rounded-2xl border p-4 text-left transition ${
                      store.propertyOccupancy === "occupied"
                        ? "border-gold-400 bg-gold-500/10 text-white shadow-lg"
                        : "border-white/10 bg-black/40 text-ink-300 hover:border-white/20"
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-base">{isEs ? "Ocupada (Occupied)" : "Occupied"}</span>
                      {store.propertyOccupancy === "occupied" && <Check className="size-5 text-gold-300" />}
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() => store.setLawnOptions({ propertyOccupancy: "vacant" })}
                    className={`rounded-2xl border p-4 text-left transition ${
                      store.propertyOccupancy === "vacant"
                        ? "border-gold-400 bg-gold-500/10 text-white shadow-lg"
                        : "border-white/10 bg-black/40 text-ink-300 hover:border-white/20"
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-base">{isEs ? "Desocupada (Vacant)" : "Vacant"}</span>
                      {store.propertyOccupancy === "vacant" && <Check className="size-5 text-gold-300" />}
                    </div>
                  </button>
                </div>
              </div>
            </section>
          )}
          {store.step === 3 && (
            <section className="space-y-5">
              <h2 className="text-2xl font-bold text-white">
                {isEs ? "3. Frecuencia de Corte" : "3. Mowing Frequency"}
              </h2>

              <div className="grid gap-4 sm:grid-cols-2">
                <button
                  type="button"
                  onClick={() => store.setLawnOptions({ mowFrequency: "weekly" })}
                  className={`rounded-2xl border p-5 text-left transition ${
                    store.mowFrequency === "weekly"
                      ? "border-emerald-400 bg-emerald-950/40 text-white shadow-luxury"
                      : "border-white/10 bg-black/40 text-ink-300 hover:border-white/20"
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xl font-bold text-white">
                      {isEs ? "Semanal (Weekly)" : "Weekly"}
                    </span>
                    {store.mowFrequency === "weekly" && <Check className="size-6 text-emerald-400" />}
                  </div>
                  <p className="mt-2 text-xs text-ink-200">
                    {isEs ? "Recomendado para primavera/verano." : "Recommended for peak growing season."}
                  </p>
                  <p className="mt-4 font-bold text-gold-300 text-lg">
                    {store.areaSelection === "front_back" ? "$38 / corte" : "$30 / corte"}
                  </p>
                </button>

                <button
                  type="button"
                  onClick={() => store.setLawnOptions({ mowFrequency: "bi_weekly" })}
                  className={`rounded-2xl border p-5 text-left transition ${
                    store.mowFrequency === "bi_weekly"
                      ? "border-emerald-400 bg-emerald-950/40 text-white shadow-luxury"
                      : "border-white/10 bg-black/40 text-ink-300 hover:border-white/20"
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xl font-bold text-white">
                      {isEs ? "Quincenal (Bi-Weekly)" : "Bi-Weekly"}
                    </span>
                    {store.mowFrequency === "bi_weekly" && <Check className="size-6 text-emerald-400" />}
                  </div>
                  <p className="mt-2 text-xs text-ink-200">
                    {isEs ? "Corte cada dos semanas." : "Serviced every two weeks."}
                  </p>
                  <p className="mt-4 font-bold text-gold-300 text-lg">
                    {store.areaSelection === "front_back" ? "$42 / corte" : "$34 / corte"}
                  </p>
                </button>
              </div>
            </section>
          )}

          {store.step === 4 && (
            <section className="space-y-6">
              <h2 className="text-2xl font-bold text-white">
                {isEs ? "4. Áreas de Corte y Lote de Esquina" : "4. Mowing Areas & Corner Lot"}
              </h2>

              <div>
                <Label className="text-sm font-semibold text-ink-200">
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
                          ? "border-gold-400 bg-gold-500/10 text-white font-bold"
                          : "border-white/10 bg-black/40 text-ink-300 hover:border-white/20"
                      }`}
                    >
                      {isEs ? area.labelEs : area.labelEn}
                    </button>
                  ))}
                </div>
              </div>

              <div className="rounded-2xl border border-white/10 bg-black/40 p-5 space-y-3">
                <Label className="text-sm font-semibold text-white">
                  {isEs ? "¿Es su propiedad un lote de esquina? (Is your property a corner lot?)" : "Is your property a corner lot?"}
                </Label>
                <div className="flex gap-4">
                  <button
                    type="button"
                    onClick={() => store.setLawnOptions({ isCornerLot: true })}
                    className={`flex-1 rounded-xl border p-3 font-bold transition ${
                      store.isCornerLot
                        ? "border-emerald-400 bg-emerald-950/60 text-emerald-300"
                        : "border-white/10 bg-black/30 text-ink-300"
                    }`}
                  >
                    {isEs ? "Sí (Yes)" : "Yes"}
                  </button>
                  <button
                    type="button"
                    onClick={() => store.setLawnOptions({ isCornerLot: false })}
                    className={`flex-1 rounded-xl border p-3 font-bold transition ${
                      !store.isCornerLot
                        ? "border-emerald-400 bg-emerald-950/60 text-emerald-300"
                        : "border-white/10 bg-black/30 text-ink-300"
                    }`}
                  >
                    {isEs ? "No (No)" : "No"}
                  </button>
                </div>
              </div>
            </section>

          {store.step === 5 && (
            <section className="space-y-6">
              <h2 className="text-2xl font-bold text-slate-900 flex items-center justify-between">
                <span>{isEs ? "5. Calendario de Servicio" : "5. Service Calendar"}</span>
                <span className="text-base font-extrabold text-emerald-700 bg-emerald-50 px-3 py-1 rounded-full">
                  {lawnQuote.perCutText}
                </span>
              </h2>

              <div>
                <Label htmlFor="service-date">{isEs ? "Fecha preferida *" : "Preferred Date *"}</Label>
                <Input
                  id="service-date"
                  type="date"
                  min={todayISO()}
                  value={store.requestedDate ?? todayISO()}
                  onChange={(event) => store.setSchedule(event.target.value, store.requestedTimeWindow ?? "")}
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

              <div className="rounded-2xl border border-emerald-500/30 bg-emerald-950/30 p-4 text-center">
                <p className="text-xs uppercase tracking-wider text-emerald-300 font-bold">
                  {isEs ? "Tarifa Fija de Corte en Días de Servicio" : "Fixed Rate On Mowing Days"}
                </p>
                <p className="mt-1 text-3xl font-extrabold text-gold-300">{lawnQuote.rateText}</p>
              </div>
            </section>
          )}

          {store.step === 6 && (
            <section className="space-y-6">
              <div className="flex items-center justify-between border-b border-white/10 pb-4">
                <div>
                  <h2 className="text-2xl font-bold text-white">My Custom Lawn Mowing Plan</h2>
                  <p className="text-xs text-emerald-400 font-semibold mt-1">
                    {isEs ? "Visualización inmediata del precio final · Sin revisión manual" : "Immediate final price display · No manual review"}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-3xl font-extrabold text-gold-300">{lawnQuote.rateText}</p>
                  <p className="text-[11px] text-ink-300">{isEs ? "Tarifa por corte" : "Rate per cut"}</p>
                </div>
              </div>

              <div className="relative overflow-hidden rounded-2xl border border-gold-500/30 bg-black aspect-video max-h-72">
                {staticMapUrl ? (
                  <img
                    src={staticMapUrl}
                    alt="Satellite property"
                    className="size-full object-cover"
                  />
                ) : (
                  <div className="flex size-full flex-col items-center justify-center p-6 text-center bg-gradient-to-br from-emerald-950/80 to-black">
                    <MapPin className="size-8 text-gold-400 mb-2" />
                    <p className="text-sm font-bold text-white">{store.address || "Austin, TX"}</p>
                    <p className="text-xs text-ink-300 mt-1">{isEs ? "Ubicación Confirmada" : "Property Location Verified"}</p>
                  </div>
                )}
                <div className="absolute bottom-3 left-3 bg-black/80 backdrop-blur border border-white/20 px-3 py-1 rounded-lg text-xs font-bold text-white">
                  📍 {store.address}
                </div>
              </div>

              <div className="rounded-2xl border border-white/10 bg-black/40 p-5 space-y-3">
                <h3 className="text-sm font-bold text-gold-300 uppercase tracking-wider">
                  {isEs ? "Servicios Incluidos:" : "Services Included:"}
                </h3>
                <div className="grid gap-2 sm:grid-cols-2 text-xs font-semibold text-white">
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

          {store.step === 7 && (
            <section className="space-y-6">
              <h2 className="text-2xl font-bold text-white">
                {isEs ? "7. Datos de Cuenta y Detalles del Patio" : "7. Account & Yard Details"}
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
                  <Label htmlFor="cust-email">{isEs ? "Correo Electrónico" : "Email"}</Label>
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

              <div className="space-y-3 rounded-2xl border border-white/10 bg-black/40 p-5">
                <h3 className="text-sm font-bold text-white mb-2">
                  {isEs ? "Detalles del Patio / Acceso:" : "Yard & Access Details:"}
                </h3>

                <label className="flex items-center gap-3 text-xs text-ink-200 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={store.isCellphone ?? true}
                    onChange={(e) => store.setAccountDetails({ isCellphone: e.target.checked })}
                    className="size-4 rounded accent-emerald-500"
                  />
                  <span>Is this a Cellphone?</span>
                </label>

                <label className="flex items-center gap-3 text-xs text-ink-200 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={store.isGrassOver6 ?? false}
                    onChange={(e) => store.setAccountDetails({ isGrassOver6: e.target.checked })}
                    className="size-4 rounded accent-emerald-500"
                  />
                  <span>Grass height &gt; 6&quot;?</span>
                </label>

                <label className="flex items-center gap-3 text-xs text-ink-200 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={store.hasCommunityGate ?? false}
                    onChange={(e) => store.setAccountDetails({ hasCommunityGate: e.target.checked })}
                    className="size-4 rounded accent-emerald-500"
                  />
                  <span>Community gate?</span>
                </label>

                <label className="flex items-center gap-3 text-xs text-ink-200 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={store.hasBackyardGate ?? false}
                    onChange={(e) => store.setAccountDetails({ hasBackyardGate: e.target.checked })}
                    className="size-4 rounded accent-emerald-500"
                  />
                  <span>Backyard gate?</span>
                </label>

                <label className="flex items-center gap-3 text-xs text-ink-200 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={store.hasPetsInBackyard ?? false}
                    onChange={(e) => store.setAccountDetails({ hasPetsInBackyard: e.target.checked })}
                    className="size-4 rounded accent-emerald-500"
                  />
                  <span>Pets in backyard?</span>
                </label>
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
              <Button onClick={next} className="font-bold bg-emerald-600 hover:bg-emerald-700">
                {isEs ? "Continuar" : "Next Step"}
              </Button>
            ) : (
              <Button onClick={submit} disabled={sending} className="font-bold bg-emerald-600 hover:bg-emerald-700">
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

function Confirmation({
  isEs,
  address,
  rateText,
  onReset,
}: {
  isEs: boolean;
  address: string;
  rateText: string;
  onReset: () => void;
}) {
  return (
    <div className="flex min-h-[60vh] max-w-2xl items-center mx-auto py-12">
      <Card className="w-full text-center space-y-6 p-8 border-slate-200">
        <ShieldCheck className="mx-auto size-16 text-emerald-600" />
        <h1 className="text-3xl font-extrabold text-slate-900">
          {isEs ? "¡Solicitud Enviada!" : "Request Submitted!"}
        </h1>
        <p className="text-slate-600 text-sm">
          {isEs
            ? "Tu solicitud se ha guardado correctamente. Si tu app de SMS no se abrió de forma automática, puedes hacer clic abajo para contactar al propietario."
            : "Your request has been saved. If your SMS app did not open automatically, click below to text the owner."}
        </p>

        <div className="rounded-2xl border border-emerald-100 bg-emerald-50 p-4">
          <p className="font-semibold text-slate-900 text-sm">{address}</p>
          <p className="text-base font-bold text-emerald-700 mt-1">{rateText}</p>
        </div>

        <div className="flex flex-wrap justify-center gap-3">
          <Button asChild className="bg-emerald-600 hover:bg-emerald-700">
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