import { NextResponse } from "next/server";
import { isAllowedAdminEmail } from "@/lib/auth";
import { getCurrentUser } from "@/lib/supabase/server";
import { getSupabaseAdminClient } from "@/lib/supabase/admin";

export async function requireAdmin(request?: Request) {
  const authorization = request?.headers.get("authorization");
  const token = authorization?.startsWith("Bearer ") ? authorization.slice(7) : null;
  const user = token ? (await getSupabaseAdminClient()?.auth.getUser(token))?.data.user : await getCurrentUser();
  if (!user || !isAllowedAdminEmail(user.email)) return { user:null, response:NextResponse.json({ok:false,error:"No autorizado."},{status:401}) };
  return { user, response:null };
}
