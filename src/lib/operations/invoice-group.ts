import type { WorkInvoice, WorkOrder } from './types';
import type { OpsDB } from './server';

// A group shares a UUID prefix; each visit keeps its existing unique invoice row.
export function invoiceGroupKey(number:string) {
  return /^NGC-G-[a-f0-9-]{36}\//.test(number) ? number.split('/')[0] : number;
}
export async function loadInvoiceGroup(db:OpsDB,id:string) {
  const {data:invoice,error}=await db.from('work_invoices').select('*').eq('id',id).single();
  if(error||!invoice) return null;
  const key=invoiceGroupKey(invoice.invoice_number);
  const {data:rows,error:groupError}=await db.from('work_invoices').select('*').like('invoice_number',key.startsWith('NGC-G-')?`${key}/%`:key);
  if(groupError||!rows?.length) return null;
  const {data:orders,error:orderError}=await db.from('work_orders').select('*').in('id',rows.map(row=>row.order_id)).order('service_date');
  if(orderError||orders?.length!==rows.length) return null;
  const {data:lead}=await db.from('leads').select('*').eq('id',orders[0].lead_id).single();
  if(!lead)return null;
  const invoices=rows as WorkInvoice[];
  return {invoices,orders:orders as WorkOrder[],lead,invoice:{...invoice,invoice_number:key,total:invoices.reduce((sum,row)=>sum+Number(row.total),0)} as WorkInvoice};
}
