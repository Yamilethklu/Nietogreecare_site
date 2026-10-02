import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/admin-api';
import { getSupabaseAdminClient } from '@/lib/supabase/admin';
import { invoicePDF } from '@/lib/operations/invoice';
import { loadInvoiceGroup } from '@/lib/operations/invoice-group';
export const runtime='nodejs';
export async function GET(request:Request){
 const gate=await requireAdmin(request);if(gate.response)return gate.response;
 const id=new URL(request.url).searchParams.get('id');
 if(!id||!/^[a-f0-9-]{36}$/i.test(id))return NextResponse.json({ok:false,error:'Factura inválida.'},{status:422});
 const db=getSupabaseAdminClient();if(!db)return NextResponse.json({ok:false,error:'Base de datos no disponible.'},{status:503});
 const entry=await loadInvoiceGroup(db,id);if(!entry)return NextResponse.json({ok:false,error:'Factura no encontrada.'},{status:404});
 const order={...entry.orders[0],paid_amount:entry.orders.reduce((sum,row)=>sum+Number(row.paid_amount),0)};
 const lines=entry.orders.map(row=>({date:row.service_date,description:row.notes?.includes('Bag Grass (+$10): Sí')?'Lawn service + Bag Grass':'Lawn / yard service',total:Number(entry.invoices.find(i=>i.order_id===row.id)!.total)}));
 const bytes=await invoicePDF(entry.invoice,order,entry.lead,lines);
 return new Response(Buffer.from(bytes),{headers:{'Content-Type':'application/pdf','Content-Disposition':`attachment; filename="${entry.invoice.invoice_number}.pdf"`,'Cache-Control':'private, no-store'}});
}
