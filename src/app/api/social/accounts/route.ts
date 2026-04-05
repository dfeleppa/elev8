import { NextRequest, NextResponse } from "next/server";

import { hasRole, requireUserContext } from "../../../../lib/member";
import { getSocialSettings, listSocialAccounts } from "../../../../lib/social";
import { supabaseAdmin } from "../../../../lib/supabase-admin";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  const { error, role, organizationIds } = await requireUserContext();
  if (error || !hasRole("admin", role)) {
    return NextResponse.json({ error: error ?? "Forbidden" }, { status: 403 });
  }

  const organizationId = request.nextUrl.searchParams.get("organizationId")?.trim() ?? organizationIds[0] ?? null;
  if (!organizationId || !organizationIds.includes(organizationId)) {
    return NextResponse.json({ error: "Organization not found." }, { status: 400 });
  }

  const [accounts, settings] = await Promise.all([listSocialAccounts(organizationId), getSocialSettings(organizationId)]);
  return NextResponse.json({
    accounts,
    settings,
    connectUrl: "/api/social/accounts/connect",
  });
}

export async function PATCH(request: NextRequest) {
  const { error, role, organizationIds } = await requireUserContext();
  if (error || !hasRole("admin", role)) {
    return NextResponse.json({ error: error ?? "Forbidden" }, { status: 403 });
  }

  const body = (await request.json().catch(() => null)) as
    | {
        organizationId?: string;
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

  const organizationId = body.organizationId?.trim() ?? organizationIds[0] ?? null;
  if (!organizationId || !organizationIds.includes(organizationId)) {
    return NextResponse.json({ error: "Organization not found." }, { status: 400 });
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
    .upsert({ organization_id: organizationId, ...patch }, { onConflict: "organization_id" })
    .select("organization_id, approval_mode, allow_admin_bypass, brand_voice, default_hashtags, cta_presets, timezone")
    .single();

  if (updateError || !data) {
    return NextResponse.json({ error: "Failed to update social settings." }, { status: 500 });
  }

  return NextResponse.json({ settings: data });
}
