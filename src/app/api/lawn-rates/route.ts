import { NextResponse } from 'next/server';
import { getSupabaseAdminClient } from '@/lib/supabase/admin';

export const dynamic = 'force-dynamic';
export async function GET() {
  const db = getSupabaseAdminClient();
  if (!db) return NextResponse.json({ ok: false, error: 'Tarifas no disponibles.' }, { status: 503 });
  const { data, error } = await db.from('pricing_rules').select('id,service_key,min_sq_ft,max_sq_ft,price').in('service_key', ['lawn_weekly','lawn_bi_weekly']).eq('is_active', true).order('min_sq_ft');
  if (error) return NextResponse.json({ ok: false, error: 'Tarifas no disponibles.' }, { status: 503 });
  return NextResponse.json({ ok: true, data: data ?? [] }, { headers: { 'Cache-Control': 'no-store' } });
}
