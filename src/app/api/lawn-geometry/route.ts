import { NextResponse } from "next/server";

export const runtime = "nodejs";

function mapDetectError(error: string | undefined, status: number): string {
  if (error === "geocode_not_found") return "Google Maps no pudo geocodificar esta dirección.";
  if (error === "lawn_detection_unavailable" && status >= 500) {
    return "No se pudo consultar la geometría catastral para esta dirección.";
  }
  if (error === "lawn_detection_unavailable") return "No está configurada la geocodificación de Google Maps.";
  if (error === "lawn_detection_failed") return "No se pudo obtener la geometría catastral de esta dirección.";
  return error || "No se pudo obtener la geometría catastral de esta dirección.";
}

export async function POST(request: Request) {
  const input = await request.json().catch(() => null);
  const address = typeof input?.address === "string" ? input.address.trim() : "";
  const zipCode = typeof input?.zipCode === "string" ? input.zipCode.trim() : "";
  if (address.length < 5) return NextResponse.json({ error: "Ingrese una dirección válida." }, { status: 400 });

  const detectAddress = [address, zipCode].filter(Boolean).join(", ");
  const detectUrl = new URL("/api/lawn-detect", request.url);
  detectUrl.searchParams.set("address", detectAddress);

  try {
    const detectResponse = await fetch(detectUrl, { cache: "no-store" });
    const payload = await detectResponse.json().catch(() => ({}));
    if (!detectResponse.ok || payload?.ok !== true) {
      return NextResponse.json(
        { error: mapDetectError(payload?.error, detectResponse.status), warning: payload?.warning },
        { status: detectResponse.status || 502 },
      );
    }

    return NextResponse.json({
      poligonoJardin: payload.poligonoJardin,
      areaMetros: payload.areaMetros,
      areaPies: payload.areaPies,
      centro: payload.centro,
      huellaCasaSimulada: payload.huellaCasaSimulada,
      warning: payload.warning,
    });
  } catch {
    return NextResponse.json({ error: "No se pudo obtener la geometría catastral de esta dirección." }, { status: 502 });
  }
}