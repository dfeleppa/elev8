import path from "node:path";

import { NextRequest, NextResponse } from "next/server";

import { hasRole, requireRequestUserContext } from "@/lib/member";
import { fingerprintBuffer, listSocialAssets } from "@/lib/social";
import { supabaseAdmin } from "@/lib/supabase-admin";

export const runtime = "nodejs";

const ALLOWED_UPLOAD_TYPES = ["image/png", "image/jpeg", "image/webp", "video/mp4", "video/quicktime"];
const MAX_UPLOAD_SIZE = 100 * 1024 * 1024;

function normalizeFileName(name: string) {
  return name.replace(/\.[^.]+$/, "").replace(/[-_]+/g, " ").trim();
}

export async function GET(request: NextRequest) {
  const { error, role } = await requireRequestUserContext(request);
  if (error || !hasRole("admin", role)) {
    return NextResponse.json({ error: error ?? "Forbidden" }, { status: 403 });
  }

  const assets = await listSocialAssets();
  return NextResponse.json({ assets });
}

export async function POST(request: NextRequest) {
  const { error, role, userId } = await requireRequestUserContext(request);
  if (error || !userId || !hasRole("admin", role)) {
    return NextResponse.json({ error: error ?? "Forbidden" }, { status: 403 });
  }

  const contentType = request.headers.get("content-type") ?? "";
  if (contentType.includes("application/json")) {
    const body = (await request.json().catch(() => null)) as
      | { sourceUrl?: string; title?: string; mediaType?: string; tags?: string[] }
      | null;
    if (!body || !body.sourceUrl?.trim()) {
      return NextResponse.json({ error: "Invalid payload." }, { status: 400 });
    }

    const { data, error: insertError } = await supabaseAdmin
      .from("social_assets")
      .insert({
        uploaded_by: userId,
        source_url: body.sourceUrl.trim(),
        public_url: body.sourceUrl.trim(),
        origin: "external_url",
        media_type: body.mediaType === "video" ? "video" : "image",
        title: body.title?.trim() || null,
        tags: Array.isArray(body.tags) ? body.tags.map((tag) => tag.trim()).filter(Boolean) : [],
        validation_status: "ready",
        updated_at: new Date().toISOString(),
      })
      .select("id, title, media_type, public_url, source_url, validation_status, tags, created_at")
      .single();

    if (insertError || !data) {
      return NextResponse.json({ error: "Failed to save asset." }, { status: 500 });
    }
    return NextResponse.json({ asset: data });
  }

  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return NextResponse.json({ error: "Invalid form data." }, { status: 400 });
  }

  const file = formData.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "File is required." }, { status: 400 });
  }

  if (!ALLOWED_UPLOAD_TYPES.includes(file.type)) {
    return NextResponse.json({ error: "Unsupported asset type." }, { status: 400 });
  }
  if (file.size > MAX_UPLOAD_SIZE) {
    return NextResponse.json({ error: "Asset exceeds upload limit." }, { status: 400 });
  }

  const ext = path.extname(file.name) || (file.type.startsWith("video/") ? ".mp4" : ".jpg");
  const buffer = Buffer.from(await file.arrayBuffer());
  const fingerprint = await fingerprintBuffer(buffer);
  const mediaType = file.type.startsWith("video/") ? "video" : "image";
  const filePath = `lyfe-fitness/${fingerprint}${ext}`;

  const { error: uploadError } = await supabaseAdmin.storage.from("social-assets").upload(filePath, buffer, {
    contentType: file.type,
    upsert: true,
  });
  if (uploadError) {
    return NextResponse.json({ error: `Upload failed: ${uploadError.message}` }, { status: 500 });
  }

  const { data: publicUrlData } = supabaseAdmin.storage.from("social-assets").getPublicUrl(filePath);

  const { data, error: insertError } = await supabaseAdmin
    .from("social_assets")
    .insert({
      uploaded_by: userId,
      storage_bucket: "social-assets",
      storage_path: filePath,
      public_url: publicUrlData.publicUrl,
      origin: "upload",
      media_type: mediaType,
      mime_type: file.type,
      file_size_bytes: file.size,
      title: normalizeFileName(file.name),
      tags: [],
      validation_status: "ready",
      metadata: { fingerprint },
      updated_at: new Date().toISOString(),
    })
    .select("id, title, media_type, public_url, source_url, validation_status, tags, created_at")
    .single();

  if (insertError || !data) {
    return NextResponse.json({ error: "Failed to register asset." }, { status: 500 });
  }

  return NextResponse.json({ asset: data });
}
