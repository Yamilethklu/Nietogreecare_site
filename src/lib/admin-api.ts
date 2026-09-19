import { NextResponse } from "next/server";
import { isAllowedAdminEmail } from "@/lib/auth";
import { getCurrentUser } from "@/lib/supabase/server";

export async function requireAdmin() {
  const user = await getCurrentUser();
  if (!user || !isAllowedAdminEmail(user.email)) return { user:null, response:NextResponse.json({ok:false,error:"No autorizado."},{status:401}) };
  return { user, response:null };
}