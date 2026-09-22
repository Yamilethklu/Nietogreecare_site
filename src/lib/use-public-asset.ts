"use client";

import * as React from "react";

export type PublicAssetStatus = "checking" | "ready" | "missing";

/**
 * Comprueba si un archivo servido desde /public esta disponible antes de
 * renderizarlo. Permite degradar con elegancia (fondo vectorial o monograma)
 * cuando un asset oficial aun no se ha publicado, evitando imagenes rotas.
 */
export function usePublicAsset(src: string): PublicAssetStatus {
  const [status, setStatus] = React.useState<PublicAssetStatus>("checking");

  React.useEffect(() => {
    let active = true;
    setStatus("checking");

    const probe = new window.Image();
    probe.onload = () => {
      if (active) setStatus("ready");
    };
    probe.onerror = () => {
      if (active) setStatus("missing");
    };
    probe.src = src;

    return () => {
      active = false;
    };
  }, [src]);

  return status;
}
