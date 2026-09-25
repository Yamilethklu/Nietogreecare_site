import { NextResponse } from "next/server";
import { getSupabaseAdminClient } from "@/lib/supabase/admin";
import { notifyOwnerOfLead } from "@/lib/notifications";
import { formatZodErrors, leadSubmissionSchema } from "@/lib/validation";

export const runtime = "nodejs";
export async function POST(request: Request) {
  const input = await request.json().catch(() => null);
  const parsed = leadSubmissionSchema.safeParse(input);
  if (!parsed.success) return NextResponse.json({ ok:false, error:"Revise los campos requeridos.", errors:formatZodErrors(parsed.error) }, { status:422 });
  const d=parsed.data; const supabase=getSupabaseAdminClient();
  if (!supabase) return NextResponse.json({ok:false,error:"La conexión de base de datos no está configurada."},{status:503});
  const {data:lead,error}=await supabase.from("leads").insert({
    reference_code:d.referenceCode,address:d.address,formatted_address:d.formattedAddress,zip_code:d.zipCode,city:d.city,state:d.state,place_id:d.placeId,latitude:d.latitude,longitude:d.longitude,
    area_sq_ft:d.areaSqFt,area_sq_yd:d.areaSqYd,estimated_cubic_yards:d.estimatedCubicYards,depth_inches:d.depthInches,polygon:d.polygon,polygon_path:d.polygonPath,snapshot_url:d.snapshotUrl,map_bounds:d.mapBounds,
    has_gate_code:d.hasGateCode,gate_code:d.hasGateCode?d.gateCode:null,requested_date:d.requestedDate,requested_time_window:d.requestedTimeWindow,selected_services:d.selectedServices,service_count:d.selectedServices.length,
    customer_name:d.customerName,customer_phone:d.customerPhone,customer_email:d.customerEmail||null,details:d.details,additional_notes:d.additionalNotes,payment_method:d.paymentMethod,final_price:null
  }).select().single();
  if(error || !lead) return NextResponse.json({ok:false,error:"No se pudo guardar la solicitud."},{status:500});
  const notice=await notifyOwnerOfLead(lead,{adminUrl:`${process.env.NEXT_PUBLIC_SITE_URL||""}/admin`});
  await supabase.from("leads").update({notification_email_sent:notice.emailSent,notification_sms_sent:false,notification_error:notice.errors.join(" | ")||null}).eq("id",lead.id);
  return NextResponse.json({ok:true,data:{id:lead.id,referenceCode:lead.reference_code}});
}
