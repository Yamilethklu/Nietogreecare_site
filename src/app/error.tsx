"use client";

import * as React from "react";
import Link from "next/link";
import { AlertTriangle, ArrowLeft, RefreshCw } from "lucide-react";

import { Button } from "@/components/ui/button";
import { LuxuryCard } from "@/components/ui/card";

export default function GlobalErrorPage({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  React.useEffect(() => {
    console.error("Excepción en la aplicación:", error);
  }, [error]);

  return (
    <main className="container flex min-h-dvh max-w-2xl items-center py-16">
      <LuxuryCard className="w-full text-center p-8">
        <div className="mx-auto grid size-16 place-items-center rounded-2xl border border-gold-500/30 bg-gold-500/10">
          <AlertTriangle className="size-8 text-gold-300" />
        </div>
        <h1 className="mt-5 font-display text-2xl font-semibold text-white sm:text-3xl">
          Nieto Green Care LLC
        </h1>
        <p className="mt-3 text-sm leading-relaxed text-ink-300">
          No pudimos procesar la vista solicitada. Presione reintentar o vuelva a la página principal.
        </p>

        <div className="mt-8 flex flex-wrap justify-center gap-3">
          <Button onClick={() => reset()} variant="gold">
            <RefreshCw className="size-4" />
            Reintentar
          </Button>
          <Button asChild variant="outline">
            <Link href="/">
              <ArrowLeft className="size-4" />
              Inicio
            </Link>
          </Button>
        </div>
      </LuxuryCard>
    </main>
  );
}