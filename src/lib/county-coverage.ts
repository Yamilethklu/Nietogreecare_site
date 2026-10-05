import { SERVICE_CITIES } from "./constants";

export type CountyKey = "williamson" | "travis" | "hays" | "bell" | "burnet";

/** Condado por ciudad de servicio (Texas). Ciudades que cruzan condados listan el principal. */
export const CITY_COUNTY_MAP: Record<(typeof SERVICE_CITIES)[number], CountyKey> = {
  Austin: "travis",
  "Liberty Hill": "williamson",
  "Cedar Park": "williamson",
  Leander: "williamson",
  Georgetown: "williamson",
  Hutto: "williamson",
  "Round Rock": "williamson",
  Jarrell: "williamson",
};

const COUNTY_NAMES: Record<string, CountyKey> = {
  williamson: "williamson",
  travis: "travis",
  hays: "hays",
  bell: "bell",
  burnet: "burnet",
};

/** Condados con ZIP de Austin (Travis) y el resto del área atendida (Williamson). */
export function countyFromGeocodeName(name?: string | null): CountyKey | null {
  const key = (name ?? "").toLowerCase().replace(/\s*county\s*$/, "").trim();
  return COUNTY_NAMES[key] ?? null;
}

export function countyFromCity(city?: string | null): CountyKey | null {
  const match = SERVICE_CITIES.find((candidate) => candidate.toLowerCase() === (city ?? "").trim().toLowerCase());
  return match ? CITY_COUNTY_MAP[match] : null;
}

/** Orden de consulta de catastro público: condado detectado primero, luego el resto. */
export function parcelLookupOrder(detected: CountyKey | null): CountyKey[] {
  const all: CountyKey[] = ["williamson", "travis"];
  return detected && all.includes(detected) ? [detected, ...all.filter((county) => county !== detected)] : all;
}
