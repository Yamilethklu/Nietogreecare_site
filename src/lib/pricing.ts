/**
 * Reglas de precios y capacidad.
 * Los datos base viven en Supabase (tabla public.pricing_rules); estas constantes
 * son el espejo para calculos offline en el cliente y para el seed inicial.
 */

import { DEFAULT_DEPTH_INCHES, SERVICE_MAP, SERVICES } from "./constants";
import {
  cubicYardsFromArea,
  squareFeetToSquareYards,
  toNumberSafe,
} from "./geo";

export type PricingRuleLike = {
  id?: string;
  name: string;
  service_key?: string | null;
  min_sq_ft: number | string;
  max_sq_ft: number | string | null;
  price: number | string;
  price_per_sq_ft?: number | string | null;
  price_per_cubic_yard?: number | string | null;
  default_depth_inches?: number | string;
  capacity_per_day?: number;
  duration_minutes?: number;
  is_active?: boolean;
  notes?: string | null;
};

const SERVICE_FEE_BY_KEY: Record<string, number> = {
  weekly_biweekly_lawn_service: 80,
  tree_trimming: 120,
  sod_installation: 180,
  flower_beds: 95,
  fertilizer: 70,
  gravel_rock_installation: 140,
  metal_edging: 110,
  mulch: 90,
  yard_cleanup: 100,
  top_soil: 135,
};

const SERVICE_FREQUENCY_MULTIPLIER = {
  one_time: 1,
  weekly: 1,
  biweekly: 0.75,
} as const;

/** Espejo del seed de /supabase/schema.sql (usado si Supabase no esta disponible). */
export const FALLBACK_PRICING_RULES: PricingRuleLike[] = [
  {
    name: "Hasta 2,000 sq ft",
    service_key: "mowing",
    min_sq_ft: 0,
    max_sq_ft: 2000,
    price: 45,
    price_per_sq_ft: 0.035,
    price_per_cubic_yard: 42,
    default_depth_inches: 2,
    capacity_per_day: 6,
    duration_minutes: 45,
    is_active: true,
  },
  {
    name: "2,000 a 5,000 sq ft",
    service_key: "mowing",
    min_sq_ft: 2000,
    max_sq_ft: 5000,
    price: 75,
    price_per_sq_ft: 0.025,
    price_per_cubic_yard: 40,
    default_depth_inches: 2,
    capacity_per_day: 5,
    duration_minutes: 60,
    is_active: true,
  },
  {
    name: "5,000 a 10,000 sq ft",
    service_key: "mowing",
    min_sq_ft: 5000,
    max_sq_ft: 10000,
    price: 125,
    price_per_sq_ft: 0.018,
    price_per_cubic_yard: 38,
    default_depth_inches: 2,
    capacity_per_day: 4,
    duration_minutes: 90,
    is_active: true,
  },
  {
    name: "10,000 a 20,000 sq ft",
    service_key: "mowing",
    min_sq_ft: 10000,
    max_sq_ft: 20000,
    price: 210,
    price_per_sq_ft: 0.013,
    price_per_cubic_yard: 36,
    default_depth_inches: 2,
    capacity_per_day: 3,
    duration_minutes: 120,
    is_active: true,
  },
  {
    name: "Mas de 20,000 sq ft",
    service_key: "mowing",
    min_sq_ft: 20000,
    max_sq_ft: null,
    price: 320,
    price_per_sq_ft: 0.01,
    price_per_cubic_yard: 34,
    default_depth_inches: 2,
    capacity_per_day: 2,
    duration_minutes: 180,
    is_active: true,
  },
];

/** Busca la regla cuyo rango [min, max] contiene los pies cuadrados medidos. */
export function matchPricingRule(
  rules: PricingRuleLike[],
  squareFeet: number,
): PricingRuleLike | null {
  const active = (rules ?? []).filter((rule) => rule.is_active !== false);
  if (active.length === 0) return null;

  const ordered = [...active].sort(
    (a, b) => toNumberSafe(a.min_sq_ft) - toNumberSafe(b.min_sq_ft),
  );

  const found = ordered.find((rule) => {
    const min = toNumberSafe(rule.min_sq_ft);
    const max =
      rule.max_sq_ft === null || rule.max_sq_ft === undefined
        ? Number.POSITIVE_INFINITY
        : toNumberSafe(rule.max_sq_ft);
    return squareFeet >= min && squareFeet < max;
  });

  if (found) return found;

  // Fuera de rango: devolver la regla mas cercana (la ultima si supera el maximo).
  return squareFeet >= toNumberSafe(ordered[ordered.length - 1].min_sq_ft)
    ? ordered[ordered.length - 1]
    : ordered[0];
}

