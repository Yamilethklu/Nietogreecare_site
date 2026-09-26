"use client";

import * as React from "react";
import { MessageSquare, Wrench } from "lucide-react";

import { useLanguage } from "@/components/providers/language-provider";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input, Label, Textarea } from "@/components/ui/input";
import { BUSINESS } from "@/lib/constants";

const OTHER_JOB_TYPES = [
  { key: "tree_bush", labelEs: "Poda de árboles y arbustos", labelEn: "Tree & Bush Trimming" },
  { key: "sod", labelEs: "Instalación de césped en rollo", labelEn: "Sod Installation" },
  { key: "flowers", labelEs: "Camas de flores", labelEn: "Flower Beds" },
  { key: "fertilizer", labelEs: "Fertilización", labelEn: "Fertilizer" },
  { key: "gravel", labelEs: "Instalación de grava y piedra", labelEn: "Gravel & Rock Installation" },
  { key: "metal_edging", labelEs: "Bordes metálicos", labelEn: "Metal Edging" },
  { key: "mulch", labelEs: "Instalación de mantillo", labelEn: "Mulch Installation" },
  { key: "cleanup", labelEs: "Limpieza general de patio", labelEn: "Yard Clean Up" },
  { key: "top_soil", labelEs: "Tierra vegetal", labelEn: "Top Soil" },
] as const;

export function OtherServicesForm() {
  const { isEs } = useLanguage();
  const [selectedJobs, setSelectedJobs] = React.useState<string[]>([]);
  const [name, setName] = React.useState("");
  const [phone, setPhone] = React.useState("");
  const [hasGate, setHasGate] = React.useState<"yes" | "no" | "">("");
  const [gateCode, setGateCode] = React.useState("");
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
    if (selectedJobs.length === 0) {
      setSaveError(isEs ? "Seleccione al menos un trabajo." : "Select at least one service.");
      return;
    }
    if (!hasGate) {
      setSaveError(isEs ? "Indique si el patio tiene candado o portón." : "Choose whether the yard has a lock or gate.");
      return;
    }
    setSaving(true);
    setSaveError("");
    
    const jobNames = selectedJobs.map(key => {
        const job = OTHER_JOB_TYPES.find(j => j.key === key);
        return job ? (isEs ? job.labelEs : job.labelEn) : key;
    }).join(", ");

    const body = [
      `Solicitud de cotización: ${jobNames}`,
      `Nombre: ${name}`,
      `Teléfono: ${phone}`,
      `¿Acceso con candado?: ${hasGate === "yes" ? "Sí" : "No"}`,
      hasGate === "yes" && gateCode ? `Código/Info acceso: ${gateCode}` : "",
      comments ? `Comentarios: ${comments}` : "",
    ]
      .filter(Boolean)
      .join("\n");

    window.location.href = `${BUSINESS.smsHref}?body=${encodeURIComponent(body)}`;
  };

  return (
    <Card className="border-emerald-500/20 bg-white shadow-sm">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-xl font-bold text-slate-900">
          <Wrench className="size-5 text-emerald-600" />
          {isEs ? "SELECCIONE LOS TRABAJOS A REALIZAR" : "SELECT SERVICES TO PERFORM"}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <div className="grid gap-2 sm:grid-cols-3">
              {OTHER_JOB_TYPES.map((type) => (
                <button
                  key={type.key}
                  type="button"
                  onClick={() => toggleJob(type.key)}
                  className={`rounded-xl border p-3 text-left text-xs font-semibold transition ${selectedJobs.includes(type.key) ? "border-emerald-600 bg-emerald-50 text-emerald-700" : "border-slate-200 bg-slate-50 text-slate-600 hover:border-emerald-600/50"}`}
                >
                  {isEs ? type.labelEs : type.labelEn}
                </button>
              ))}
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <Label htmlFor="other-name">{isEs ? "Nombre completo *" : "Full Name *"}</Label>
              <Input id="other-name" required value={name} onChange={(e) => setName(e.target.value)} placeholder={isEs ? "Ej. Juan Pérez" : "e.g. John Smith"} className="mt-1" />
            </div>
            <div>
              <Label htmlFor="other-phone">{isEs ? "Teléfono *" : "Phone *"}</Label>
              <Input id="other-phone" required type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="737-000-0000" className="mt-1" />
            </div>
          </div>

          <div>
            <Label>{isEs ? "¿El patio tiene candado / portón?" : "Does the yard have a lock/gate?"}</Label>
            <div className="mt-1 flex gap-4">
                <Button type="button" variant={hasGate === "yes" ? "default" : "outline"} onClick={() => setHasGate("yes")}>{isEs ? "Sí" : "Yes"}</Button>
                <Button type="button" variant={hasGate === "no" ? "default" : "outline"} onClick={() => setHasGate("no")}>{isEs ? "No" : "No"}</Button>
            </div>
            {hasGate === "yes" && (
                <Input className="mt-2" placeholder={isEs ? "Código o info de acceso" : "Gate code or access info"} value={gateCode} onChange={(e) => setGateCode(e.target.value)} />
            )}
          </div>

          <div>
            <Label htmlFor="other-comments">{isEs ? "Comentarios / Detalles" : "Comments / Work details"}</Label>
            <Textarea id="other-comments" value={comments} onChange={(e) => setComments(e.target.value)} className="mt-1" rows={3} />
          </div>

          {saveError && <p role="alert" className="text-sm text-red-600">{saveError}</p>}
          <Button type="submit" disabled={saving} className="w-full font-bold bg-emerald-600 hover:bg-emerald-700">
            <MessageSquare className="mr-2 size-4" />
            {saving ? (isEs ? "Guardando..." : "Saving...") : (isEs ? "SOLICITAR COTIZACIÓN POR SMS" : "REQUEST QUOTE BY SMS")}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
