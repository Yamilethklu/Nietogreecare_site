"use client";

import * as React from "react";
import { MessageSquare, Wrench } from "lucide-react";

import { publicError } from "@/lib/i18n/public-errors";
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
  const [open, setOpen] = React.useState(false);
  const [selectedJobs, setSelectedJobs] = React.useState<string[]>([]);
  const [address, setAddress] = React.useState("");
  const [name, setName] = React.useState("");
  const [phone, setPhone] = React.useState("");
  const [email, setEmail] = React.useState("");
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
    if (address.trim().length < 5) {
      setSaveError(isEs ? "Ingrese la dirección del servicio." : "Enter the service address.");
      return;
    }
    setSaving(true);
    setSaveError("");
    
    const jobNames = selectedJobs.map(key => {
        const job = OTHER_JOB_TYPES.find(j => j.key === key);
        return job ? (isEs ? job.labelEs : job.labelEn) : key;
    }).join(", ");

    const body = [
      `${BUSINESS.name} - ${isEs ? "Cotización de otro servicio" : "Other service quote"}`,
      `${isEs ? "Servicios" : "Services"}: ${jobNames}`,
      `${isEs ? "Dirección" : "Address"}: ${address.trim()}`,
      `${isEs ? "Cliente" : "Customer"}: ${name.trim()}`,
      `${isEs ? "Teléfono" : "Phone"}: ${phone.trim()}`,
      email.trim() ? `${isEs ? "Correo" : "Email"}: ${email.trim()}` : "",
      comments.trim() ? `${isEs ? "Comentarios" : "Comments"}: ${comments.trim()}` : "",
    ]
      .filter(Boolean)
      .join("\n");

    try {
      const response = await fetch("/api/other-services", {method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({services:selectedJobs,name,address,phone,email,comments})});
      const result = await response.json();
      if (!response.ok || !result.ok) throw new Error(publicError(result.error, isEs, isEs ? "No se pudo guardar la solicitud." : "Could not save your request."));
      window.location.href = `${BUSINESS.smsHref}?body=${encodeURIComponent(body)}`;
    } catch (error) {
      setSaveError(error instanceof Error ? error.message : "Error");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card className="border-emerald-500/20 bg-white shadow-sm">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-xl font-bold text-slate-900">
          <Wrench className="size-5 text-emerald-600" />
          {isEs ? "¿Requieres otro servicio?" : "Do you need another service?"}
        </CardTitle>
        <p className="text-sm font-semibold text-slate-600">{isEs ? "Cotiza aquí trabajos diferentes al corte de césped." : "Quote services other than lawn mowing here."}</p>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid gap-2 sm:grid-cols-3">
            {OTHER_JOB_TYPES.map((type) => (
              <button
                key={type.key}
                type="button"
                onClick={() => toggleJob(type.key)}
                className={`rounded-xl border p-3 text-left text-xs font-semibold transition ${selectedJobs.includes(type.key) ? "border-emerald-600 bg-emerald-50 text-emerald-700" : "border-slate-200 bg-slate-50 text-slate-600 hover:border-emerald-600/50"}`}
              >
                {selectedJobs.includes(type.key) ? "✓ " : ""}{isEs ? type.labelEs : type.labelEn}
              </button>
            ))}
          </div>

          {!open && <Button type="button" onClick={() => {
            if (selectedJobs.length === 0) {
              setSaveError(isEs ? "Seleccione al menos un trabajo." : "Select at least one service.");
              return;
            }
            setSaveError("");
            setOpen(true);
          }} className="w-full bg-emerald-600 font-bold hover:bg-emerald-700">{isEs ? "Cotiza aquí" : "Quote here"}</Button>}

          {open && <div className="grid gap-4 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <Label htmlFor="other-address">{isEs ? "Dirección del servicio *" : "Service address *"}</Label>
              <Input id="other-address" required value={address} onChange={(e) => setAddress(e.target.value)} placeholder={isEs ? "Dirección completa" : "Full address"} className="mt-1" />
            </div>
            <div>
              <Label htmlFor="other-name">{isEs ? "Nombre completo *" : "Full Name *"}</Label>
              <Input id="other-name" required value={name} onChange={(e) => setName(e.target.value)} placeholder={isEs ? "Ej. Juan Pérez" : "e.g. John Smith"} className="mt-1" />
            </div>
            <div>
              <Label htmlFor="other-phone">{isEs ? "Teléfono *" : "Phone *"}</Label>
              <Input id="other-phone" required type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="737-000-0000" className="mt-1" />
            </div>
            <div className="sm:col-span-2">
              <Label htmlFor="other-email">{isEs ? "Correo" : "Email"}</Label>
              <Input id="other-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="cliente@email.com" className="mt-1" />
            </div>
          </div>}

          {open && <div>
            <Label htmlFor="other-comments">{isEs ? "Comentarios / Detalles" : "Comments / Work details"}</Label>
            <Textarea id="other-comments" value={comments} onChange={(e) => setComments(e.target.value)} className="mt-1" rows={3} />
          </div>}

          {saveError && <p role="alert" className="text-sm text-red-600">{saveError}</p>}
          {open && <Button type="submit" disabled={saving} className="w-full font-bold bg-emerald-600 hover:bg-emerald-700">
            <MessageSquare className="mr-2 size-4" />
            {saving ? (isEs ? "Abriendo SMS..." : "Opening SMS...") : (isEs ? "Cotizar" : "Quote")}
          </Button>}
        </form>
      </CardContent>
    </Card>
  );
}
