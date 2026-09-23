"use client";

import * as React from "react";
import Link from "next/link";
import { ArrowLeft, CalendarDays, Check, MessageSquare, Ruler, Send, ShieldCheck } from "lucide-react";

import { useLanguage } from "@/components/providers/language-provider";
import { useToast } from "@/components/providers/toast-provider";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, LuxuryCard } from "@/components/ui/card";
import { Progress, Select } from "@/components/ui/controls";
import { FieldError, Input, Label, Textarea } from "@/components/ui/input";
import { Step1Address, Step1AddressHint } from "@/components/quote/step-1-address";
import { buildOwnerSmsHref, BUSINESS, PAYMENT_METHODS, SERVICES, TIME_WINDOWS, ZIP_CITY_MAP } from "@/lib/constants";
import { AUSTIN_CENTER, loadGoogleMaps } from "@/lib/google-maps";
import { formatNumber, todayISO } from "@/lib/utils";
import { step1Schema, step2Schema, step35Schema, step3Schema } from "@/lib/validation";
import { buildMeasurement, pickSubmissionFields, TOTAL_STEPS, useQuoteStore } from "@/store/quote-store";
import type { PolygonPoint } from "@/lib/types";

const AREA_OPTIONS = [
  { key: "small", labelEn: "Small", labelEs: "Pequeño", rangeEn: "Up to 2,500 sq ft", rangeEs: "Hasta 2,500 pies cuadrados", areaSqFt: 1250 },
  { key: "medium", labelEn: "Medium", labelEs: "Mediano", rangeEn: "2,500 - 5,000 sq ft", rangeEs: "2,500 - 5,000 pies cuadrados", areaSqFt: 3750 },
  { key: "large", labelEn: "Large", labelEs: "Grande", rangeEn: "5,000 - 10,000 sq ft", rangeEs: "5,000 - 10,000 pies cuadrados", areaSqFt: 7500 },
  { key: "extra-large", labelEn: "XL", labelEs: "XL", rangeEn: "10,000+ sq ft", rangeEs: "10,000+ pies cuadrados", areaSqFt: 12500 },
] as const;

type MapSelection = { latitude: number; longitude: number; areaSqM: number; coordinates: PolygonPoint[] };
const CONFIRMATION_ES = "Muchas gracias por requerir nuestros servicios. Su solicitud ha sido enviada con éxito. Nieto Green Care LLC revisará la información y se pondrá en contacto con usted a la brevedad para confirmarle la tarifa final y la fecha del trabajo.";

