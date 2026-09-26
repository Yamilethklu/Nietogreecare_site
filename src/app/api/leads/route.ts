import { distanceInMiles, getCentroid, polygonAreaSquareFeet } from "@/lib/geo";
import { matchMowRate } from "@/lib/instant-pricing";
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
  const polygons = d.polygons?.length ? d.polygons : [d.polygon];
  const area = polygons.reduce((total, polygon) => total + polygonAreaSquareFeet(polygon), 0);
  if (d.latitude == null || d.longitude == null || polygons.some((polygon) => {const centroid=getCentroid(polygon);return !centroid || distanceInMiles(centroid,{lat:d.latitude!,lng:d.longitude!}) > 0.25;})) return NextResponse.json({ok:false,error:"El área marcada debe estar junto a la propiedad seleccionada."},{status:422});
  if (!Number.isFinite(area) || area < 100 || area > 250000 || Math.abs(area - d.areaSqFt) / area > 0.04) return NextResponse.json({ok:false,error:"Revise la medición del césped."},{status:422});
  const {data:rules,error:ratesError}=await supabase.from("pricing_rules").select("id,service_key,min_sq_ft,max_sq_ft,price").eq("service_key",`lawn_${d.quoteOptions.mowFrequency}`).eq("is_active",true);
  if (ratesError) return NextResponse.json({ok:false,error:"No se pudieron obtener los precios."},{status:503});
  const rule = matchMowRate(rules ?? [],area,d.quoteOptions.mowFrequency);
  if (!rule) return NextResponse.json({ok:false,error:"Todavía no hay un precio configurado para esta medida y frecuencia. Contáctenos para recibir ayuda."},{status:422});
  const price = Number(rule.price);
  if (Math.abs(price - d.quotedPrice) > 0.001) return NextResponse.json({ok:false,error:"La tarifa cambió desde que abrió el cotizador. Revise el nuevo precio y confirme de nuevo."},{status:409});
  if (!Number.isFinite(price) || price <= 0) return NextResponse.json({ok:false,error:"Tarifa no disponible."},{status:422});
  const {data:lead,error}=await supabase.from("leads").insert({
    reference_code:d.referenceCode,address:d.address,formatted_address:d.formattedAddress,zip_code:d.zipCode,city:d.city,state:d.state,place_id:d.placeId,latitude:d.latitude,longitude:d.longitude,
    area_sq_ft:Math.round(area*100)/100,area_sq_yd:Math.round(area/9*100)/100,estimated_cubic_yards:0,depth_inches:d.depthInches,polygon:polygons,polygon_path:d.polygonPath,snapshot_url:d.snapshotUrl,map_bounds:d.mapBounds,
    has_gate_code:d.hasGateCode,gate_code:d.hasGateCode?d.gateCode:null,requested_date:d.requestedDate,requested_time_window:d.requestedTimeWindow,selected_services:d.selectedServices,service_count:d.selectedServices.length,
    customer_name:d.customerName,customer_phone:d.customerPhone,customer_email:d.customerEmail||null,details:d.details,additional_notes:d.additionalNotes,payment_method:d.paymentMethod === "cash" ? "cash" : "transfer",final_price:price
  }).select().single();
  if(error || !lead) return NextResponse.json({ok:false,error:"No se pudo guardar la solicitud."},{status:500});
  const notice=await notifyOwnerOfLead(lead,{adminUrl:`${process.env.NEXT_PUBLIC_SITE_URL||""}/admin`});
  await supabase.from("leads").update({notification_email_sent:notice.emailSent,notification_sms_sent:false,notification_error:notice.errors.join(" | ")||null}).eq("id",lead.id);
  return NextResponse.json({ok:true,data:{id:lead.id,referenceCode:lead.reference_code,price}});
}
