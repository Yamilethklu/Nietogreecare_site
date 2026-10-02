import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';
import { BUSINESS } from '@/lib/constants';
import type { OpsLead, WorkInvoice, WorkOrder } from './types';
export type InvoiceLine={date:string;description:string;total:number};
const money=(value:number|string)=>new Intl.NumberFormat('en-US',{style:'currency',currency:'USD'}).format(Number(value));
const safe=(text:string)=>text.normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^\x20-\x7e]/g,' ').slice(0,125);
const escapeHtml=(value:string)=>value.replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]??char));
export async function invoicePDF(invoice:WorkInvoice,order:WorkOrder,lead:OpsLead,lines:InvoiceLine[]=[{date:order.service_date,description:'Lawn / yard service',total:Number(invoice.total)}]){
 const pdf=await PDFDocument.create();let page=pdf.addPage([612,792]);
 const font=await pdf.embedFont(StandardFonts.Helvetica),bold=await pdf.embedFont(StandardFonts.HelveticaBold);
 const green=rgb(.06,.43,.25),dark=rgb(.1,.15,.12);
 const write=(text:string,x:number,y:number,size=11,heavy=false)=>page.drawText(safe(text),{x,y,size,font:heavy?bold:font,color:dark});
 page.drawRectangle({x:0,y:740,width:612,height:52,color:green});
 page.drawText('NIETO GREEN CARE LLC',{x:40,y:758,size:18,font:bold,color:rgb(1,1,1)});
 write('SERVICE INVOICE',40,696,23,true);write(invoice.invoice_number,40,674,10);
 write(`Issue date: ${invoice.issued_at.slice(0,10)}`,40,652);
 write(`Bill to: ${lead.customer_name}`,40,615,13,true);write(lead.address,40,596);
 write(`${lead.city??''} TX ${lead.zip_code}`,40,578);write(`Contact: ${lead.customer_email??lead.customer_phone}`,40,560);
 let y=520;
 for(const line of lines){
  if(y<170){page=pdf.addPage([612,792]);y=730;write('SERVICE DETAILS (continued)',40,y,13,true);y-=30;}
  write(line.date,40,y);write(line.description,125,y,10);write(money(line.total),490,y);y-=24;
 }
 if(y<190){page=pdf.addPage([612,792]);y=710;}
 y-=20;write(`Service total: ${money(invoice.total)}`,330,y,12,true);
 y-=24;write(`Payment received: ${money(order.paid_amount)}`,330,y);
 y-=24;write(`Balance due: ${money(Math.max(0,Number(invoice.total)-Number(order.paid_amount)))}`,330,y,12,true);
 write(`Questions? ${BUSINESS.phoneDisplay} | ${BUSINESS.email}`,40,60,10);
 return await pdf.save();
}
export function invoiceEmail(invoice:WorkInvoice,order:WorkOrder,lead:OpsLead,lines:InvoiceLine[]=[{date:order.service_date,description:'Lawn / yard service',total:Number(invoice.total)}]){
 return `<div style="font-family:Arial,sans-serif;color:#10251a;line-height:1.6"><h2>Nieto Green Care LLC · Invoice ${escapeHtml(invoice.invoice_number)}</h2><p>Hello ${escapeHtml(lead.customer_name)},</p><p>Your service invoice for ${escapeHtml(lead.address)} is attached.</p><table><thead><tr><th>Date</th><th>Service</th><th>Amount</th></tr></thead><tbody>${lines.map(line=>`<tr><td>${escapeHtml(line.date)}</td><td>${escapeHtml(line.description)}</td><td>${money(line.total)}</td></tr>`).join('')}</tbody></table><p>Total: ${money(invoice.total)}<br>Paid: ${money(order.paid_amount)}<br><strong>Balance due: ${money(Math.max(0,Number(invoice.total)-Number(order.paid_amount)))}</strong></p><p>Thank you for your preference. ${BUSINESS.phoneDisplay}</p></div>`;
}