export default function QuotePage() {
  const { isEs } = useLanguage();
  const { toast } = useToast();
  const store = useQuoteStore();
  const [hydrated, setHydrated] = React.useState(false);
  const [mapsReady, setMapsReady] = React.useState(false);
  const [mapError, setMapError] = React.useState(false);
  const [errors, setErrors] = React.useState<Record<string, string>>({});
  const [sending, setSending] = React.useState(false);
  const [selectedArea, setSelectedArea] = React.useState("medium");
  const [selection, setSelection] = React.useState<MapSelection | null>(null);
  const mapNode = React.useRef<HTMLDivElement>(null);
  const mapRef = React.useRef<any>(null);

  React.useEffect(() => {
    useQuoteStore.persist.rehydrate();
    setHydrated(true);
    void loadGoogleMaps().then(setMapsReady).catch(() => setMapsReady(false));
  }, []);

  React.useEffect(() => {
    if (store.step !== 2 || !mapsReady || !mapNode.current || !window.google?.maps?.drawing || !window.google?.maps?.geometry) return;
    const g = window.google.maps;
    const center = { lat: store.latitude ?? AUSTIN_CENTER.lat, lng: store.longitude ?? AUSTIN_CENTER.lng };
    let map: any;
    let manager: any;
    try {
      map = new g.Map(mapNode.current, { center, zoom: 19, mapTypeId: "hybrid", streetViewControl: false, fullscreenControl: false });
      mapRef.current = map;
      manager = new g.drawing.DrawingManager({ drawingMode: g.drawing.OverlayType.POLYGON, drawingControl: true, drawingControlOptions: { drawingModes: [g.drawing.OverlayType.POLYGON] }, polygonOptions: { editable: true, draggable: true, fillColor: "#000000", fillOpacity: 0.3, strokeColor: "#ffffff", strokeWeight: 2 } });
      manager.setMap(map);
      const savePolygon = (polygon: any) => {
        try {
          const points = polygon.getPath().getArray().map((point: any) => ({ lat: point.lat(), lng: point.lng() })) as PolygonPoint[];
          const areaSqM = g.geometry.spherical.computeArea(polygon.getPath());
          if (points.length < 3 || !Number.isFinite(areaSqM)) return;
          const polygonCenter = points.reduce((total, point) => ({ lat: total.lat + point.lat / points.length, lng: total.lng + point.lng / points.length }), { lat: 0, lng: 0 });
          setSelection({ latitude: polygonCenter.lat, longitude: polygonCenter.lng, areaSqM, coordinates: points });
          const state = useQuoteStore.getState();
          state.setMeasurement(buildMeasurement(points, areaSqM * 10.7639, state.measurement?.depthInches ?? 2, map.getZoom()));
        } catch {
          setMapError(true);
        }
      };
      const bindPolygon = (polygon: any) => {
        savePolygon(polygon);
        ["set_at", "insert_at", "remove_at"].forEach((eventName) => polygon.getPath().addListener(eventName, () => savePolygon(polygon)));
        polygon.addListener("dragend", () => savePolygon(polygon));
      };
      const savedPolygon = useQuoteStore.getState().measurement?.polygon;
      if (savedPolygon && savedPolygon.length >= 3) bindPolygon(new g.Polygon({ paths: savedPolygon, editable: true, draggable: true, map }));
      const overlayListener = g.event.addListener(manager, "polygoncomplete", (polygon: any) => { manager.setDrawingMode(null); bindPolygon(polygon); });
      setMapError(false);
      return () => { g.event.removeListener(overlayListener); manager.setMap(null); mapRef.current = null; };
    } catch {
      setMapError(true);
      mapRef.current = null;
      return () => undefined;
    }
  }, [mapsReady, store.step]);

  React.useEffect(() => {
    const map = mapRef.current;
    if (map && store.latitude !== null && store.longitude !== null) map.setCenter({ lat: store.latitude, lng: store.longitude });
  }, [store.latitude, store.longitude]);

  const chooseArea = (area: (typeof AREA_OPTIONS)[number]) => {
    setSelectedArea(area.key);
    store.setMeasurement(buildMeasurement([], area.areaSqFt));
    setErrors((current) => ({ ...current, measurement: "" }));
  };

  const next = () => {
    const result = store.step === 1 ? step1Schema.safeParse(store) : store.step === 2 ? step2Schema.safeParse({ measurement: store.measurement }) : store.step === 3 ? step3Schema.safeParse(store) : step35Schema.safeParse(store);
    if (!result.success) { setErrors(Object.fromEntries(result.error.issues.map((issue) => [String(issue.path[0] ?? "form"), issue.message]))); toast({ title: isEs ? "Revise la información" : "Review your information", variant: "error" }); return; }
    setErrors({});
    store.goNext();
  };

  const submit = async () => {
    const referenceCode = store.ensureReferenceCode();
    setSending(true);
    try {
      const response = await fetch("/api/leads", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...pickSubmissionFields(store), referenceCode, snapshotUrl: null }) });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok || !payload.ok) throw new Error(payload.error ?? "No se pudo enviar la solicitud.");
      store.markSubmitted();
    } catch (error) {
      toast({ title: error instanceof Error ? error.message : "No se pudo enviar", variant: "error" });
    } finally {
      setSending(false);
    }
  };

  if (!hydrated) return <main className="container py-24 text-center text-ink-300">Cargando cotizador…</main>;
  if (store.submitted) return <Confirmation isEs={isEs} address={store.address} onReset={store.reset} />;
  const measurement = store.measurement;

  return <main className="container max-w-5xl py-8 sm:py-12"><Link className="inline-flex items-center gap-2 text-sm text-ink-300 hover:text-gold-200" href="/"><ArrowLeft className="size-4" />{BUSINESS.name}</Link><div className="mt-7 grid gap-7 lg:grid-cols-[1fr_300px]"><Card><CardHeader><p className="ngc-eyebrow">{isEs ? "Solicitud paso a paso" : "Request wizard"}</p><CardTitle>{isEs ? "Solicite su servicio" : "Request your service"}</CardTitle><Progress value={(store.step / TOTAL_STEPS) * 100} /><p className="text-xs text-ink-400">{isEs ? `Paso ${store.step} de ${TOTAL_STEPS}` : `Step ${store.step} of ${TOTAL_STEPS}`}</p></CardHeader><CardContent className="space-y-6">
    {store.step === 1 && <section className="space-y-5"><h2 className="text-2xl text-white">{isEs ? "Dirección del servicio" : "Service address"}</h2><div><Step1Address error={errors.address} isEs={isEs} /><Step1AddressHint isEs={isEs} /><FieldError>{errors.address}</FieldError></div><div><Label>ZIP Code</Label><Input value={store.zipCode} maxLength={5} onChange={(event) => { const zipCode = event.target.value.replace(/\D/g, "").slice(0, 5); store.setAddress({ zipCode, city: ZIP_CITY_MAP[zipCode] ?? store.city }); }} placeholder="78701" /><FieldError>{errors.zipCode}</FieldError></div></section>}
    {store.step === 2 && <section className="space-y-5"><h2 className="text-2xl text-white">{isEs ? "Medición y tamaño del terreno" : "Property measurement and size"}</h2>{mapsReady && !mapError ? <div className="relative"><p className="mb-3 text-sm text-ink-300">{isEs ? "Trace el perímetro de su patio sobre el mapa híbrido o seleccione un tamaño aproximado abajo." : "Draw your yard boundary on the hybrid map or choose an approximate size below."}</p><div ref={mapNode} className="h-[420px] overflow-hidden rounded-xl border border-gold-500/25" /><p className="mt-2 text-xs text-ink-400">{selection?.coordinates.length ? `${formatNumber(selection.areaSqM, 2)} m² · ${formatNumber(selection.areaSqM * 10.7639, 2)} ft²` : isEs ? "La selección visual sigue disponible si no desea dibujar." : "Visual size selection remains available if you do not want to draw."}</p></div> : <div className="rounded-xl border border-gold-500/30 bg-gold-500/10 p-4 text-sm text-ink-100">{isEs ? "El mapa satelital no está disponible ahora. Seleccione el tamaño del terreno para continuar." : "The satellite map is unavailable right now. Select the property size to continue."}</div>}<div className="grid gap-3 sm:grid-cols-2">{AREA_OPTIONS.map((area) => { const selected = selectedArea === area.key; return <button key={area.key} type="button" onClick={() => chooseArea(area)} aria-pressed={selected} className={`rounded-xl border p-5 text-left transition ${selected ? "border-gold-400 bg-gold-500/15 shadow-luxury" : "border-white/15 bg-ink-950/50 hover:border-gold-500/50"}`}><span className="flex items-center justify-between gap-3"><span className="text-lg font-semibold text-white">{isEs ? area.labelEs : area.labelEn}</span>{selected && <Check className="size-5 text-gold-300" />}</span><span className="mt-2 block text-sm text-ink-300">{isEs ? area.rangeEs : area.rangeEn}</span></button>; })}</div><FieldError>{errors.measurement}</FieldError></section>}
    {store.step === 3 && <section className="space-y-5"><h2 className="text-2xl text-white">{isEs ? "Servicios y fecha" : "Services and date"}</h2><div className="grid gap-3 sm:grid-cols-2">{SERVICES.map((service) => { const selected = store.selectedServices.includes(service.key); return <button key={service.key} type="button" onClick={() => store.toggleService(service.key)} className={`rounded-xl border p-4 text-left transition ${selected ? "border-black bg-black text-white" : "border-white/15 bg-ink-950/50 text-ink-200 hover:border-gold-500/50"}`} aria-pressed={selected}><span className="flex items-center justify-between gap-3 font-semibold"><span>{isEs ? service.nameEs : service.nameEn}</span>{selected && <Check className="size-5" />}</span></button>; })}</div><FieldError>{errors.selectedServices}</FieldError><div className="grid gap-4 sm:grid-cols-2"><div><Label>{isEs ? "Fecha solicitada" : "Requested date"}</Label><Input type="date" min={todayISO()} value={store.requestedDate ?? ""} onChange={(event) => store.setSchedule(event.target.value, store.requestedTimeWindow)} /><FieldError>{errors.requestedDate}</FieldError></div><div><Label>{isEs ? "Horario preferido" : "Preferred time"}</Label><Select value={store.requestedTimeWindow} onChange={(event) => store.setSchedule(store.requestedDate ?? "", event.target.value)}><option value="">Flexible</option>{TIME_WINDOWS.map((time) => <option key={time} value={time}>{time}</option>)}</Select></div></div></section>}
    {store.step === 4 && <section className="space-y-5"><h2 className="text-2xl text-white">{isEs ? "Datos de contacto" : "Contact details"}</h2><div><Label>{isEs ? "Nombre" : "Name"}</Label><Input value={store.customerName} onChange={(event) => store.setPersonal({ customerName: event.target.value })} /><FieldError>{errors.customerName}</FieldError></div><div><Label>{isEs ? "Teléfono" : "Phone"}</Label><Input value={store.customerPhone} onChange={(event) => store.setPersonal({ customerPhone: event.target.value })} /><FieldError>{errors.customerPhone}</FieldError></div><div><Label>Email ({isEs ? "opcional" : "optional"})</Label><Input type="email" value={store.customerEmail} onChange={(event) => store.setPersonal({ customerEmail: event.target.value })} /></div><div><Label>{isEs ? "Detalles del trabajo" : "Work details"}</Label><Textarea value={store.details} onChange={(event) => store.setPersonal({ details: event.target.value })} /></div><div><Label>{isEs ? "Método de pago preferido" : "Preferred payment method"}</Label><div className="mt-2 grid gap-3 sm:grid-cols-3">{PAYMENT_METHODS.map((method) => <button key={method.key} type="button" onClick={() => store.setPaymentMethod(method.key)} className={`rounded-xl border p-4 text-left transition ${store.paymentMethod === method.key ? "border-gold-400 bg-gold-500/10" : "border-white/10 bg-white/[0.03] hover:border-gold-500/35"}`}><p className="font-semibold text-white">{isEs ? method.labelEs : method.labelEn}</p><p className="mt-1 text-xs leading-relaxed text-ink-300">{isEs ? method.descriptionEs : method.descriptionEn}</p></button>)}</div><FieldError>{errors.paymentMethod}</FieldError></div></section>}
    {store.step === 5 && <section className="space-y-5"><h2 className="text-2xl text-white">{isEs ? "Confirme su solicitud" : "Confirm your request"}</h2><p className="text-sm text-ink-300">{isEs ? "Enviaremos sus datos, área medida, fecha solicitada y servicios seleccionados a Nieto Green Care LLC." : "We will send your details, measured area, requested date and selected services to Nieto Green Care LLC."}</p><LuxuryCard><p className="font-semibold text-white">{store.address}</p><p className="mt-2 text-sm text-ink-300">{measurement ? `${formatNumber(measurement.areaSqYd, 1)} sq yd · ${formatNumber(measurement.areaSqFt)} sq ft · ${formatNumber(measurement.estimatedCubicYards, 2)} yd³` : "—"}</p><p className="mt-2 text-sm text-ink-300">{store.selectedServices.map((key) => SERVICES.find((service) => service.key === key)?.[isEs ? "nameEs" : "nameEn"] ?? key).join(", ")}</p></LuxuryCard><div className="grid gap-3 sm:grid-cols-2"><Button asChild variant="outline" size="lg"><a href={buildOwnerSmsHref(store.address)}><MessageSquare className="size-5" />{isEs ? "Enviar SMS directo al propietario" : "Text the owner directly"}</a></Button><Button size="lg" onClick={submit} disabled={sending}><Send className="size-5" />{sending ? (isEs ? "Enviando…" : "Sending…") : (isEs ? "Confirmar Solicitud" : "Confirm Request")}</Button></div></section>}
    <div className="flex justify-between gap-3 border-t border-white/10 pt-5">{store.step > 1 ? <Button variant="outline" onClick={store.goBack}>{isEs ? "Anterior" : "Back"}</Button> : <span />}{store.step < 5 && <Button onClick={next}>{isEs ? "Continuar" : "Continue"}</Button>}</div>
  </CardContent></Card><aside className="space-y-4"><LuxuryCard><Ruler className="size-6 text-gold-300" /><h2 className="mt-3 font-display text-xl text-white">{isEs ? "Cobertura" : "Coverage"}</h2><p className="mt-2 text-sm text-ink-300">Austin, Hutto, Round Rock, Georgetown, Cedar Park y áreas circundantes.</p></LuxuryCard><LuxuryCard><CalendarDays className="size-6 text-gold-300" /><p className="mt-3 text-sm text-ink-300">{isEs ? "La tarifa final se confirma después de revisar la solicitud." : "The final rate is confirmed after we review your request."}</p></LuxuryCard></aside></div></main>;
}

function Confirmation({ isEs, address, onReset }: { isEs: boolean; address: string; onReset: () => void }) { return <main className="container flex min-h-dvh max-w-2xl items-center py-16"><LuxuryCard className="w-full text-center"><ShieldCheck className="mx-auto size-14 text-gold-300" /><h1 className="mt-5 text-4xl text-white">{isEs ? "Solicitud enviada" : "Request sent"}</h1><p className="mt-5 leading-7 text-ink-100">{isEs ? CONFIRMATION_ES : "Thank you for requesting our services. Your request was sent successfully. Nieto Green Care LLC will review the information and contact you shortly to confirm the final rate and work date."}</p><div className="mt-8 flex flex-wrap justify-center gap-3"><Button asChild variant="outline"><a href={BUSINESS.telHref}>{BUSINESS.phoneDisplay}</a></Button><Button asChild variant="gold"><a href={buildOwnerSmsHref(address)}><MessageSquare />{isEs ? "Enviar SMS directo al propietario" : "Text the owner directly"}</a></Button><Button asChild onClick={onReset}><Link href="/">{isEs ? "Cerrar" : "Close"}</Link></Button></div></LuxuryCard></main>; }