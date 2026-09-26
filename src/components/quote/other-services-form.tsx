"use client";

import * as React from "react";
import { MessageSquare, Wrench } from "lucide-react";

import { useLanguage } from "@/components/providers/language-provider";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input, Label, Textarea } from "@/components/ui/input";
import { buildOwnerSmsHref } from "@/lib/constants";

const OTHER_JOB_TYPES = [
  { key: "bush_trimming", labelEs: "Poda de arbustos", labelEn: "Bush Trimming" },
  { key: "mulch_installation", labelEs: "Instalación de Mulch", labelEn: "Mulch Installation" },
  { key: "yard_cleanups", labelEs: "Limpiezas", labelEn: "Cleanups" },
  { key: "tree_services", labelEs: "Servicio de árboles", labelEn: "Tree Services" },
  { key: "landscaping", labelEs: "Paisajismo", labelEn: "Landscaping" },
] as const;

export function OtherServicesForm() {
  const { isEs } = useLanguage();
  const [selectedJobs, setSelectedJobs] = React.useState<string[]>([]);
  const [name, setName] = React.useState("");
  const [phone, setPhone] = React.useState("");
  const [comments, setComments] = React.useState("");
  const [saving, setSaving] = React.useState(false);
  const [saveError, setSaveError] = React.useState("");

  const toggleJob = (key: string) => {
    setSelectedJobs((prev) => 
      prev.includes(key) ? prev.filter(k => k !== key) : [...prev, key]
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (saving) return;
    setSaving(true);
    setSaveError("");
    
    const jobNames = selectedJobs.map(key => {
        const job = OTHER_JOB_TYPES.find(j => j.key === key);
        return job ? (isEs ? job.labelEs : job.labelEn) : key;
    }).join(", ");

    let referenceCode = "";
    try {
      const response = await fetch("/api/other-services", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ jobTypes: selectedJobs, name, phone, comments }),
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
      `Solicitud de Otros Servicios: ${jobNames}`,
      `Folio: ${referenceCode}`,
      `Nombre: ${name}`,
      `Teléfono: ${phone}`,
      comments ? `Comentarios: ${comments}` : "",
    ]
      .filter(Boolean)
      .join("\n");

    const smsUrl = buildOwnerSmsHref("Austin, TX", body);
    window.location.href = smsUrl;
    setSaving(false);
  };

  return (
    <Card className="border-emerald-500/20 bg-white shadow-sm">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-xl font-bold text-slate-900">
          <Wrench className="size-5 text-emerald-600" />
          {isEs ? "Solicitar otros servicios" : "Request other services"}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Label>{isEs ? "Seleccione los trabajos *" : "Select jobs *"}</Label>
            <div className="mt-2 grid gap-2 sm:grid-cols-2">
              {OTHER_JOB_TYPES.map((type) => (
                <button
                  key={type.key}
                  type="button"
                  onClick={() => toggleJob(type.key)}
                  className={`rounded-xl border p-3 text-left text-xs font-semibold transition ${
                    selectedJobs.includes(type.key)
                      ? "border-emerald-600 bg-emerald-50 text-emerald-700"
                      : "border-slate-200 bg-slate-50 text-slate-600 hover:border-emerald-600/50"
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
            <Label htmlFor="other-comments">{isEs ? "Comentarios / Detalle" : "Comments / Work details"}</Label>
            <Textarea
              id="other-comments"
              value={comments}
              onChange={(e) => setComments(e.target.value)}
              className="mt-1"
              rows={3}
            />
          </div>

          {saveError && <p role="alert" className="text-sm text-red-600">{saveError}</p>}
          <Button type="submit" disabled={saving} className="w-full font-bold bg-emerald-600 hover:bg-emerald-700">
            <MessageSquare className="mr-2 size-4" />
            {saving ? (isEs ? "Guardando..." : "Saving...") : (isEs ? "SOLICITAR VISITA POR SMS" : "REQUEST ON-SITE ESTIMATE BY SMS")}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
