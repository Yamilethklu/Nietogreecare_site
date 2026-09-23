import { NextResponse } from "next/server";

export const runtime = "nodejs";

const TEXAS_VIEWBOX = "-106.65,36.5,-93.5,25.8";

type NominatimAddress = {
  house_number?: string;
  road?: string;
  city?: string;
  town?: string;
  village?: string;
  hamlet?: string;
  municipality?: string;
  postcode?: string;
  state?: string;
};

type NominatimResult = {
  osm_id: number;
  osm_type: string;
  display_name: string;
  lat: string;
  lon: string;
  address?: NominatimAddress;
};

/** Proxy ligero para sugerencias de dirección sin cargar Google Places en el Paso 1. */
export async function GET(request: Request) {
  const query = new URL(request.url).searchParams.get("q")?.trim() ?? "";

  if (query.length < 3) return NextResponse.json({ suggestions: [] });

  const url = new URL("https://nominatim.openstreetmap.org/search");
  url.searchParams.set("q", query);
  url.searchParams.set("format", "jsonv2");
  url.searchParams.set("addressdetails", "1");
  url.searchParams.set("limit", "5");
  url.searchParams.set("countrycodes", "us");
  url.searchParams.set("viewbox", TEXAS_VIEWBOX);
  url.searchParams.set("bounded", "1");

  try {
    const response = await fetch(url, {
      cache: "no-store",
      headers: {
        Accept: "application/json",
        "User-Agent": "NietoGreenCareLLC/1.0 (address autocomplete)",
      },
    });

    if (!response.ok) return NextResponse.json({ suggestions: [] });

    const results = (await response.json()) as NominatimResult[];
    const suggestions = results.map((result) => {
      const address = result.address ?? {};
      const street = [address.house_number, address.road].filter(Boolean).join(" ");

      return {
        id: `${result.osm_type}-${result.osm_id}`,
        label: result.display_name,
        address: street || result.display_name.split(",")[0] || query,
        city: address.city ?? address.town ?? address.village ?? address.hamlet ?? address.municipality ?? "",
        zipCode: address.postcode ?? "",
        state: address.state ?? "TX",
        latitude: Number(result.lat),
        longitude: Number(result.lon),
      };
    });

    return NextResponse.json({ suggestions });
  } catch {
    return NextResponse.json({ suggestions: [] });
  }
}