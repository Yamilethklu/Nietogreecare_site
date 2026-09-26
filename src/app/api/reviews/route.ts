import { NextResponse } from 'next/server';
import { z } from 'zod';
import { readReviews, writeReviews } from '@/lib/reviews-store';
export const dynamic = 'force-dynamic';
const schema=z.object({customer_name:z.string().trim().min(2).max(90),city:z.string().trim().min(2).max(90),rating:z.number().int().min(1).max(5),comment:z.string().trim().min(15).max(1200),website:z.string().max(0).optional()});
export async function GET() {try {const items=await readReviews();return NextResponse.json({ok:true,data:items.filter(item=>item.approved).slice(0,30).map(({id,customer_name,city,rating,comment,created_at})=>({id,customer_name,city,rating,comment,created_at}))},{headers:{'Cache-Control':'no-store'}});}catch{return NextResponse.json({ok:false,error:'Servicio no disponible'},{status:503});}}
export async function POST(request:Request) {const parsed=schema.safeParse(await request.json().catch(()=>null));if(!parsed.success)return NextResponse.json({ok:false,error:'Revise su nombre, ciudad y comentario (mínimo 15 caracteres).'},{status:422});try{const items=await readReviews();const {website,...review}=parsed.data;await writeReviews([{...review,id:crypto.randomUUID(),approved:false,created_at:new Date().toISOString()},...items]);return NextResponse.json({ok:true},{status:201});}catch{return NextResponse.json({ok:false,error:'No se pudo enviar'},{status:503});}}
