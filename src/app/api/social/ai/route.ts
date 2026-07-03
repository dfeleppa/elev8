import { NextRequest, NextResponse } from "next/server";

import { hasRole, requireRequestUserContext } from "@/lib/member";
import { runSocialAi } from "@/lib/social";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  const { error, role, userId } = await requireRequestUserContext(request);
  if (error || !userId || !hasRole("admin", role)) {
    return NextResponse.json({ error: error ?? "Forbidden" }, { status: 403 });
  }

  const body = (await request.json().catch(() => null)) as
    | {
        socialPostId?: string | null;
        promptType?: string;
        brief?: string;
        campaign?: string | null;
        pillar?: string | null;
        platform?: string | null;
        brandVoice?: string | null;
      }
    | null;
  if (!body || !body.brief?.trim()) {
    return NextResponse.json({ error: "Brief is required." }, { status: 400 });
  }

  try {
    const run = await runSocialAi({
      socialPostId: body.socialPostId ?? null,
      memberId: userId,
      promptType: body.promptType?.trim() || "caption_pack",
      brief: body.brief.trim(),
      campaign: body.campaign?.trim() || null,
      pillar: body.pillar?.trim() || null,
      platform: body.platform?.trim() || null,
      brandVoice: body.brandVoice?.trim() || null,
    });
    return NextResponse.json({ run });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "AI generation failed." }, { status: 500 });
  }
}
