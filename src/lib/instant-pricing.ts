import type { PricingRule } from '@/lib/types';

export type MowRate = Pick<PricingRule, 'id' | 'service_key' | 'min_sq_ft' | 'max_sq_ft' | 'price'>;
export function matchMowRate(rules: MowRate[], areaSqFt: number, frequency: 'weekly' | 'bi_weekly') {
  if (!Number.isFinite(areaSqFt) || areaSqFt <= 0) return null;
  return rules.find((rule) => rule.service_key === `lawn_${frequency}` && areaSqFt >= Number(rule.min_sq_ft) && (rule.max_sq_ft == null || areaSqFt < Number(rule.max_sq_ft))) ?? null;
}
