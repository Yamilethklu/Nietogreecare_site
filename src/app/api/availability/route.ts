import { NextResponse } from "next/server";
export const dynamic = "force-dynamic";
export async function GET(request: Request) {
  const month = new URL(request.url).searchParams.get("month") ?? "";
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(month)) return NextResponse.json({ok:false,error:"Mes inválido."},{status:400});
  return NextResponse.json({ok:true,occupiedDates:[]},{headers:{"Cache-Control":"no-store"}});
}
