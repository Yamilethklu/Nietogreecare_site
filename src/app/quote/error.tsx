"use client";

import * as React from "react";
import Link from "next/link";
import { AlertTriangle, ArrowLeft, RefreshCw } from "lucide-react";

import { Button } from "@/components/ui/button";
import { LuxuryCard } from "@/components/ui/card";
import { useQuoteStore } from "@/store/quote-store";

export default function QuoteError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  React.useEffect(() => {
    console.error("Error en el cotizador:", error);
  }, [error]);

  const handleResetAll = () => {
    try {
      useQuoteStore.getState().reset();
    } catch {
      // ignore
    }
    reset();
  };

  return (
    <main className="container flex min-h-dvh max-w-2xl items-center py-16">
      <LuxuryCard className="w-full text-center p-8">
        <div className="mx-auto grid size-16 place-items-center rounded-2xl border border-gold-500/30 bg-gold-500/10">
          <AlertTriangle className="size-8 text-gold-300" />
        </div>
        <h1 className="mt-5 font-display text-2xl font-semibold text-white sm:text-3xl">
          Cotizador interactivo
        </h1>
        <p className="mt-3 text-sm leading-relaxed text-ink-300">
          Ocurrió un inconveniente al cargar el formulario. Puede reintentar la carga o reiniciar los datos para continuar.
        </p>

        <div className="mt-8 flex flex-wrap justify-center gap-3">
          <Button onClick={handleResetAll} variant="gold">
            <RefreshCw className="size-4" />
            Reiniciar cotizador
          </Button>
          <Button asChild variant="outline">
            <Link href="/">
              <ArrowLeft className="size-4" />
              Volver al inicio
            </Link>
          </Button>
        </div>
      </LuxuryCard>
    </main>
  );
}