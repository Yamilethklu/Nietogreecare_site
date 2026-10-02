import { NextResponse } from "next/server";
import { z } from "zod";

import { notifyOwnerOfLead } from "@/lib/notifications";
import { getSupabaseAdminClient } from "@/lib/supabase/admin";
import { buildReferenceCode } from "@/lib/utils";
import { phoneSchema } from "@/lib/validation";

export const runtime = "nodejs";

const requestSchema = z.object({
  services: z.array(z.enum(["tree_bush", "sod", "flowers", "fertilizer", "gravel", "metal_edging", "mulch", "cleanup", "top_soil"])).min(1).max(9),
  name: z.string().trim().min(2).max(120),
  address: z.string().trim().min(5).max(300),
  phone: phoneSchema,
  email: z.string().trim().email().or(z.literal("")).default(""),
  comments: z.string().trim().max(2000).default(""),
});

const labels: Record<string, string> = {
  tree_bush:"Tree & Bush Trimming", sod:"Sod Installation", flowers:"Flower Beds", fertilizer:"Fertilizer", gravel:"Gravel & Rock Installation", metal_edging:"Metal Edging", mulch:"Mulch Installation", cleanup:"Yard Clean Up", top_soil:"Top Soil",
};

export async function POST(request: Request) {
  const input = await request.json().catch(() => null);
  const parsed = requestSchema.safeParse(input);
  if (!parsed.success) return NextResponse.json({ ok: false, error: "Revise los datos del trabajo." }, { status: 422 });
  const db = getSupabaseAdminClient();
  if (!db) return NextResponse.json({ ok: false, error: "No se pudo conectar al panel." }, { status: 503 });

  const data = parsed.data;
  const services = [...new Set(data.services)].map(key => labels[key]);
  const label = services.join(", ");
  const zipCode = data.address.match(/\b\d{5}(?:-\d{4})?\b/)?.[0]?.slice(0, 5) ?? "";
  const { data: lead, error } = await db.from("leads").insert({
    reference_code: buildReferenceCode(),
    address: data.address,
    formatted_address: data.address,
    zip_code: zipCode,
    selected_services: services,
    service_count: services.length,
    customer_name: data.name,
    customer_phone: data.phone,
    customer_email: data.email || null,
    details: `${label}: visita para estimado en persona; sin precio en línea.`,
    additional_notes: data.comments,
    source: "website",
  }).select().single();

  if (error || !lead) return NextResponse.json({ ok: false, error: "No se pudo registrar la solicitud." }, { status: 500 });
  const notice = await notifyOwnerOfLead(lead, { adminUrl: `${process.env.NEXT_PUBLIC_SITE_URL || ""}/admin` });
  await db.from("leads").update({ notification_email_sent: notice.emailSent, notification_error: notice.errors.join(" | ") || null }).eq("id", lead.id);
  return NextResponse.json({ ok: true, referenceCode: lead.reference_code });
}
