"use client";

import * as React from "react";
import { MessageSquare, Send, Wrench } from "lucide-react";

import { useLanguage } from "@/components/providers/language-provider";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input, Label, Textarea } from "@/components/ui/input";
import { buildOwnerSmsHref, BUSINESS } from "@/lib/constants";

const OTHER_JOB_TYPES = [
  { key: "bush_trimming", labelEs: "Poda de arbustos (Bush Trimming)", labelEn: "Bush Trimming" },
  { key: "mulch_installation", labelEs: "Instalación de Mulch", labelEn: "Mulch Installation" },
  { key: "yard_cleanups", labelEs: "Limpieza de jardín / patio (Cleanups)", labelEn: "Yard Cleanups" },
  { key: "tree_services", labelEs: "Servicio de árboles (Tree Services)", labelEn: "Tree Services" },
  { key: "landscaping", labelEs: "Paisajismo general (Landscaping)", labelEn: "Landscaping" },
] as const;

export function OtherServicesForm() {
  const { isEs } = useLanguage();
  const [jobType, setJobType] = React.useState<string>("bush_trimming");
  const [name, setName] = React.useState("");
  const [address, setAddress] = React.useState("");
  const [phone, setPhone] = React.useState("");
  const [comments, setComments] = React.useState("");
  const [saving, setSaving] = React.useState(false);
  const [saveError, setSaveError] = React.useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (saving) return;
    setSaving(true);
    setSaveError("");
    const selectedJob = OTHER_JOB_TYPES.find((j) => j.key === jobType);
    const jobName = selectedJob ? (isEs ? selectedJob.labelEs : selectedJob.labelEn) : jobType;

    let referenceCode = "";
    try {
      const response = await fetch("/api/other-services", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ jobType, name, address, phone, comments }),
      });
      const result = await response.json();
      if (!response.ok || !result.ok) throw new Error(result.error || "No se pudo registrar la solicitud.");
      referenceCode = result.referenceCode;
    } catch (error) {
      setSaveError(error instanceof Error ? error.message : "No se pudo registrar la solicitud.");
      setSaving(false);
      return;
    }

    const body = [
      `Solicitud de visita para estimado en persona (${jobName})`,
      `Folio: ${referenceCode}`,
      `Nombre: ${name}`,
      `Dirección: ${address}`,
      `Teléfono: ${phone}`,
      comments ? `Comentarios: ${comments}` : "",
    ]
      .filter(Boolean)
      .join("\n");

    const smsUrl = buildOwnerSmsHref(address || "Austin, TX", body);
    window.location.href = smsUrl;
    setSaving(false);
  };

  return (
    <Card className="border-emerald-200/20 bg-white shadow-luxury">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-xl font-bold text-slate-900">
          <Wrench className="size-5 text-emerald-600" />
          {isEs ? "Otros trabajos: solicita una visita" : "Other jobs: request an on-site estimate"}
        </CardTitle>
        <p className="text-xs text-slate-600">
          {isEs
            ? "Para poda, mulch, limpieza, árboles y otros trabajos, deja tus datos. Te contactaremos para ir a darte el estimado en persona."
            : "For trimming, mulch, cleanups, tree work and other jobs, leave your details. We will contact you to arrange an in-person estimate."}
        </p>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Label>{isEs ? "Tipo de trabajo *" : "Job Type *"}</Label>
            <div className="mt-2 grid gap-2 sm:grid-cols-2">
              {OTHER_JOB_TYPES.map((type) => (
                <button
                  key={type.key}
                  type="button"
                  onClick={() => setJobType(type.key)}
                  className={`rounded-xl border p-3 text-left text-xs font-semibold transition ${
                    jobType === type.key
                      ? "border-emerald-500 bg-emerald-50 text-emerald-700"
                      : "border-slate-200 bg-slate-50 text-slate-600 hover:border-slate-200"
                  }`}
                >
                  {isEs ? type.labelEs : type.labelEn}
                </button>
              ))}
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <Label htmlFor="other-name">{isEs ? "Nombre completo *" : "Full Name *"}</Label>
              <Input
                id="other-name"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder={isEs ? "Ej. Juan Pérez" : "e.g. John Smith"}
                className="mt-1"
              />
            </div>
            <div>
              <Label htmlFor="other-phone">{isEs ? "Teléfono *" : "Phone *"}</Label>
              <Input
                id="other-phone"
                required
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="737-000-0000"
                className="mt-1"
              />
            </div>
          </div>

          <div>
            <Label htmlFor="other-address">{isEs ? "Dirección *" : "Address *"}</Label>
            <Input
              id="other-address"
              required
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              placeholder={isEs ? "Ej. 1200 Barton Springs Rd, Austin, TX" : "e.g. 1200 Barton Springs Rd, Austin, TX"}
              className="mt-1"
            />
          </div>

          <div>
            <Label htmlFor="other-comments">{isEs ? "Comentarios / Detalle del trabajo" : "Comments / Work details"}</Label>
            <Textarea
              id="other-comments"
              value={comments}
              onChange={(e) => setComments(e.target.value)}
              placeholder={isEs ? "Describa el trabajo o área..." : "Describe the job or area..."}
              className="mt-1"
              rows={3}
            />
          </div>

          {saveError && <p role="alert" className="text-sm text-red-600">{saveError}</p>}
          <Button type="submit" disabled={saving} variant="gold" className="w-full font-bold">
            <MessageSquare className="mr-2 size-4" />
            {saving ? (isEs ? "Guardando..." : "Saving...") : (isEs ? "SOLICITAR VISITA POR SMS" : "REQUEST ON-SITE ESTIMATE BY SMS")}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
