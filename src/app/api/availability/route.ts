import { NextResponse } from "next/server";

import { getSupabaseAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const month = new URL(request.url).searchParams.get("month") ?? "";
  const match = /^(\d{4})-(0[1-9]|1[0-2])$/.exec(month);
  if (!match) return NextResponse.json({ ok: false, error: "Mes inválido." }, { status: 400 });

  const year = Number(match[1]);
  const monthNumber = Number(match[2]);
  const nextMonth = monthNumber === 12 ? `${year + 1}-01` : `${year}-${String(monthNumber + 1).padStart(2, "0")}`;
  const db = getSupabaseAdminClient();
  if (!db) return NextResponse.json({ ok: false, error: "Disponibilidad no disponible." }, { status: 503 });

  const { data, error } = await db
    .from("leads")
    .select("requested_date")
    .gte("requested_date", `${month}-01`)
    .lt("requested_date", `${nextMonth}-01`)
    .neq("status", "cancelled")
    .not("requested_date", "is", null);

  if (error) return NextResponse.json({ ok: false, error: "No se pudo consultar la disponibilidad." }, { status: 503 });
  return NextResponse.json(
    { ok: true, occupiedDates: [...new Set((data ?? []).map((lead) => lead.requested_date).filter(Boolean))] },
    { headers: { "Cache-Control": "no-store" } },
  );
}