export type EstimateInput = {
  squareFeet: number;
  services: string[];
  depthInches?: number;
  rules?: PricingRuleLike[];
  travelFee?: number;
  frequency?: "weekly" | "biweekly" | "one_time";
};

export type EstimateBreakdownItem = {
  key: string;
  label: string;
  amount: number;
};

export type EstimateResult = {
  price: number;
  range: { min: number; max: number };
  squareFeet: number;
  squareYards: number;
  cubicYards: number;
  depthInches: number;
  matchedRule: PricingRuleLike | null;
  breakdown: EstimateBreakdownItem[];
};

function normalizeSelectedServices(services: string[]): string[] {
  const seen = new Set<string>();
  return (services ?? []).filter((key) => {
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

/**
 * Estima el precio combinando:
 *  - la regla de rango de pies cuadrados (servicio base de corte)
 *  - el catalogo de servicios seleccionados (precio base de cada uno)
 */
export function estimateQuote({
  squareFeet,
  services,
  depthInches = DEFAULT_DEPTH_INCHES,
  rules = FALLBACK_PRICING_RULES,
  travelFee = 0,
  frequency = "weekly",
}: EstimateInput): EstimateResult {
  const safeSqFt = Math.max(0, toNumberSafe(squareFeet));
  const matchedRule = matchPricingRule(rules, safeSqFt) ?? FALLBACK_PRICING_RULES[0];
  const breakdown: EstimateBreakdownItem[] = [];
  const selectedServices = normalizeSelectedServices(services ?? []);

  const baseByArea =
    toNumberSafe(matchedRule.price) || safeSqFt * toNumberSafe(matchedRule.price_per_sq_ft, 0.02);

  breakdown.push({ key: "area", label: matchedRule.name, amount: Math.round(baseByArea) });

  const serviceCost = selectedServices.reduce((total, key) => {
    const definition = SERVICE_MAP[key] ?? null;
    const fallbackPrice = SERVICE_FEE_BY_KEY[key] ?? 0;
    const amount = definition ? fallbackPrice || 0 : fallbackPrice;
    if (!amount) return total;
    breakdown.push({
      key: `service:${key}`,
      label: definition?.nameEs ?? definition?.nameEn ?? key,
      amount,
    });
    return total + amount;
  }, 0);

  if (travelFee > 0) {
    breakdown.push({ key: "travel", label: "Recargo por distancia", amount: travelFee });
  }

  const frequencyMultiplier = SERVICE_FREQUENCY_MULTIPLIER[frequency] ?? 1;
  const subtotal = breakdown.reduce((total, item) => total + item.amount, 0);
  const price = Math.round(subtotal * frequencyMultiplier);

  return {
    price,
    range: { min: Math.round(price * 0.92), max: Math.round(price * 1.15) },
    squareFeet: Math.round(safeSqFt),
    squareYards: Number(squareFeetToSquareYards(safeSqFt).toFixed(1)),
    cubicYards: Number(cubicYardsFromArea(safeSqFt, depthInches).toFixed(2)),
    depthInches,
    matchedRule,
    breakdown,
  };
}

/** Capacidad diaria disponible segun la regla aplicada. */
export function dailyCapacity(rules: PricingRuleLike[], squareFeet: number): number {
  const rule = matchPricingRule(rules, squareFeet);
  return rule?.capacity_per_day ?? 4;
}

/** Duracion estimada del trabajo en minutos. */
export function estimatedDurationMinutes(rules: PricingRuleLike[], squareFeet: number): number {
  const rule = matchPricingRule(rules, squareFeet);
  const base = rule?.duration_minutes ?? 90;
  const extra = Math.max(0, (rule?.capacity_per_day ?? 4) - 1) * 5;
  return base + extra;
}

export const SERVICE_KEYS = SERVICES.map((service) => service.key);
