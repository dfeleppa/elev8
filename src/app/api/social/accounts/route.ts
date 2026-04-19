import { NextRequest, NextResponse } from "next/server";

import { hasRole, requireUserContext } from "@/lib/member";
import { getSocialSettings, listSocialAccounts } from "@/lib/social";
import { supabaseAdmin } from "@/lib/supabase-admin";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  const { error, role } = await requireUserContext();
  if (error || !hasRole("admin", role)) {
    return NextResponse.json({ error: error ?? "Forbidden" }, { status: 403 });
  }

  const [accounts, settings] = await Promise.all([listSocialAccounts(), getSocialSettings()]);
  return NextResponse.json({
    accounts,
    settings,
    connectUrl: "/api/social/accounts/connect",
  });
}

export async function PATCH(request: NextRequest) {
  const { error, role } = await requireUserContext();
  if (error || !hasRole("admin", role)) {
    return NextResponse.json({ error: error ?? "Forbidden" }, { status: 403 });
  }

  const body = (await request.json().catch(() => null)) as
    | {
        approvalMode?: string;
        allowAdminBypass?: boolean;
        brandVoice?: string | null;
        defaultHashtags?: string[];
        ctaPresets?: string[];
        timezone?: string;
      }
    | null;

  if (!body) {
    return NextResponse.json({ error: "Invalid payload." }, { status: 400 });
  }

  const patch = {
    approval_mode: body.approvalMode === "required" ? "required" : "optional",
    allow_admin_bypass: body.allowAdminBypass ?? true,
    brand_voice: body.brandVoice?.trim() || null,
    default_hashtags: Array.isArray(body.defaultHashtags) ? body.defaultHashtags.map((tag) => tag.trim()).filter(Boolean) : [],
    cta_presets: Array.isArray(body.ctaPresets) ? body.ctaPresets.map((item) => item.trim()).filter(Boolean) : [],
    timezone: body.timezone?.trim() || "America/New_York",
    updated_at: new Date().toISOString(),
  };

  const { data, error: updateError } = await supabaseAdmin
    .from("social_org_settings")
    .upsert({ id: 1, ...patch }, { onConflict: "id" })
    .select("id, approval_mode, allow_admin_bypass, brand_voice, default_hashtags, cta_presets, timezone")
    .single();

  if (updateError || !data) {
    return NextResponse.json({ error: "Failed to update social settings." }, { status: 500 });
  }

  return NextResponse.json({ settings: data });
}
