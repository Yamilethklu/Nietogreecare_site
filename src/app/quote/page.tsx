"use client";

import * as React from "react";
import Link from "next/link";
import {
  ArrowLeft,
  CalendarDays,
  Check,
  MessageSquare,
  Ruler,
  Send,
  ShieldCheck,
} from "lucide-react";

import { useLanguage } from "@/components/providers/language-provider";
import { useToast } from "@/components/providers/toast-provider";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, LuxuryCard } from "@/components/ui/card";
import { Progress, Select } from "@/components/ui/controls";
import { FieldError, Input, Label, Textarea } from "@/components/ui/input";
import { Step1Address, Step1AddressHint } from "@/components/quote/step-1-address";
import {
  buildOwnerSmsHref,
  BUSINESS,
  PAYMENT_METHODS,
  SERVICES,
  TIME_WINDOWS,
  ZIP_CITY_MAP,
} from "@/lib/constants";
import { AUSTIN_CENTER, loadGoogleMaps } from "@/lib/google-maps";
import { formatNumber, todayISO } from "@/lib/utils";
import { step1Schema, step2Schema, step35Schema, step3Schema } from "@/lib/validation";
import { buildMeasurement, pickSubmissionFields, TOTAL_STEPS, useQuoteStore } from "@/store/quote-store";
import type { PolygonPoint } from "@/lib/types";

const AREA_OPTIONS = [
  {
    key: "small",
    labelEn: "Small",
    labelEs: "Pequeño",
    rangeEn: "Up to 2,500 sq ft",
    rangeEs: "Hasta 2,500 pies cuadrados",
    areaSqFt: 1250,
  },
  {
    key: "medium",
    labelEn: "Medium",
    labelEs: "Mediano",
    rangeEn: "2,500 - 5,000 sq ft",
    rangeEs: "2,500 - 5,000 pies cuadrados",
    areaSqFt: 3750,
  },
  {
    key: "large",
    labelEn: "Large",
    labelEs: "Grande",
    rangeEn: "5,000 - 10,000 sq ft",
    rangeEs: "5,000 - 10,000 pies cuadrados",
    areaSqFt: 7500,
  },
  {
    key: "extra-large",
    labelEn: "XL",
    labelEs: "XL",
    rangeEn: "10,000+ sq ft",
    rangeEs: "10,000+ pies cuadrados",
    areaSqFt: 12500,
  },
] as const;

type MapSelection = {
  latitude: number;
  longitude: number;
  areaSqM: number;
  coordinates: PolygonPoint[];
};

const CONFIRMATION_ES =
  "Muchas gracias por requerir nuestros servicios. Su solicitud ha sido enviada con éxito. Nieto Green Care LLC revisará la información y se pondrá en contacto con usted a la brevedad para confirmar la tarifa final y la fecha del trabajo.";

