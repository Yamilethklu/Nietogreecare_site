import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';
import { BUSINESS } from '@/lib/constants';
import type { OpsLead, WorkInvoice, WorkOrder } from './types';
const money=(value:number|string)=>new Intl.NumberFormat('en-US',{style:'currency',currency:'USD'}).format(Number(value));
const safe=(text:string)=>text.normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^\x20-\x7e]/g,' ').slice(0,125);
const escapeHtml=(value:string)=>value.replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]??char));
export async function invoicePDF(invoice:WorkInvoice,order:WorkOrder,lead:OpsLead){
 const pdf=await PDFDocument.create();const page=pdf.addPage([612,792]);const font=await pdf.embedFont(StandardFonts.Helvetica),bold=await pdf.embedFont(StandardFonts.HelveticaBold);
 const green=rgb(.06,.43,.25),dark=rgb(.1,.15,.12);const write=(text:string,x:number,y:number,size=11,heavy=false)=>page.drawText(safe(text),{x,y,size,font:heavy?bold:font,color:dark});
 page.drawRectangle({x:0,y:740,width:612,height:52,color:green});page.drawText('NIETO GREEN CARE LLC',{x:40,y:758,size:18,font:bold,color:rgb(1,1,1)});
 write('SERVICE INVOICE',40,696,23,true);write(invoice.invoice_number,410,698,12,true);
 write(`Issue date: ${invoice.issued_at.slice(0,10)}`,40,670);write(`Service date: ${order.service_date}`,40,652);
 write(`Bill to: ${lead.customer_name}`,40,615,13,true);write(lead.address,40,596);write(`${lead.city??''} TX ${lead.zip_code}`,40,578);
 write(`Contact: ${lead.customer_email??lead.customer_phone}`,40,560);
 page.drawLine({start:{x:40,y:535},end:{x:572,y:535},thickness:1,color:green});
 write('Service',40,512,11,true);write('Amount',475,512,11,true);
 write('Lawn mowing / yard service',40,486);write(money(invoice.total),475,486);
 page.drawLine({start:{x:40,y:466},end:{x:572,y:466},thickness:1,color:green});
 write(`Service total: ${money(invoice.total)}`,350,440,11,true);
 write(`Payment received: ${money(order.paid_amount)}`,350,420);
 write(`Balance due: ${money(Math.max(0,Number(invoice.total)-Number(order.paid_amount)))}`,350,398,13,true);
 write(`Payment method: ${order.payment_method??'Not recorded'}`,40,360);
 write(`Reference: ${lead.reference_code}`,40,340);
 write(`Questions? ${BUSINESS.phoneDisplay} | ${BUSINESS.email}`,40,80,10);
 write('Payment after each cut is preferred; no more than two cuts unpaid.',40,61,9);
 return await pdf.save();
}
export function invoiceEmail(invoice:WorkInvoice,order:WorkOrder,lead:OpsLead){const name=escapeHtml(lead.customer_name),number=escapeHtml(invoice.invoice_number),address=escapeHtml(lead.address);const balance=money(Math.max(0,Number(invoice.total)-Number(order.paid_amount)));return `<div style="font-family:Arial,sans-serif;color:#10251a;line-height:1.6"><h2>Nieto Green Care LLC · Invoice ${number}</h2><p>Hello ${name},</p><p>Attached is the invoice for your lawn service on ${order.service_date} at ${address}.</p><p><strong>Service total:</strong> ${money(invoice.total)}<br><strong>Paid:</strong> ${money(order.paid_amount)}<br><strong>Balance due:</strong> ${balance}</p><p>Payment after each cut is preferred, with at most two cuts outstanding. For questions, contact ${BUSINESS.phoneDisplay}.</p></div>`;}
