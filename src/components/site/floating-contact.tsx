"use client";

import * as React from "react";
import { MessageSquare, Move, Phone, Send, ShieldCheck } from "lucide-react";

import { useLanguage } from "@/components/providers/language-provider";
import { useToast } from "@/components/providers/toast-provider";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { FieldError, FieldHint, Input, Label, Textarea } from "@/components/ui/input";
import { buildOwnerSmsHref, BUSINESS } from "@/lib/constants";
import { cn } from "@/lib/utils";

type Channel = "sms" | "email";

type FormState = {
  name: string;
  phone: string;
  email: string;
  message: string;
  preferredChannel: Channel;
};

const EMPTY_FORM: FormState = {
  name: "",
  phone: "",
  email: "",
  message: "",
  preferredChannel: "sms",
};

/**
 * Boton flotante "Enviar mensaje": se puede arrastrar para no tapar el contenido.
 * Envía el formulario a /api/contact por correo y ofrece SMS nativo directo al propietario.
 */
export function FloatingContact() {
  const { t, isEs } = useLanguage();
  const { toast } = useToast();

  const [open, setOpen] = React.useState(false);
  const [form, setForm] = React.useState<FormState>(EMPTY_FORM);
  const [errors, setErrors] = React.useState<Record<string, string>>({});
  const [sending, setSending] = React.useState(false);
  const [sent, setSent] = React.useState(false);
  const [offset, setOffset] = React.useState({ x: 0, y: 0 });

  const dragState = React.useRef({ dragging: false, startX: 0, startY: 0, originX: 0, originY: 0, moved: 0 });

  const onPointerDown = (event: React.PointerEvent<HTMLButtonElement>) => {
    dragState.current = {
      dragging: true,
      startX: event.clientX,
      startY: event.clientY,
      originX: offset.x,
      originY: offset.y,
      moved: 0,
    };
    event.currentTarget.setPointerCapture(event.pointerId);
  };

  const onPointerMove = (event: React.PointerEvent<HTMLButtonElement>) => {
    if (!dragState.current.dragging) return;
    const dx = event.clientX - dragState.current.startX;
    const dy = event.clientY - dragState.current.startY;
    dragState.current.moved = Math.max(dragState.current.moved, Math.abs(dx) + Math.abs(dy));
    const limitX = -(typeof window === "undefined" ? 0 : window.innerWidth - 96);
    const limitY = -(typeof window === "undefined" ? 0 : window.innerHeight - 160);
    setOffset({
      x: Math.min(0, Math.max(limitX, dragState.current.originX + dx)),
      y: Math.min(0, Math.max(limitY, dragState.current.originY + dy)),
    });
  };

  const onPointerUp = (event: React.PointerEvent<HTMLButtonElement>) => {
    const wasDrag = dragState.current.moved > 6;
    dragState.current.dragging = false;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
    if (!wasDrag) setOpen(true);
  };

  const update = (field: keyof FormState, value: string) =>
    setForm((current) => ({ ...current, [field]: value }));

  const submit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setErrors({});
    setSending(true);

    try {
      const response = await fetch("/api/contact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const payload = (await response.json()) as {
        ok: boolean;
        error?: string;
        errors?: Record<string, string>;
      };

      if (!response.ok || !payload.ok) {
        setErrors(payload.errors ?? {});
        toast({ title: payload.error ?? t.floating.error, variant: "error" });
        return;
      }

      setSent(true);
      setForm(EMPTY_FORM);
      toast({ title: t.floating.success, description: t.floating.successDetail, variant: "success" });
    } catch {
      toast({ title: t.floating.error, variant: "error" });
    } finally {
      setSending(false);
    }
  };

  return (
    <>
      <div
        className="fixed bottom-6 right-5 z-40 no-print"
        style={{ transform: `translate3d(${offset.x}px, ${offset.y}px, 0)` }}
      >
        <button
          type="button"
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          aria-label={`${t.floating.openLabel} — ${t.floating.drag}`}
          title={t.floating.drag}
          className={cn(
            "group flex h-14 items-center gap-3 rounded-full border border-gold-500/45 bg-gradient-to-r from-forest-600 to-forest-800 pl-4 pr-5 text-sm font-semibold text-white shadow-[0_18px_40px_-18px_rgba(201,162,39,0.75)]",
            "cursor-grab touch-none transition-all duration-300 hover:from-forest-500 active:cursor-grabbing",
          )}
        >
          <span className="relative grid size-9 place-items-center rounded-full bg-ink-950/70">
            <MessageSquare className="size-4 text-gold-200" />
            <span className="absolute -right-0.5 -top-0.5 size-2.5 animate-pulse rounded-full bg-gold-400" />
          </span>
          <span className="flex flex-col items-start leading-none">
            {t.floating.openLabel}
            <span className="mt-1 flex items-center gap-1 text-[10px] font-normal uppercase tracking-[0.16em] text-gold-200/80">
              <Move className="size-3" />
              {t.floating.drag}
            </span>
          </span>
        </button>
      </div>

      <Dialog
        open={open}
        onOpenChange={(next) => {
          setOpen(next);
          if (!next) {
            setSent(false);
            setErrors({});
          }
        }}
      >
        <DialogContent className="max-w-xl">
          <DialogHeader>
            <DialogTitle>{t.floating.title}</DialogTitle>
            <DialogDescription>{t.floating.subtitle}</DialogDescription>
          </DialogHeader>

          {sent ? (
            <div className="flex flex-col gap-4">
              <div className="rounded-2xl border border-emerald-500/30 bg-emerald-950/30 p-5">
                <p className="text-sm font-semibold text-emerald-100">{t.floating.success}</p>
                <p className="mt-1 text-xs leading-relaxed text-emerald-100/80">
                  {t.floating.successDetail}
                </p>
              </div>
              <DialogFooter>
                <Button asChild variant="outline">
                  <a href={buildOwnerSmsHref(form.message || "la información de mi solicitud")}>
                    <MessageSquare className="size-4" />
                    {isEs ? "Enviar SMS directo" : "Text directly"}
                  </a>
                </Button>
                <Button asChild variant="dark">
                  <a href={BUSINESS.telHref}>
                    <Phone className="size-4" />
                    {t.floating.callInstead}
                  </a>
                </Button>
                <Button type="button" variant="gold" onClick={() => setOpen(false)}>
                  {t.floating.close}
                </Button>
              </DialogFooter>
            </div>
          ) : (
            <form className="flex flex-col gap-4" onSubmit={submit} noValidate>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="flex flex-col gap-2">
                  <Label htmlFor="floating-name">{t.floating.name}</Label>
                  <Input
                    id="floating-name"
                    name="name"
                    value={form.name}
                    onChange={(event) => update("name", event.target.value)}
                    placeholder={t.floating.namePlaceholder}
                    aria-invalid={Boolean(errors.name)}
                    autoComplete="name"
                    required
                  />
                  <FieldError>{errors.name}</FieldError>
                </div>

                <div className="flex flex-col gap-2">
                  <Label htmlFor="floating-phone">{t.floating.phone}</Label>
                  <Input
                    id="floating-phone"
                    name="phone"
                    type="tel"
                    value={form.phone}
                    onChange={(event) => update("phone", event.target.value)}
                    placeholder={t.floating.phonePlaceholder}
                    aria-invalid={Boolean(errors.phone)}
                    autoComplete="tel"
                    required
                  />
                  <FieldError>{errors.phone}</FieldError>
                </div>
              </div>
              <div className="flex flex-col gap-2">
                <Label htmlFor="floating-email">
                  {t.floating.email}{" "}
                  <span className="text-ink-400 normal-case">({t.common.optional})</span>
                </Label>
                <Input
                  id="floating-email"
                  name="email"
                  type="email"
                  value={form.email}
                  onChange={(event) => update("email", event.target.value)}
                  placeholder={t.floating.emailPlaceholder}
                  aria-invalid={Boolean(errors.email)}
                  autoComplete="email"
                />
                <FieldError>{errors.email}</FieldError>
              </div>

              <div className="flex flex-col gap-2">
                <Label htmlFor="floating-message">{t.floating.message}</Label>
                <Textarea
                  id="floating-message"
                  name="message"
                  value={form.message}
                  onChange={(event) => update("message", event.target.value)}
                  placeholder={t.floating.messagePlaceholder}
                  aria-invalid={Boolean(errors.message)}
                  required
                />
                <FieldError>{errors.message}</FieldError>
              </div>

              <fieldset className="flex flex-col gap-2">
                <legend className="text-xs font-semibold uppercase tracking-[0.14em] text-gold-200/90">
                  {t.floating.channel}
                </legend>
                <div className="flex flex-wrap gap-2">
                  {[
                    { value: "sms" as Channel, label: t.floating.channelSms },
                    { value: "email" as Channel, label: t.floating.channelEmail },
                  ].map((option) => (
                    <button
                      key={option.value}
                      type="button"
                      onClick={() => update("preferredChannel", option.value)}
                      aria-pressed={form.preferredChannel === option.value}
                      className={cn(
                        "rounded-full border px-4 py-2 text-xs font-semibold uppercase tracking-[0.14em] transition-all",
                        form.preferredChannel === option.value
                          ? "border-gold-500/50 bg-gold-500/15 text-gold-100"
                          : "border-white/10 bg-white/[0.03] text-ink-400 hover:text-white",
                      )}
                    >
                      {option.label}
                    </button>
                  ))}
                </div>
              </fieldset>

              <FieldHint className="flex items-start gap-2">
                <ShieldCheck className="mt-0.5 size-3.5 shrink-0 text-gold-400" />
                {t.floating.note}
              </FieldHint>

              <DialogFooter className="items-center justify-between sm:justify-between">
                <div className="flex flex-wrap gap-2">
                <Button asChild variant="outline" size="sm">
                  <a href={buildOwnerSmsHref(form.message || "la información de mi solicitud")}>
                    <MessageSquare className="size-4" />
                    {isEs ? "Enviar SMS directo" : "Text directly"}
                  </a>
                </Button>
                <Button asChild variant="ghost" size="sm">
                  <a href={BUSINESS.telHref}>
                    <Phone className="size-4" />
                    {t.floating.callInstead}
                  </a>
                </Button>
                </div>
                <Button type="submit" variant="gold" disabled={sending}>
                  {sending ? t.floating.sending : t.floating.send}
                  <Send className="size-4" />
                </Button>
              </DialogFooter>
            </form>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}