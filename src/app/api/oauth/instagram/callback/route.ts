import { createHmac, timingSafeEqual } from "node:crypto";

import { NextRequest, NextResponse } from "next/server";

import { hasRole, requireUserContext } from "@/lib/member";
import { supabaseAdmin } from "@/lib/supabase-admin";
import {
  exchangeInstagramCode,
  fetchInstagramAccount,
  INSTAGRAM_OAUTH_STATE_COOKIE,
  META_OAUTH_SCOPES,
} from "@/lib/instagram";

export const runtime = "nodejs";

function constantTimeEqual(left: string, right: string) {
  const leftBuffer = Buffer.from(left);
  const rightBuffer = Buffer.from(right);
  if (leftBuffer.length !== rightBuffer.length) {
    return false;
  }
  return timingSafeEqual(leftBuffer, rightBuffer);
}

function parseSignedState(state: string) {
  const secret = process.env.NEXTAUTH_SECRET?.trim();
  if (!secret) {
    throw new Error("NEXTAUTH_SECRET is required for OAuth state validation.");
  }

  const [encodedPayload, providedSignature] = state.split(".");
  if (!encodedPayload || !providedSignature) {
    throw new Error("Invalid OAuth state.");
  }

  const expectedSignature = createHmac("sha256", secret).update(encodedPayload).digest("base64url");
  if (!constantTimeEqual(providedSignature, expectedSignature)) {
    throw new Error("Invalid OAuth state.");
  }

  const decoded = JSON.parse(Buffer.from(encodedPayload, "base64url").toString("utf8")) as {
    issuedAt?: number;
  };

  const issuedAt = typeof decoded.issuedAt === "number" ? decoded.issuedAt : 0;
  if (!issuedAt) {
    throw new Error("Invalid OAuth state.");
  }

  if (Date.now() - issuedAt > 10 * 60 * 1000) {
    throw new Error("OAuth state expired. Please try connecting again.");
  }
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

    if (!code) {
      return NextResponse.json({ error: "Missing code." }, { status: 400 });
    }

    parseSignedState(state);

    const token = await exchangeInstagramCode(code);
    const account = await fetchInstagramAccount(token.accessToken);

    const expiresAt =
      typeof token.expiresIn === "number"
        ? new Date(Date.now() + token.expiresIn * 1000).toISOString()
        : null;

    const { error } = await supabaseAdmin.from("instagram_oauth_tokens").upsert(
      {
        member_id: userId,
        ig_user_id: account.igUserId,
        page_id: account.pageId,
        username: account.username,
        access_token: account.pageAccessToken,
        token_type: token.tokenType,
        expires_at: expiresAt,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "ig_user_id" }
    );

    if (error) {
      console.error("Instagram token upsert failed:", error.message);
      const response = NextResponse.redirect(new URL(`/admin/content?socialError=${encodeURIComponent(`Legacy token save failed: ${error.message}`)}`, request.url));
      response.cookies.delete(INSTAGRAM_OAUTH_STATE_COOKIE);
      return response;
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
        { onConflict: "provider,platform,external_account_id" }
      )
      .select("id")
      .single();

    const { data: facebookAccount, error: facebookAccountError } = await supabaseAdmin
      .from("social_accounts")
      .upsert(
        {
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
        { onConflict: "provider,platform,external_account_id" }
      )
      .select("id")
      .single();

    if (instagramAccountError || facebookAccountError || !instagramAccount || !facebookAccount) {
      console.error("Social account provisioning failed:", instagramAccountError?.message, facebookAccountError?.message);
      const message = instagramAccountError?.message || facebookAccountError?.message || "Failed to provision social accounts.";
      const response = NextResponse.redirect(new URL(`/admin/content?socialError=${encodeURIComponent(message)}`, request.url));
      response.cookies.delete(INSTAGRAM_OAUTH_STATE_COOKIE);
      return response;
    }

    const { error: tokenInsertError } = await supabaseAdmin.from("social_account_tokens").insert([
      {
        social_account_id: instagramAccount.id,
        member_id: userId,
        access_token: account.pageAccessToken,
        token_type: token.tokenType,
        granted_scopes: [...META_OAUTH_SCOPES],
        expires_at: expiresAt,
        status: "active",
        updated_at: new Date().toISOString(),
      },
      {
        social_account_id: facebookAccount.id,
        member_id: userId,
        access_token: account.pageAccessToken,
        token_type: token.tokenType,
        granted_scopes: [...META_OAUTH_SCOPES],
        expires_at: expiresAt,
        status: "active",
        updated_at: new Date().toISOString(),
      },
    ]);

    if (tokenInsertError) {
      console.error("Social token provisioning failed:", tokenInsertError.message);
      const response = NextResponse.redirect(new URL(`/admin/content?socialError=${encodeURIComponent(`Token save failed: ${tokenInsertError.message}`)}`, request.url));
      response.cookies.delete(INSTAGRAM_OAUTH_STATE_COOKIE);
      return response;
    }

    const response = NextResponse.redirect(new URL("/admin/content", request.url));
    response.cookies.delete(INSTAGRAM_OAUTH_STATE_COOKIE);
    return response;
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unexpected error.";
    console.error("Instagram OAuth callback failed:", message);
    const response = NextResponse.redirect(new URL(`/admin/content?socialError=${encodeURIComponent(message)}`, request.url));
    response.cookies.delete(INSTAGRAM_OAUTH_STATE_COOKIE);
    return response;
  }
}
