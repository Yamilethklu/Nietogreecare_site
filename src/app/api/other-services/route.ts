import { NextResponse } from "next/server";
import { z } from "zod";

import { notifyOwnerOfLead } from "@/lib/notifications";
import { getSupabaseAdminClient } from "@/lib/supabase/admin";
import { buildReferenceCode } from "@/lib/utils";
import { phoneSchema } from "@/lib/validation";

export const runtime = "nodejs";

const requestSchema = z.object({
  jobType: z.enum(["bush_trimming", "mulch_installation", "yard_cleanups", "tree_services", "landscaping"]),
  name: z.string().trim().min(2).max(120),
  address: z.string().trim().min(5).max(300),
  phone: phoneSchema,
  comments: z.string().trim().max(2000).default(""),
});

const labels: Record<z.infer<typeof requestSchema>["jobType"], string> = {
  bush_trimming: "Bush Trimming",
  mulch_installation: "Mulch Installation",
  yard_cleanups: "Yard Cleanups",
  tree_services: "Tree Services",
  landscaping: "Landscaping",
};

export async function POST(request: Request) {
  const input = await request.json().catch(() => null);
  const parsed = requestSchema.safeParse(input);
  if (!parsed.success) return NextResponse.json({ ok: false, error: "Revise los datos del trabajo." }, { status: 422 });
  const db = getSupabaseAdminClient();
  if (!db) return NextResponse.json({ ok: false, error: "No se pudo conectar al panel." }, { status: 503 });

  const data = parsed.data;
  const label = labels[data.jobType];
  const zipCode = data.address.match(/\b\d{5}(?:-\d{4})?\b/)?.[0]?.slice(0, 5) ?? "";
  const { data: lead, error } = await db.from("leads").insert({
    reference_code: buildReferenceCode(),
    address: data.address,
    formatted_address: data.address,
    zip_code: zipCode,
    selected_services: [label],
    service_count: 1,
    customer_name: data.name,
    customer_phone: data.phone,
    details: `${label}: visita para estimado en persona; sin precio en línea.`,
    additional_notes: data.comments,
    source: "website",
  }).select().single();

  if (error || !lead) return NextResponse.json({ ok: false, error: "No se pudo registrar la solicitud." }, { status: 500 });
  const notice = await notifyOwnerOfLead(lead, { adminUrl: `${process.env.NEXT_PUBLIC_SITE_URL || ""}/admin` });
  await db.from("leads").update({ notification_email_sent: notice.emailSent, notification_error: notice.errors.join(" | ") || null }).eq("id", lead.id);
  return NextResponse.json({ ok: true, referenceCode: lead.reference_code });
}
