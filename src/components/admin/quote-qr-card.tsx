"use client";

import * as React from "react";
import QRCode from "qrcode";
import { Download, LoaderCircle, QrCode } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

const QUOTE_URL = "https://nietogreecare-site.vercel.app/quote";
const QR_OPTIONS = {
  errorCorrectionLevel: "H" as const,
  margin: 2,
  color: { dark: "#1B4332", light: "#FFFFFFFF" },
};

/** QR de alta resolución para las tarjetas de presentación del cotizador. */
export function QuoteQrCard() {
  const [preview, setPreview] = React.useState<string | null>(null);
  const [error, setError] = React.useState("");
  const [downloading, setDownloading] = React.useState(false);

  React.useEffect(() => {
    let active = true;
    QRCode.toDataURL(QUOTE_URL, { ...QR_OPTIONS, width: 640 })
      .then((url) => { if (active) setPreview(url); })
      .catch(() => { if (active) setError("No se pudo generar la vista previa del código QR."); });
    return () => { active = false; };
  }, []);

  const download = async () => {
    try {
      setDownloading(true);
      setError("");
      const dataUrl = await QRCode.toDataURL(QUOTE_URL, { ...QR_OPTIONS, width: 2048 });
      const link = document.createElement("a");
      link.href = dataUrl;
      link.download = "nieto-green-care-cotizador-qr-2048px.png";
      document.body.appendChild(link);
      link.click();
      link.remove();
    } catch {
      setError("No se pudo descargar el código QR. Inténtelo nuevamente.");
    } finally {
      setDownloading(false);
    }
  };

  return (
    <Card className="mx-auto max-w-2xl overflow-hidden">
      <CardHeader className="items-center border-b border-gold-500/20 bg-gradient-to-br from-forest-950 to-ink-950 text-center">
        <span className="grid size-12 place-items-center rounded-xl border border-gold-500/40 bg-[#1B4332] text-gold-200">
          <QrCode className="size-6" />
        </span>
        <CardTitle className="mt-3">Nieto Green Care LLC</CardTitle>
        <p className="text-sm text-ink-300">Código QR oficial para acceder al cotizador.</p>
      </CardHeader>
      <CardContent className="flex flex-col items-center p-6 text-center sm:p-8">
        <div className="rounded-2xl bg-white p-4 shadow-[0_0_0_1px_rgba(201,162,39,0.35)]">
          {preview ? <img src={preview} alt="Código QR para el cotizador de Nieto Green Care LLC" className="size-64 sm:size-72" /> : <div className="grid size-64 place-items-center text-[#1B4332] sm:size-72"><LoaderCircle className="size-8 animate-spin" /></div>}
        </div>
        <p className="mt-5 text-sm font-medium text-white">Escanee para solicitar una cotización</p>
        <p className="mt-1 break-all text-xs text-ink-400">{QUOTE_URL}</p>
        {error ? <p className="mt-4 text-sm text-red-300">{error}</p> : null}
        <Button type="button" className="mt-6" size="lg" onClick={() => void download()} disabled={downloading}>
          {downloading ? <LoaderCircle className="animate-spin" /> : <Download />}
          Descargar QR para Impresión (PNG High-Res)
        </Button>
        <p className="mt-3 text-xs text-ink-400">Archivo PNG de 2048 × 2048 px con alta corrección de errores.</p>
      </CardContent>
    </Card>
  );
}