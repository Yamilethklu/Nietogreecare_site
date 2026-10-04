import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';
import { invoiceLogo } from './invoice-logo';
import { BUSINESS } from '@/lib/constants';
import type { OpsLead, WorkInvoice, WorkOrder } from './types';
export type InvoiceLine={date:string;description:string;total:number};
const money=(value:number|string)=>new Intl.NumberFormat('en-US',{style:'currency',currency:'USD'}).format(Number(value));
const safe=(text:string)=>text.normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^\x20-\x7e]/g,' ').slice(0,125);
const escapeHtml=(value:string)=>value.replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]??char));
export async function invoicePDF(invoice:WorkInvoice,order:WorkOrder,lead:OpsLead,lines:InvoiceLine[]=[{date:order.service_date,description:'Lawn / yard service',total:Number(invoice.total)}]){
 const pdf=await PDFDocument.create();
 const font=await pdf.embedFont(StandardFonts.Helvetica),bold=await pdf.embedFont(StandardFonts.HelveticaBold);
 const logo=await pdf.embedJpg(invoiceLogo);
 const green=rgb(.58,.83,.43),dark=rgb(0,0,0);
 let page=pdf.addPage([612,792]);
 const write=(text:string,x:number,y:number,size=11,heavy=false)=>page.drawText(safe(text),{x,y,size,font:heavy?bold:font,color:dark});
 const right=(text:string,y:number,heavy=false)=>write(text,556-(heavy?bold:font).widthOfTextAtSize(safe(text),11),y,11,heavy);
 const wrap=(text:string,width:number,size=11)=>{
  const result:string[]=[];let line='';
  for(const word of text.normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^\x20-\x7e]/g,' ').split(/\s+/)){
   for(const part of word.match(/.{1,38}/g)??['']){
    const next=line?`${line} ${part}`:part;
    if(font.widthOfTextAtSize(next,size)>width&&line){result.push(line);line=part;}else line=next;
   }
  }
  if(line)result.push(line);return result.length?result:[''];
 };
 const cell=(x:number,y:number,width:number,height:number,fill=false)=>page.drawRectangle({x,y,width,height,borderColor:dark,borderWidth:.6,...(fill?{color:green}:{})});
 const header=()=>{
  write('INVOICE',52,729,32,true);write(invoice.invoice_number,52,710,10);
  page.drawImage(logo,{x:344,y:610,width:218,height:153});
  cell(52,665,252,24,true);write('BILL TO:',58,672,12,true);
  const billLines=[...wrap(lead.customer_name,238),...wrap(lead.address,238),...wrap(`${lead.city??''} TX ${lead.zip_code}`,238)];
  const h=billLines.length*14+12;
  cell(52,665-h,252,h);billLines.forEach((line,index)=>write(line,58,650-index*14,10));
  cell(52,641-h,110,24,true);cell(162,641-h,142,24);write('Invoice Date:',58,648-h,10,true);write(invoice.issued_at.slice(0,10),168,648-h,10);
  return Math.min(570,621-h);
 };
 const tableHeader=(y:number)=>{cell(52,y-22,120,22,true);cell(172,y-22,278,22,true);cell(450,y-22,112,22,true);write('DATE',88,y-15,11,true);write('SERVICES',280,y-15,11,true);write('DEBT',480,y-15,11,true);return y-22;};
 let y=tableHeader(header());
 for(const line of lines){
  const description=wrap(line.description,264,10),height=Math.max(25,description.length*13+12);
  if(y-height<265){page=pdf.addPage([612,792]);y=tableHeader(header());}
  cell(52,y-height,120,height);cell(172,y-height,278,height);cell(450,y-height,112,height);
  write(line.date,58,y-16,10);description.forEach((text,index)=>write(text,178,y-16-index*13,10));right(money(line.total),y-16);y-=height;
 }
 if(y<325){page=pdf.addPage([612,792]);y=tableHeader(header());}
 for(let i=0;i<Math.max(0,5-lines.length);i++){cell(52,y-22,120,22);cell(172,y-22,278,22);cell(450,y-22,112,22);y-=22;}
 const total=Number(invoice.total),paid=Number(order.paid_amount),due=Math.max(0,total-paid);
 for(const [label,value,fill] of [['SERVICE TOTAL',total,false],['PAYMENT RECEIVED',paid,false],['TOTAL DEBT',due,true]] as const){cell(52,y-24,398,24,fill);cell(450,y-24,112,24,fill);write(label,60,y-16,11,true);right(money(value),y-16,true);y-=24;}
 write('THANK YOU FOR CHOOSING US',199,y-28,11,true);
 y-=62;write('PAYMENT INFORMATION:',54,y,11,true);write('CALL OR TEXT FOR ANY QUESTIONS',306,y,10,true);
 write('We take:',54,y-28);
 ['Cash',`Cash App: ${BUSINESS.cashAppTag}`,`Venmo: ${BUSINESS.venmoHandle}`,`Zelle: ${BUSINESS.phoneDisplay}`].forEach((text,index)=>write(`- ${text}`,64,y-51-index*17,10));
 page.drawText(BUSINESS.phoneDisplay,{x:316,y:y-78,size:25,font:bold,color:rgb(.9,0,0)});
 const note='Payment Note: Please make sure to include your service address with every payment, regardless of the payment method used (Zelle, Venmo, or Cash App). Thank you for your business!';
 wrap(note,502,10).forEach((text,index)=>write(text,54,y-139-index*14,10));
 pdf.setTitle(`Invoice ${invoice.invoice_number}`);pdf.setAuthor(BUSINESS.name);
 return await pdf.save();
}

export function invoiceEmail(invoice:WorkInvoice,order:WorkOrder,lead:OpsLead,lines:InvoiceLine[]=[{date:order.service_date,description:'Lawn / yard service',total:Number(invoice.total)}]){
 return `<div style="font-family:Arial,sans-serif;color:#10251a;line-height:1.6"><h2>Nieto Green Care LLC · Invoice ${escapeHtml(invoice.invoice_number)}</h2><p>Hello ${escapeHtml(lead.customer_name)},</p><p>Your service invoice for ${escapeHtml(lead.address)} is attached.</p><table><thead><tr><th>Date</th><th>Service</th><th>Amount</th></tr></thead><tbody>${lines.map(line=>`<tr><td>${escapeHtml(line.date)}</td><td>${escapeHtml(line.description)}</td><td>${money(line.total)}</td></tr>`).join('')}</tbody></table><p>Total: ${money(invoice.total)}<br>Paid: ${money(order.paid_amount)}<br><strong>Balance due: ${money(Math.max(0,Number(invoice.total)-Number(order.paid_amount)))}</strong></p><p>Thank you for your preference. ${BUSINESS.phoneDisplay}</p></div>`;
}
