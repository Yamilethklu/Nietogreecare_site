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

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const selectedJob = OTHER_JOB_TYPES.find((j) => j.key === jobType);
    const jobName = selectedJob ? (isEs ? selectedJob.labelEs : selectedJob.labelEn) : jobType;

    const body = [
      `Solicitud de Otros Servicios (${jobName})`,
      `Nombre: ${name}`,
      `Dirección: ${address}`,
      `Teléfono: ${phone}`,
      comments ? `Comentarios: ${comments}` : "",
    ]
      .filter(Boolean)
      .join("\n");

    const smsUrl = buildOwnerSmsHref(address || "Austin, TX", body);
    window.location.href = smsUrl;
  };

  return (
    <Card className="border-gold-500/20 bg-ink-950/90 shadow-luxury">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-xl font-bold text-white">
          <Wrench className="size-5 text-gold-400" />
          {isEs ? "Solicitar otros servicios de jardinería" : "Request other landscaping services"}
        </CardTitle>
        <p className="text-xs text-ink-300">
          {isEs
            ? "¿Necesitas poda de arbustos, mulch, limpieza o árboles? Solicita tu presupuesto directo por SMS."
            : "Need bush trimming, mulch, cleanups, or tree work? Get a direct quote via SMS."}
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
                      ? "border-gold-400 bg-gold-500/10 text-gold-200"
                      : "border-white/10 bg-black/40 text-ink-300 hover:border-white/20"
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

          <Button type="submit" variant="gold" className="w-full font-bold">
            <MessageSquare className="mr-2 size-4" />
            {isEs ? "SOLICITAR COTIZACIÓN POR SMS" : "REQUEST SMS QUOTE"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
