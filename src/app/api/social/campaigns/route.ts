import { NextRequest, NextResponse } from "next/server";

import { hasRole, requireUserContext } from "@/lib/member";
import { listSocialCampaigns } from "@/lib/social";
import { supabaseAdmin } from "@/lib/supabase-admin";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  const { error, role } = await requireUserContext();
  if (error || !hasRole("admin", role)) {
    return NextResponse.json({ error: error ?? "Forbidden" }, { status: 403 });
  }

  const campaigns = await listSocialCampaigns();
  return NextResponse.json({ campaigns });
}

export async function POST(request: NextRequest) {
  const { error, role, userId } = await requireUserContext();
  if (error || !userId || !hasRole("admin", role)) {
    return NextResponse.json({ error: error ?? "Forbidden" }, { status: 403 });
  }

  const body = (await request.json().catch(() => null)) as
    | {
        title?: string;
        objective?: string;
        audience?: string;
        offerSummary?: string;
        status?: string;
        startDate?: string | null;
        endDate?: string | null;
        targetPosts?: number;
        ownerUserId?: string | null;
        contentPillarId?: string | null;
      }
    | null;

  if (!body) {
    return NextResponse.json({ error: "Organization not found." }, { status: 400 });
  }

  const title = body.title?.trim() ?? "";
  if (!title) {
    return NextResponse.json({ error: "Campaign title is required." }, { status: 400 });
  }

  const { data, error: insertError } = await supabaseAdmin
    .from("social_campaigns")
    .insert({
      title,
      objective: body.objective?.trim() || null,
      audience: body.audience?.trim() || null,
      offer_summary: body.offerSummary?.trim() || null,
      status: body.status?.trim() || "active",
      start_date: body.startDate || null,
      end_date: body.endDate || null,
      target_posts: Number.isFinite(body.targetPosts) ? Math.max(Number(body.targetPosts), 0) : 0,
      owner_user_id: body.ownerUserId || userId,
      content_pillar_id: body.contentPillarId || null,
      updated_at: new Date().toISOString(),
    })
    .select("id, title, objective, audience, offer_summary, status, start_date, end_date, target_posts, owner_user_id, content_pillar_id, created_at, updated_at")
    .single();

  if (insertError || !data) {
    return NextResponse.json({ error: "Failed to create campaign." }, { status: 500 });
  }

  return NextResponse.json({ campaign: data });
}

export async function PATCH(request: NextRequest) {
  const { error, role } = await requireUserContext();
  if (error || !hasRole("admin", role)) {
    return NextResponse.json({ error: error ?? "Forbidden" }, { status: 403 });
  }

  const body = (await request.json().catch(() => null)) as
    | {
        organizationId?: string;
        id?: string;
        title?: string;
        objective?: string | null;
        audience?: string | null;
        offerSummary?: string | null;
        status?: string;
        startDate?: string | null;
        endDate?: string | null;
        targetPosts?: number;
      }
    | null;

  if (!body || !body.id) {
    return NextResponse.json({ error: "Invalid payload." }, { status: 400 });
  }

  const { data, error: updateError } = await supabaseAdmin
    .from("social_campaigns")
    .update({
      title: body.title?.trim() || undefined,
      objective: body.objective?.trim() || null,
      audience: body.audience?.trim() || null,
      offer_summary: body.offerSummary?.trim() || null,
      status: body.status?.trim() || undefined,
      start_date: body.startDate ?? undefined,
      end_date: body.endDate ?? undefined,
      target_posts: Number.isFinite(body.targetPosts) ? Math.max(Number(body.targetPosts), 0) : undefined,
      updated_at: new Date().toISOString(),
    })
    .eq("id", body.id)
    .select("id, title, objective, audience, offer_summary, status, start_date, end_date, target_posts, owner_user_id, content_pillar_id, created_at, updated_at")
    .single();

  if (updateError || !data) {
    return NextResponse.json({ error: "Failed to update campaign." }, { status: 500 });
  }

  return NextResponse.json({ campaign: data });
}
