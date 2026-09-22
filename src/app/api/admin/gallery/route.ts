import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin-api";
import { GALLERY_BUCKET, getSupabaseAdminClient, publicStorageUrl } from "@/lib/supabase/admin";
import { galleryItemSchema, galleryUpdateSchema } from "@/lib/validation";
import { slugify } from "@/lib/utils";

export const runtime = "nodejs";

const ALLOWED_GALLERY_MEDIA_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/avif",
  "video/mp4",
  "video/quicktime",
  "video/webm",
] as const;
const MAX_GALLERY_MEDIA_BYTES = 50 * 1024 * 1024;

export async function GET() {
  const gate = await requireAdmin();
  if (gate.response) return gate.response;
  const db = getSupabaseAdminClient();
  if (!db) return NextResponse.json({ ok: false, error: "Supabase no configurado." }, { status: 503 });
  const { data, error } = await db.from("gallery").select("*").order("carousel_order").order("created_at", { ascending: false });
  return NextResponse.json(error ? { ok: false, error: error.message } : { ok: true, data: data ?? [] }, { status: error ? 500 : 200 });
}

export async function POST(request: Request) {
  const gate = await requireAdmin();
  if (gate.response) return gate.response;
  const form = await request.formData().catch(() => null);
  const file = form?.get("file");
  if (!(file instanceof File) || !ALLOWED_GALLERY_MEDIA_TYPES.includes(file.type as (typeof ALLOWED_GALLERY_MEDIA_TYPES)[number]) || file.size > MAX_GALLERY_MEDIA_BYTES) return NextResponse.json({ ok: false, error: "Seleccione una foto o video JPG, PNG, WEBP, AVIF, MP4, MOV o WEBM válido de máximo 50 MB." }, { status: 422 });
  const db = getSupabaseAdminClient();
  if (!db) return NextResponse.json({ ok: false, error: "Supabase no configurado." }, { status: 503 });
  const path = `gallery/${Date.now()}-${slugify(file.name)}`;
  const upload = await db.storage.from(GALLERY_BUCKET).upload(path, Buffer.from(await file.arrayBuffer()), { contentType: file.type, upsert: false });
  if (upload.error) return NextResponse.json({ ok: false, error: upload.error.message }, { status: 500 });
  const item = galleryItemSchema.parse({ public_url: publicStorageUrl(GALLERY_BUCKET, path), storage_path: path, title: String(form?.get("title") || ""), description: String(form?.get("description") || ""), location: String(form?.get("location") || "") || null, service_key: String(form?.get("service_key") || "") || null, is_published: true, is_carousel: true });
  const { data, error } = await db.from("gallery").insert(item).select().single();
  if (error) { await db.storage.from(GALLERY_BUCKET).remove([path]); return NextResponse.json({ ok: false, error: error.message }, { status: 500 }); }
  return NextResponse.json({ ok: true, data }, { status: 201 });
}

export async function PATCH(request: Request) {
  const gate = await requireAdmin();
  if (gate.response) return gate.response;
  const body = await request.json().catch(() => null);
  const parsed = galleryUpdateSchema.safeParse(body?.changes);
  if (typeof body?.id !== "string" || !parsed.success) return NextResponse.json({ ok: false, error: "Datos inválidos." }, { status: 422 });
  const db = getSupabaseAdminClient();
  if (!db) return NextResponse.json({ ok: false, error: "Supabase no configurado." }, { status: 503 });
  const { data, error } = await db.from("gallery").update(parsed.data).eq("id", body.id).select().single();
  return NextResponse.json(error ? { ok: false, error: error.message } : { ok: true, data }, { status: error ? 500 : 200 });
}

export async function DELETE(request: Request) {
  const gate = await requireAdmin();
  if (gate.response) return gate.response;
  const body = await request.json().catch(() => null);
  if (typeof body?.id !== "string") return NextResponse.json({ ok: false, error: "Datos inválidos." }, { status: 422 });
  const db = getSupabaseAdminClient();
  if (!db) return NextResponse.json({ ok: false, error: "Supabase no configurado." }, { status: 503 });
  const { data: item, error: lookupError } = await db.from("gallery").select("storage_path").eq("id", body.id).single();
  if (lookupError || !item) return NextResponse.json({ ok: false, error: "Foto no encontrada." }, { status: 404 });
  if (item.storage_path) { const { error: storageError } = await db.storage.from(GALLERY_BUCKET).remove([item.storage_path]); if (storageError) return NextResponse.json({ ok: false, error: storageError.message }, { status: 500 }); }
  const { error } = await db.from("gallery").delete().eq("id", body.id);
  return NextResponse.json(error ? { ok: false, error: error.message } : { ok: true }, { status: error ? 500 : 200 });
}