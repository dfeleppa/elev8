import { NextResponse } from "next/server";

import { hasRole, requireUserContext } from "@/lib/member";
import { supabaseAdmin } from "@/lib/supabase-admin";

const ALLOWED_TYPES: Record<string, string> = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/webp": "webp",
};
const MAX_SIZE = 2 * 1024 * 1024; // 2MB

export async function POST(request: Request) {
  const { error, role } = await requireUserContext();
  if (error || !hasRole("owner", role)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return NextResponse.json({ error: "Invalid form data." }, { status: 400 });
  }

  const file = formData.get("logo");
  if (!file || !(file instanceof File)) {
    return NextResponse.json({ error: "No file uploaded." }, { status: 400 });
  }

  const ext = ALLOWED_TYPES[file.type];
  if (!ext) {
    return NextResponse.json(
      { error: "File must be PNG, JPG, or WebP." },
      { status: 400 }
    );
  }

  if (file.size > MAX_SIZE) {
    return NextResponse.json(
      { error: "File must be under 2MB." },
      { status: 400 }
    );
  }

  const filePath = `lyfe-fitness/logo.${ext}`;
  const buffer = Buffer.from(await file.arrayBuffer());

  const { error: uploadError } = await supabaseAdmin.storage
    .from("gym-assets")
    .upload(filePath, buffer, {
      contentType: file.type,
      upsert: true,
    });

  if (uploadError) {
    return NextResponse.json(
      { error: `Failed to upload logo: ${uploadError.message}` },
      { status: 500 }
    );
  }

  const { data: publicUrlData } = supabaseAdmin.storage
    .from("gym-assets")
    .getPublicUrl(filePath);

  const logoUrl = publicUrlData.publicUrl;

  await supabaseAdmin
    .from("gym_settings")
    .update({ logo_url: logoUrl, updated_at: new Date().toISOString() })
    .eq("id", 1);

  return NextResponse.json({ logoUrl });
}
