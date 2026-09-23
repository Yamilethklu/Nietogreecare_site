"use client";

import * as React from "react";
import Link from "next/link";
import { ArrowLeft, Check, MessageSquare, Send, ShieldCheck } from "lucide-react";
import { useLanguage } from "@/components/providers/language-provider";
import { useToast } from "@/components/providers/toast-provider";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, LuxuryCard } from "@/components/ui/card";
import { Progress, Select } from "@/components/ui/controls";
import { FieldError, Input, Label, Textarea } from "@/components/ui/input";
import { Step1Address, Step1AddressHint } from "@/components/quote/step-1-address";
import { QuoteAreaMap } from "@/components/quote/quote-area-map";
import { buildOwnerSmsHref, BUSINESS, PAYMENT_METHODS, SERVICES, TIME_WINDOWS, ZIP_CITY_MAP } from "@/lib/constants";
import { formatNumber, todayISO } from "@/lib/utils";
import { formatZodErrors, step1Schema, step2Schema, step35Schema, step3Schema } from "@/lib/validation";
import { pickSubmissionFields, TOTAL_STEPS, useQuoteStore } from "@/store/quote-store";

export default function QuotePage() {
  const { isEs } = useLanguage();
  const { toast } = useToast();
  const store = useQuoteStore();
  const [hydrated, setHydrated] = React.useState(false);
  const [errors, setErrors] = React.useState<Record<string, string>>({});
  const [sending, setSending] = React.useState(false);

  React.useEffect(() => {
    const res = useQuoteStore.persist.rehydrate();
    if (res && typeof (res as Promise<void>).then === "function") {
      void (res as Promise<void>).then(() => setHydrated(true));
    } else {
      setHydrated(true);
    }
  }, []);

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
              : ({ success: true } as const);

    if (!result.success) {
      setErrors(formatZodErrors(result.error));
      toast({ title: isEs ? "Revise la información" : "Review your information", variant: "error" });
      return;
    }
    setErrors({});
    store.goNext();
  };

  const submit = async () => {
    setSending(true);
    try {
      const referenceCode = store.ensureReferenceCode();
      const response = await fetch("/api/leads", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...pickSubmissionFields(store), referenceCode, snapshotUrl: null }),
      });
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

  return (
    <main className="container max-w-5xl py-8 sm:py-12">
      <Link className="inline-flex items-center gap-2 text-sm text-ink-300 hover:text-gold-200" href="/"><ArrowLeft className="size-4" />{BUSINESS.name}</Link>
      <Card className="mt-7">
        <CardHeader>
          <p className="ngc-eyebrow">{isEs ? "Cotizador paso a paso" : "Step-by-step quote"}</p>
          <CardTitle>{isEs ? "Solicite su servicio" : "Request your service"}</CardTitle>
          <Progress value={(store.step / TOTAL_STEPS) * 100} />
          <p className="text-xs text-ink-400">{isEs ? `Paso ${store.step} de ${TOTAL_STEPS}` : `Step ${store.step} of ${TOTAL_STEPS}`}</p>
        </CardHeader>
        <CardContent className="space-y-6">
          {store.step === 1 && <section className="space-y-5"><h2 className="text-2xl text-white">{isEs ? "Dirección del servicio" : "Service address"}</h2><div><Step1Address error={errors.address} isEs={isEs} /><Step1AddressHint isEs={isEs} /><FieldError>{errors.address}</FieldError></div><div><Label>{isEs ? "Código postal" : "ZIP code"}</Label><Input value={store.zipCode} maxLength={5} onChange={(event) => { const zipCode = event.target.value.replace(/\D/g, "").slice(0, 5); store.setAddress({ zipCode, city: ZIP_CITY_MAP[zipCode] ?? store.city }); }} placeholder="78701" /><FieldError>{errors.zipCode}</FieldError></div></section>}

          {store.step === 2 && <section className="space-y-5"><div><h2 className="text-2xl text-white">{isEs ? "Dibuje el área del trabajo" : "Draw the work area"}</h2><p className="mt-2 text-sm text-ink-300">{isEs ? "Presione Dibujar área, marque las esquinas del patio y cierre el polígono. El tamaño se calculará y guardará automáticamente." : "Press Draw area, mark the yard corners, and close the polygon. The size will be calculated and saved automatically."}</p></div><QuoteAreaMap isEs={isEs} /><FieldError>{errors.measurement}</FieldError></section>}

          {store.step === 3 && <section className="space-y-5"><h2 className="text-2xl text-white">{isEs ? "Servicios y fecha" : "Services and date"}</h2><div className="grid gap-3 sm:grid-cols-2">{SERVICES.map((service) => { const selected = store.selectedServices.includes(service.key); return <button key={service.key} type="button" onClick={() => store.toggleService(service.key)} className={`rounded-2xl border p-4 text-left ${selected ? "border-gold-400 bg-gold-500/10 text-white" : "border-white/10 bg-ink-900/50 text-ink-200"}`}><span className="flex items-center justify-between">{isEs ? service.nameEs : service.nameEn}{selected && <Check className="size-5 text-gold-300" />}</span></button>; })}</div><FieldError>{errors.selectedServices}</FieldError><div className="grid gap-4 sm:grid-cols-2"><div><Label>{isEs ? "Fecha solicitada" : "Requested date"}</Label><Input type="date" min={todayISO()} value={store.requestedDate ?? ""} onChange={(event) => store.setSchedule(event.target.value, store.requestedTimeWindow)} /><FieldError>{errors.requestedDate}</FieldError></div><div><Label>{isEs ? "Horario preferido" : "Preferred time"}</Label><Select value={store.requestedTimeWindow} onChange={(event) => store.setSchedule(store.requestedDate ?? todayISO(), event.target.value)}><option value="">{isEs ? "Flexible" : "Flexible"}</option>{TIME_WINDOWS.map((time) => <option key={time} value={time}>{time}</option>)}</Select></div></div></section>}

          {store.step === 4 && <section className="space-y-5"><h2 className="text-2xl text-white">{isEs ? "Datos de contacto" : "Contact details"}</h2><div><Label>{isEs ? "Nombre" : "Name"}</Label><Input value={store.customerName} onChange={(event) => store.setPersonal({ customerName: event.target.value })} /><FieldError>{errors.customerName}</FieldError></div><div><Label>{isEs ? "Teléfono" : "Phone"}</Label><Input value={store.customerPhone} onChange={(event) => store.setPersonal({ customerPhone: event.target.value })} /><FieldError>{errors.customerPhone}</FieldError></div><div><Label>{isEs ? "Correo electrónico" : "Email"}</Label><Input type="email" value={store.customerEmail} onChange={(event) => store.setPersonal({ customerEmail: event.target.value })} /></div><div><Label>{isEs ? "Detalles del trabajo" : "Work details"}</Label><Textarea value={store.details} onChange={(event) => store.setPersonal({ details: event.target.value })} /></div><div><Label>{isEs ? "Método de pago preferido" : "Preferred payment method"}</Label><div className="mt-2 grid gap-3 sm:grid-cols-3">{PAYMENT_METHODS.map((method) => <button key={method.key} type="button" onClick={() => store.setPaymentMethod(method.key)} className={`rounded-2xl border p-3 text-left ${store.paymentMethod === method.key ? "border-gold-400 bg-gold-500/10" : "border-white/10 bg-ink-900/40"}`}><p className="font-medium text-white">{isEs ? method.labelEs : method.labelEn}</p><p className="mt-1 text-xs text-ink-300">{isEs ? method.descriptionEs : method.descriptionEn}</p></button>)}</div></div></section>}

          {store.step === 5 && <section className="space-y-5"><h2 className="text-2xl text-white">{isEs ? "Confirme su solicitud" : "Confirm your request"}</h2><LuxuryCard className="space-y-2 p-5"><p className="font-semibold text-white">{store.address}</p><p className="text-sm text-ink-300">{store.measurement ? `${formatNumber(store.measurement.areaSqFt)} sq ft` : "Área no definida"}</p><p className="text-sm text-ink-300">{store.selectedServices.join(", ")}</p></LuxuryCard><div className="flex flex-wrap gap-3"><Button asChild variant="outline"><a href={buildOwnerSmsHref(store.address)}><MessageSquare className="size-4" />{isEs ? "Enviar SMS" : "Send SMS"}</a></Button><Button asChild variant="outline"><a href={BUSINESS.telHref}>{isEs ? "Llamar" : "Call"}</a></Button></div></section>}

          <div className="flex justify-between gap-3 border-t border-white/10 pt-5">{store.step > 1 ? <Button variant="outline" onClick={store.goBack}>{isEs ? "Anterior" : "Back"}</Button> : <span />}{store.step < TOTAL_STEPS ? <Button onClick={next}>{isEs ? "Continuar" : "Continue"}</Button> : <Button onClick={submit} disabled={sending}><Send className="size-4" />{sending ? (isEs ? "Enviando…" : "Sending…") : isEs ? "Confirmar solicitud" : "Confirm request"}</Button>}</div>
        </CardContent>
      </Card>
    </main>
  );
}

function Confirmation({ isEs, address, onReset }: { isEs: boolean; address: string; onReset: () => void }) { return <main className="container flex min-h-dvh max-w-2xl items-center py-16"><LuxuryCard className="w-full text-center"><ShieldCheck className="mx-auto size-14 text-gold-300" /><h1 className="mt-5 text-3xl font-semibold text-white">{isEs ? "Solicitud enviada" : "Request sent"}</h1><p className="mt-4 text-ink-300">{isEs ? "Gracias por solicitar nuestros servicios. Nos pondremos en contacto con usted." : "Thank you for requesting our services. We will contact you."}</p><p className="mt-4 text-sm text-ink-400">{address}</p><div className="mt-6 flex justify-center gap-3"><Button asChild variant="outline"><a href={BUSINESS.telHref}><Send className="size-4" />{isEs ? "Llamar" : "Call"}</a></Button><Button onClick={onReset}>{isEs ? "Nueva cotización" : "New quote"}</Button></div></LuxuryCard></main>; }