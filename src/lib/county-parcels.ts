import { COUNTY_BY_CITY, COUNTY_BY_ZIP, ZIP_CITY_MAP, type CountyName } from "./constants";

/** Servicios ArcGIS públicos de catastro (capa de parcelas, consulta por punto). */
export const COUNTY_PARCEL_SERVICES: Partial<Record<CountyName, string>> = {
  Williamson: "https://gis.wilco.org/arcgis/rest/services/public/county_wcad_parcels/MapServer/0/query",
  Travis: "https://gis.traviscountytx.gov/server1/rest/services/Boundaries_and_Jurisdictions/TCAD_public/MapServer/0/query",
};

const KNOWN_COUNTIES: CountyName[] = ["Williamson", "Travis", "Hays", "Bastrop", "Burnet"];

/** Normaliza "Williamson County" / "travis" al nombre de condado conocido. */
export function normalizeCounty(value?: string | null): CountyName | null {
  const name = String(value ?? "").replace(/\bcounty\b/i, "").trim().toLowerCase();
  return KNOWN_COUNTIES.find((county) => county.toLowerCase() === name) ?? null;
}

/** Orden de consulta: condado de Google, luego ZIP/ciudad, luego los demás catastros disponibles. */
export function countyLookupOrder(input: { county?: string | null; zip?: string | null; city?: string | null }): CountyName[] {
  const zip = String(input.zip ?? "").trim().slice(0, 5);
  const city = String(input.city ?? "").trim() || ZIP_CITY_MAP[zip] || "";
  const preferred = [normalizeCounty(input.county), COUNTY_BY_ZIP[zip], COUNTY_BY_CITY[city]].filter((county): county is CountyName => Boolean(county));
  const available = Object.keys(COUNTY_PARCEL_SERVICES) as CountyName[];
  return [...new Set([...preferred, ...available])].filter((county) => COUNTY_PARCEL_SERVICES[county]);
}

type GeocodeComponent = { long_name?: string; short_name?: string; types?: string[] };

export function extractLocality(components: GeocodeComponent[] | undefined) {
  const find = (type: string) => components?.find((component) => component.types?.includes(type))?.long_name;
  return {
    county: find("administrative_area_level_2") ?? null,
    zip: find("postal_code") ?? null,
    city: find("locality") ?? null,
  };
}
