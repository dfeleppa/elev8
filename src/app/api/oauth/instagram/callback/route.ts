import { timingSafeEqual } from "node:crypto";

import { NextRequest, NextResponse } from "next/server";

import { hasRole, requireUserContext } from "../../../../../lib/member";
import { supabaseAdmin } from "../../../../../lib/supabase-admin";
import {
  exchangeInstagramCode,
  fetchInstagramAccount,
  INSTAGRAM_OAUTH_STATE_COOKIE,
} from "../../../../../lib/instagram";

export const runtime = "nodejs";

function constantTimeEqual(left: string, right: string) {
  const leftBuffer = Buffer.from(left);
  const rightBuffer = Buffer.from(right);
  if (leftBuffer.length !== rightBuffer.length) {
    return false;
  }
  return timingSafeEqual(leftBuffer, rightBuffer);
}

export async function GET(request: NextRequest) {
  try {
    const { error: userError, role, userId } = await requireUserContext();
    if (userError || !userId || !hasRole("admin", role)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const code = searchParams.get("code");
    const state = searchParams.get("state")?.trim() ?? "";

    const storedRaw = request.cookies.get(INSTAGRAM_OAUTH_STATE_COOKIE)?.value?.trim() ?? "";
    const parsed = storedRaw ? JSON.parse(storedRaw) as { state?: string; organizationId?: string } : {};
    const storedState = parsed.state?.trim() ?? "";
    const organizationId = parsed.organizationId?.trim() ?? "";

    if (!code) {
      return NextResponse.json({ error: "Missing code." }, { status: 400 });
    }

    if (!state || !storedState || !constantTimeEqual(state, storedState)) {
      const response = NextResponse.json({ error: "Invalid OAuth state." }, { status: 400 });
      response.cookies.delete(INSTAGRAM_OAUTH_STATE_COOKIE);
      return response;
    }

    if (!organizationId) {
      const response = NextResponse.json({ error: "Organization context missing." }, { status: 400 });
      response.cookies.delete(INSTAGRAM_OAUTH_STATE_COOKIE);
      return response;
    }

    const token = await exchangeInstagramCode(code);
    const account = await fetchInstagramAccount(token.accessToken);

    const expiresAt =
      typeof token.expiresIn === "number"
        ? new Date(Date.now() + token.expiresIn * 1000).toISOString()
        : null;

    const { error } = await supabaseAdmin.from("instagram_oauth_tokens").upsert(
      {
        organization_id: organizationId,
        member_id: userId,
        ig_user_id: account.igUserId,
        page_id: account.pageId,
        username: account.username,
        access_token: account.pageAccessToken,
        token_type: token.tokenType,
        expires_at: expiresAt,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "organization_id,ig_user_id" }
    );

    if (error) {
      return NextResponse.json({ error: "Internal server error." }, { status: 500 });
    }

    const capabilities = {
      supportsAutoPublish: true,
      supportsStoriesDirect: false,
      supportsCommentsInbox: true,
      supportsDmInbox: true,
    };

    const { data: instagramAccount, error: instagramAccountError } = await supabaseAdmin
      .from("social_accounts")
      .upsert(
        {
          organization_id: organizationId,
          provider: "meta",
          platform: "instagram",
          account_type: "business",
          external_account_id: account.igUserId,
          external_page_id: account.pageId,
          username: account.username,
          display_name: account.username,
          status: "connected",
          capabilities,
          metadata: { linkedPageId: account.pageId },
          last_synced_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
        { onConflict: "organization_id,provider,platform,external_account_id" }
      )
      .select("id")
      .single();

    const { data: facebookAccount, error: facebookAccountError } = await supabaseAdmin
      .from("social_accounts")
      .upsert(
        {
          organization_id: organizationId,
          provider: "meta",
          platform: "facebook",
          account_type: "page",
          external_account_id: account.pageId,
          external_page_id: account.pageId,
          display_name: account.username ? `${account.username} Facebook` : "Facebook Page",
          status: "connected",
          capabilities: {
            supportsAutoPublish: true,
            supportsCommentsInbox: true,
            supportsDmInbox: false,
          },
          metadata: { linkedInstagramUserId: account.igUserId },
          last_synced_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
        { onConflict: "organization_id,provider,platform,external_account_id" }
      )
      .select("id")
      .single();

    if (instagramAccountError || facebookAccountError || !instagramAccount || !facebookAccount) {
      return NextResponse.json({ error: "Failed to provision social accounts." }, { status: 500 });
    }

    await supabaseAdmin.from("social_account_tokens").insert([
      {
        social_account_id: instagramAccount.id,
        member_id: userId,
        access_token: account.pageAccessToken,
        token_type: token.tokenType,
        granted_scopes: [
          "instagram_basic",
          "instagram_content_publish",
          "instagram_manage_comments",
          "instagram_manage_messages",
          "pages_show_list",
          "pages_read_engagement",
          "pages_manage_posts",
          "pages_manage_metadata",
          "pages_messaging",
        ],
        expires_at: expiresAt,
        status: "active",
        updated_at: new Date().toISOString(),
      },
      {
        social_account_id: facebookAccount.id,
        member_id: userId,
        access_token: account.pageAccessToken,
        token_type: token.tokenType,
        granted_scopes: [
          "instagram_basic",
          "instagram_content_publish",
          "instagram_manage_comments",
          "instagram_manage_messages",
          "pages_show_list",
          "pages_read_engagement",
          "pages_manage_posts",
          "pages_manage_metadata",
          "pages_messaging",
        ],
        expires_at: expiresAt,
        status: "active",
        updated_at: new Date().toISOString(),
      },
    ]);

    const response = NextResponse.redirect(new URL("/organization/admin/content", request.url));
    response.cookies.delete(INSTAGRAM_OAUTH_STATE_COOKIE);
    return response;
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unexpected error.";
    console.error("Instagram OAuth callback failed:", message);
    const response = NextResponse.json({ error: "Internal server error." }, { status: 500 });
    response.cookies.delete(INSTAGRAM_OAUTH_STATE_COOKIE);
    return response;
  }
}