export default function QuotePage() {
  const { isEs } = useLanguage();
  const { toast } = useToast();
  const store = useQuoteStore();

  const [hydrated, setHydrated] = React.useState(false);
  const [mapsReady, setMapsReady] = React.useState(false);
  const [errors, setErrors] = React.useState<Record<string, string>>({});
  const [sending, setSending] = React.useState(false);
  const [selectedArea, setSelectedArea] = React.useState("medium");
  const [selection, setSelection] = React.useState<MapSelection | null>(null);
  const [squareFeet, setSquareFeet] = React.useState(0);
  const mapNode = React.useRef<HTMLDivElement>(null);
  const mapRef = React.useRef<any>(null);

  React.useEffect(() => {
    useQuoteStore.persist.rehydrate();
    setHydrated(true);
    void loadGoogleMaps().then(setMapsReady).catch(() => setMapsReady(false));
  }, []);

  React.useEffect(() => {
    if (store.step !== 2 || !mapsReady || !mapNode.current || !window.google?.maps) return;

    const g = window.google.maps;
    const center = {
      lat: store.latitude ?? AUSTIN_CENTER.lat,
      lng: store.longitude ?? AUSTIN_CENTER.lng,
    };

    let map: any = null;
    let manager: any = null;
    let previousPolygon: any = null;
    let overlayListener: any = null;

    try {
      map = new g.Map(mapNode.current, {
        center,
        zoom: 19,
        mapTypeId: "hybrid",
        streetViewControl: false,
        fullscreenControl: false,
      });
      mapRef.current = map;

      const savePolygon = (polygon: any) => {
        try {
          if (!g.geometry?.spherical) return;

          const points = polygon
            .getPath()
            .getArray()
            .map((point: any) => ({ lat: point.lat(), lng: point.lng() })) as PolygonPoint[];

          if (points.length < 3) return;

          const areaSqM = g.geometry.spherical.computeArea(polygon.getPath());
          if (!Number.isFinite(areaSqM)) return;

          const areaInSqFt = Math.round(areaSqM * 10.7639);
          const polygonCenter = points.reduce(
            (total, point) => ({
              lat: total.lat + point.lat / points.length,
              lng: total.lng + point.lng / points.length,
            }),
            { lat: 0, lng: 0 },
          );

          setSelection({
            latitude: polygonCenter.lat,
            longitude: polygonCenter.lng,
            areaSqM,
            coordinates: points,
          });
          setSquareFeet(areaInSqFt);

          const state = useQuoteStore.getState();
          state.setMeasurement(
            buildMeasurement(
              points,
              areaInSqFt,
              state.measurement?.depthInches ?? 2,
              map.getZoom(),
            ),
          );
        } catch {
          return;
        }
      };

      const bindPolygon = (polygon: any) => {
        previousPolygon = polygon;
        savePolygon(polygon);
        ["set_at", "insert_at", "remove_at"].forEach((eventName) => {
          polygon.getPath().addListener(eventName, () => savePolygon(polygon));
        });
        polygon.addListener("dragend", () => savePolygon(polygon));
      };

      const savedPolygon = useQuoteStore.getState().measurement?.polygon;
      if (savedPolygon && savedPolygon.length >= 3) {
        bindPolygon(
          new g.Polygon({
            paths: savedPolygon,
            editable: true,
            draggable: true,
            map,
            strokeColor: "#f5c96b",
            fillColor: "#f5c96b",
            fillOpacity: 0.25,
          }),
        );
      }

      if (g.drawing && g.geometry?.spherical && g.ControlPosition) {
        manager = new g.drawing.DrawingManager({
          drawingMode: g.drawing.OverlayType.POLYGON,
          drawingControl: true,
          drawingControlOptions: {
            position: g.ControlPosition.TOP_CENTER,
            drawingModes: [g.drawing.OverlayType.POLYGON],
          },
          polygonOptions: {
            fillColor: "#f5c96b",
            fillOpacity: 0.25,
            strokeColor: "#f5c96b",
            strokeWeight: 2,
            editable: true,
            draggable: true,
          },
        });
        manager.setMap(map);

        overlayListener = g.event.addListener(manager, "overlaycomplete", (event: any) => {
          if (event.type === g.drawing.OverlayType.POLYGON) {
            if (previousPolygon) previousPolygon.setMap(null);
            manager.setDrawingMode(null);
            bindPolygon(event.overlay);
          }
        });
      }

      return () => {
        if (overlayListener) g.event.removeListener(overlayListener);
        if (previousPolygon) previousPolygon.setMap(null);
        if (manager) manager.setMap(null);
        mapRef.current = null;
      };
    } catch {
      mapRef.current = null;
      return () => undefined;
    }
  }, [mapsReady, store.step]);

  React.useEffect(() => {
    const map = mapRef.current;
    if (map && store.latitude !== null && store.longitude !== null) {
      map.setCenter({ lat: store.latitude, lng: store.longitude });
    }
  }, [store.latitude, store.longitude]);

  const chooseArea = (area: (typeof AREA_OPTIONS)[number]) => {
    setSelectedArea(area.key);
    setSquareFeet(area.areaSqFt);
    setSelection(null);
    store.setMeasurement(buildMeasurement([], area.areaSqFt));
    setErrors((current) => ({ ...current, measurement: "" }));
  };

  const clearArea = () => {
    setSelectedArea("medium");
    setSelection(null);
    setSquareFeet(0);
    store.clearMeasurement();
    setErrors((current) => ({ ...current, measurement: "" }));
  };

  const next = () => {
    const result =
      store.step === 1
        ? step1Schema.safeParse(store)
        : store.step === 2
          ? step2Schema.safeParse({ measurement: store.measurement })
          : store.step === 3
            ? step3Schema.safeParse(store)
            : store.step === 4
              ? step35Schema.safeParse(store)
              : { success: true };

    if (!result.success) {
      setErrors(
        Object.fromEntries(
          result.error.issues.map((issue) => [String(issue.path[0] ?? "form"), issue.message]),
        ),
      );
      toast({
        title: isEs ? "Revise la información" : "Review your information",
        variant: "error",
      });
      return;
    }

    setErrors({});
    store.goNext();
  };

  const submit = async () => {
    const referenceCode = store.ensureReferenceCode();
    setSending(true);
    try {
      const response = await fetch("/api/leads", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...pickSubmissionFields(store),
          referenceCode,
          snapshotUrl: null,
        }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok || !payload.ok) throw new Error(payload.error ?? "No se pudo enviar la solicitud.");
      store.markSubmitted();
    } catch (error) {
      toast({
        title: error instanceof Error ? error.message : "No se pudo enviar",
        variant: "error",
      });
    } finally {
      setSending(false);
    }
  };

  if (!hydrated) {
    return <main className="container py-24 text-center text-ink-300">Cargando cotizador…</main>;
  }

  if (store.submitted) {
    return <Confirmation isEs={isEs} address={store.address} onReset={store.reset} />;
  }

  const measurement = store.measurement;

  return (
    <main className="container max-w-5xl py-8 sm:py-12">
      <Link className="inline-flex items-center gap-2 text-sm text-ink-300 hover:text-gold-200" href="/">
        <ArrowLeft className="size-4" />
        {BUSINESS.name}
      </Link>

      <div className="mt-7 grid gap-7 lg:grid-cols-[minmax(0,1.7fr)_minmax(260px,0.7fr)]">
        <Card>
          <CardHeader>
            <p className="ngc-eyebrow">{isEs ? "Solicitud paso a paso" : "Step-by-step request"}</p>
            <CardTitle>{isEs ? "Solicite su servicio" : "Request your service"}</CardTitle>
            <Progress value={(store.step / TOTAL_STEPS) * 100} />
            <p className="text-xs text-ink-400">
              {isEs ? `Paso ${store.step} de ${TOTAL_STEPS}` : `Step ${store.step} of ${TOTAL_STEPS}`}
            </p>
          </CardHeader>

          <CardContent className="space-y-6">
            {store.step === 1 && (
              <section className="space-y-5">
                <h2 className="text-2xl text-white">{isEs ? "Dirección del servicio" : "Service address"}</h2>
                <div>
                  <Step1Address error={errors.address} isEs={isEs} />
                  <Step1AddressHint isEs={isEs} />
                  <FieldError>{errors.address}</FieldError>
                </div>
                <div>
                  <Label>{isEs ? "Código postal" : "ZIP code"}</Label>
                  <Input
                    value={store.zipCode}
                    maxLength={5}
                    onChange={(event) => {
                      const zipCode = event.target.value.replace(/\D/g, "").slice(0, 5);
                      store.setAddress({ zipCode, city: ZIP_CITY_MAP[zipCode] ?? store.city });
                    }}
                    placeholder="78701"
                  />
                  <FieldError>{errors.zipCode}</FieldError>
                </div>
              </section>
            )}

            {store.step === 2 && (
              <section className="space-y-5">
                <h2 className="text-2xl text-white">
                  {isEs ? "Medición y tamaño del terreno" : "Property measurement and size"}
                </h2>

                <div className="mb-2 flex flex-wrap gap-2">
                  <Button type="button" variant="outline" onClick={() => mapRef.current?.setZoom(19)}>
                    {isEs ? "Dibujar área" : "Draw area"}
                  </Button>
                  <Button type="button" variant="outline" onClick={clearArea}>
                    {isEs ? "Borrar área" : "Clear area"}
                  </Button>
                </div>

                <div className="relative">
                  <div
                    ref={mapNode}
                    className="h-[420px] overflow-hidden rounded-2xl border border-gold-500/25 bg-ink-950"
                  />
                  <div className="pointer-events-none absolute left-3 top-3 rounded-xl border border-white/10 bg-ink-950/70 px-3 py-2 text-xs text-white/90">
                    {isEs ? "Dibuje el área del trabajo" : "Draw the work area"}
                  </div>
                </div>

                <div className="grid gap-3 sm:grid-cols-2">
                  {AREA_OPTIONS.map((area) => {
                    const selected = selectedArea === area.key;
                    return (
                      <button
                        key={area.key}
                        type="button"
                        aria-pressed={selected}
                        onClick={() => chooseArea(area)}
                        className={[
                          "rounded-2xl border p-4 text-left transition-all",
                          selected
                            ? "border-gold-400 bg-gold-500/10 shadow-[0_0_0_1px_rgba(245,201,107,0.2)]"
                            : "border-white/10 bg-ink-900/50 hover:border-gold-400/30",
                        ].join(" ")}
                      >
                        <div className="flex items-center justify-between gap-4">
                          <span className="text-lg font-semibold text-white">
                            {isEs ? area.labelEs : area.labelEn}
                          </span>
                          {selected && <Check className="size-5 text-gold-300" />}
                        </div>
                        <p className="mt-2 text-sm text-ink-300">
                          {isEs ? area.rangeEs : area.rangeEn}
                        </p>
                      </button>
                    );
                  })}
                </div>

                <div className="rounded-2xl border border-gold-500/25 bg-gold-500/5 p-4">
                  <p className="text-xs uppercase tracking-[0.18em] text-gold-200">
                    {isEs ? "Área seleccionada" : "Selected area"}
                  </p>
                  <p className="mt-2 text-2xl font-semibold text-white">
                    {formatNumber(squareFeet || measurement?.areaSqFt || 0)} sq ft
                  </p>
                  <p className="mt-1 text-sm text-ink-300">
                    {selection?.coordinates.length
                      ? isEs
                        ? "Área calculada automáticamente con polígono dibujado."
                        : "Area calculated automatically from the drawn polygon."
                      : isEs
                        ? "Puede dibujar el área o seleccionar un rango aproximado."
                        : "You can draw the area or choose an approximate range."}
                  </p>
                </div>

                <FieldError>{errors.measurement}</FieldError>
              </section>
            )}

            {store.step === 3 && (
              <section className="space-y-5">
                <h2 className="text-2xl text-white">{isEs ? "Servicios y fecha" : "Services and date"}</h2>
                <div className="grid gap-3 sm:grid-cols-2">
                  {SERVICES.map((service) => {
                    const selected = store.selectedServices.includes(service.key);
                    return (
                      <button
                        key={service.key}
                        type="button"
                        onClick={() => store.toggleService(service.key)}
                        className={[
                          "rounded-2xl border p-3 text-left transition-all",
                          selected
                            ? "border-black bg-black text-white"
                            : "border-white/10 bg-ink-900/50 text-ink-200 hover:border-gold-500/30",
                        ].join(" ")}
                      >
                        <div className="flex items-center justify-between gap-3">
                          <span className="font-medium">{isEs ? service.nameEs : service.nameEn}</span>
                          {selected && <Check className="size-5" />}
                        </div>
                      </button>
                    );
                  })}
                </div>

                <div>
                  <Label>{isEs ? "Fecha requerida" : "Requested date"}</Label>
                  <Input
                    type="date"
                    min={todayISO()}
                    value={store.requestedDate ?? ""}
                    onChange={(event) => store.setSchedule(event.target.value, store.requestedTimeWindow)}
                  />
                </div>

                <div>
                  <Label>{isEs ? "Horario preferido" : "Preferred time"}</Label>
                  <Select
                    value={store.requestedTimeWindow}
                    onChange={(event) =>
                      store.setSchedule(store.requestedDate ?? todayISO(), event.target.value)
                    }
                  >
                    <option value="">{isEs ? "Flexible" : "Flexible"}</option>
                    {TIME_WINDOWS.map((time) => (
                      <option key={time.key} value={time.key}>
                        {isEs ? time.labelEs : time.labelEn}
                      </option>
                    ))}
                  </Select>
                </div>
              </section>
            )}

            {store.step === 4 && (
              <section className="space-y-5">
                <h2 className="text-2xl text-white">{isEs ? "Datos de contacto" : "Contact details"}</h2>

                <div>
                  <Label>{isEs ? "Nombre" : "Name"}</Label>
                  <Input
                    value={store.customerName}
                    onChange={(event) => store.setPersonal({ customerName: event.target.value })}
                    placeholder={isEs ? "Ej. Carlos Nieto" : "e.g. Carlos Nieto"}
                  />
                  <FieldError>{errors.customerName}</FieldError>
                </div>

                <div>
                  <Label>{isEs ? "Teléfono" : "Phone"}</Label>
                  <Input
                    value={store.customerPhone}
                    onChange={(event) => store.setPersonal({ customerPhone: event.target.value })}
                    placeholder="(737) 000-0000"
                  />
                  <FieldError>{errors.customerPhone}</FieldError>
                </div>

                <div>
                  <Label>{isEs ? "Correo electrónico" : "Email"}</Label>
                  <Input
                    type="email"
                    value={store.customerEmail}
                    onChange={(event) => store.setPersonal({ customerEmail: event.target.value })}
                    placeholder="you@email.com"
                  />
                </div>

                <div>
                  <Label>{isEs ? "Detalles del trabajo" : "Work details"}</Label>
                  <Textarea
                    value={store.details}
                    onChange={(event) => store.setPersonal({ details: event.target.value })}
                    placeholder={isEs ? "Describa el trabajo y accesos" : "Describe access or work details"}
                  />
                </div>

                <div>
                  <Label>{isEs ? "Método de pago preferido" : "Preferred payment method"}</Label>
                  <div className="mt-2 grid gap-3 sm:grid-cols-3">
                    {PAYMENT_METHODS.map((method) => (
                      <button
                        key={method.key}
                        type="button"
                        onClick={() => store.setPaymentMethod(method.key)}
                        className={[
                          "rounded-2xl border p-3 text-left transition-all",
                          store.paymentMethod === method.key
                            ? "border-gold-400 bg-gold-500/10"
                            : "border-white/10 bg-ink-900/40",
                        ].join(" ")}
                      >
                        <p className="font-medium text-white">{isEs ? method.labelEs : method.labelEn}</p>
                        <p className="mt-1 text-xs text-ink-300">
                          {isEs ? method.descriptionEs : method.descriptionEn}
                        </p>
                      </button>
                    ))}
                  </div>
                </div>
              </section>
            )}

            {store.step === 5 && (
              <section className="space-y-5">
                <h2 className="text-2xl text-white">{isEs ? "Confirme su solicitud" : "Confirm your request"}</h2>

                <LuxuryCard className="p-4">
                  <p className="font-semibold text-white">{store.address || "Sin dirección"}</p>
                  <p className="mt-2 text-sm text-ink-300">
                    {measurement ? `${formatNumber(measurement.areaSqFt)} sq ft` : "Área no definida"}
                  </p>
                  <p className="mt-2 text-sm text-ink-300">
                    {store.selectedServices.length
                      ? store.selectedServices.join(", ")
                      : isEs
                        ? "Sin servicios seleccionados"
                        : "No services selected"}
                  </p>
                </LuxuryCard>

                <div className="flex flex-wrap gap-3">
                  <Button asChild variant="outline">
                    <a href={buildOwnerSmsHref(store.address)}>
                      <MessageSquare className="size-4" />
                      {isEs ? "Enviar SMS" : "Send SMS"}
                    </a>
                  </Button>
                  <Button asChild variant="gold">
                    <a href={BUSINESS.telHref}>
                      <PhoneIcon />
                      {isEs ? "Llamar" : "Call"}
                    </a>
                  </Button>
                </div>
              </section>
            )}

            <div className="flex items-center justify-between gap-3 border-t border-white/10 pt-5">
              {store.step > 1 ? (
                <Button variant="outline" onClick={store.goBack}>
                  {isEs ? "Anterior" : "Back"}
                </Button>
              ) : (
                <span />
              )}

              {store.step < TOTAL_STEPS ? (
                <Button onClick={next}>{isEs ? "Continuar" : "Continue"}</Button>
              ) : (
                <Button onClick={submit} disabled={sending}>
                  {sending ? (isEs ? "Enviando…" : "Sending…") : isEs ? "Confirmar solicitud" : "Confirm request"}
                </Button>
              )}
            </div>
          </CardContent>
        </Card>

        <aside className="space-y-4">
          <LuxuryCard className="p-5">
            <Ruler className="size-6 text-gold-300" />
            <h2 className="mt-3 text-xl font-semibold text-white">
              {isEs ? "Cobertura" : "Coverage"}
            </h2>
            <p className="mt-2 text-sm text-ink-300">
              Austin, Hutto, Round Rock, Georgetown, Cedar Park y áreas circundantes.
            </p>
          </LuxuryCard>

          <LuxuryCard className="p-5">
            <CalendarDays className="size-6 text-gold-300" />
            <h2 className="mt-3 text-xl font-semibold text-white">
              {isEs ? "Información del presupuesto" : "Quote information"}
            </h2>
            <p className="mt-2 text-sm text-ink-300">
              {isEs
                ? "El área dibujada o seleccionada se actualiza automáticamente y se guarda para confirmar la solicitud."
                : "The drawn or selected area updates automatically and is saved for final confirmation."}
            </p>
          </LuxuryCard>
        </aside>
      </div>
    </main>
  );
}

function Confirmation({ isEs, address, onReset }: { isEs: boolean; address: string; onReset: () => void }) {
  return (
    <main className="container flex min-h-dvh max-w-2xl items-center py-16">
      <LuxuryCard className="w-full text-center">
        <ShieldCheck className="mx-auto size-14 text-gold-300" />
        <h1 className="mt-5 text-3xl font-semibold text-white">
          {isEs ? "Solicitud enviada" : "Request sent"}
        </h1>
        <p className="mt-4 text-base text-ink-300">
          {isEs ? CONFIRMATION_ES : "Your request was submitted successfully. We will review it and contact you soon."}
        </p>
        <p className="mt-4 text-sm text-ink-400">{address}</p>

        <div className="mt-6 flex flex-wrap justify-center gap-3">
          <Button asChild variant="outline">
            <a href={BUSINESS.telHref}>
              <Send className="size-4" />
              {isEs ? "Llamar" : "Call"}
            </a>
          </Button>
          <Button onClick={onReset}>{isEs ? "Cerrar" : "Close"}</Button>
        </div>
      </LuxuryCard>
    </main>
  );
}

function PhoneIcon() {
  return <MessageSquare className="size-4" />;
}
