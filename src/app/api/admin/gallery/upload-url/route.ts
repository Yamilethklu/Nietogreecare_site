import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin-api";
import { GALLERY_BUCKET, getSupabaseAdminClient } from "@/lib/supabase/admin";
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
const extensionForType: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/avif": "avif",
  "video/mp4": "mp4",
  "video/quicktime": "mov",
  "video/webm": "webm",
};

export async function POST(request: Request) {
  const gate = await requireAdmin();
  if (gate.response) return gate.response;
  const body = await request.json().catch(() => null);
  const fileName = typeof body?.fileName === "string" ? body.fileName : "";
  const fileType = typeof body?.fileType === "string" ? body.fileType : "";
  const fileSize = Number(body?.fileSize);
  if (!fileName || !ALLOWED_GALLERY_MEDIA_TYPES.includes(fileType as (typeof ALLOWED_GALLERY_MEDIA_TYPES)[number]) || !Number.isFinite(fileSize) || fileSize > MAX_GALLERY_MEDIA_BYTES) {
    return NextResponse.json({ ok: false, error: "Seleccione una foto o video JPG, PNG, WEBP, AVIF, MP4, MOV o WEBM válido de máximo 50 MB." }, { status: 422 });
  }
  const db = getSupabaseAdminClient();
  if (!db) return NextResponse.json({ ok: false, error: "Supabase no configurado." }, { status: 503 });
  const baseName = fileName.replace(/\.[^.]+$/, "");
  const path = `gallery/${Date.now()}-${slugify(baseName)}.${extensionForType[fileType]}`;
  const { data, error } = await db.storage.from(GALLERY_BUCKET).createSignedUploadUrl(path);
  if (error || !data) return NextResponse.json({ ok: false, error: error?.message || "No se pudo preparar la subida." }, { status: 500 });
  return NextResponse.json({ ok: true, data: { bucket: GALLERY_BUCKET, path, token: data.token } });
}
