import type { PricingRule } from '@/lib/types';

export type MowRate = Pick<PricingRule, 'id' | 'service_key' | 'min_sq_ft' | 'max_sq_ft' | 'price'>;
export function matchMowRate(rules: MowRate[], areaSqFt: number, frequency: 'weekly' | 'bi_weekly') {
  if (!Number.isFinite(areaSqFt) || areaSqFt <= 0) return null;
  const configured = rules.find((rule) => rule.service_key === `lawn_${frequency}` && areaSqFt >= Number(rule.min_sq_ft) && (rule.max_sq_ft == null || areaSqFt < Number(rule.max_sq_ft)));
  if (configured && Number(configured.price) > 0) return configured;

  const tiers = [
    { min: 0, max: 2500, price: 30 },
    { min: 2500, max: 3800, price: 35 },
    { min: 3800, max: 4800, price: 40 },
    { min: 4800, max: 6000, price: 45 },
  ];
  const tier = tiers.find((item) => areaSqFt <= item.max && (item.min === 0 || areaSqFt > item.min));
  const price = tier?.price ?? Math.round((45 + (areaSqFt - 6000) * 0.01) * 100) / 100;
  return {
    id: `fallback-${frequency}-${areaSqFt}`,
    service_key: `lawn_${frequency}`,
    min_sq_ft: tier?.min ?? 6000,
    max_sq_ft: tier?.max ?? null,
    price,
  };
}
