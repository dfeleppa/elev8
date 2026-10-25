import { NextResponse } from "next/server";
import { requireUserContext } from "@/lib/member";
import { garminMemberId, readGarmin } from "@/lib/garmin-personal";
import { GarminError } from "@/lib/garmin-data";
import { trendDates } from "@/lib/recovery-trends";
import { loadRecoveryTrends } from "@/lib/recovery-trends-server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const headers = { "Cache-Control": "private, no-store", Vary: "Cookie" };
const json = (data: unknown, status = 200) => NextResponse.json(data, { status, headers });

export async function GET(request: Request) {
  const { error, userId, role } = await requireUserContext();
  if (error || !userId) return json({ error: "Unauthorized" }, 401);
  // A global Personal API key must never expose one person's data to all members/owners.
  if (!garminMemberId()) {
    return role === "owner" ? json({ error: "Set GARMIN_PERSONAL_MEMBER_ID to your Lyfe app user ID before enabling Garmin." }, 503) : json({ error: "Forbidden" }, 403);
  }
  if (userId !== garminMemberId()) return json({ error: "Forbidden" }, 403);
  const params = new URL(request.url).searchParams;
  try {
    if (params.get("resource") === "trends") {
      const start = params.get("start_date") ?? "", end = params.get("end_date") ?? "";
      try { trendDates(start, end); } catch { return json({ error: "Select valid dates covering 1 to 30 days." }, 400); }
      return json(await loadRecoveryTrends(userId, start, end));
    }
    const data = await readGarmin(params.get("resource") ?? "daily", params);
    return json({ source: "Garmin Personal API", data, fetchedAt: new Date().toISOString() });
  } catch (error) {
    return error instanceof GarminError ? json({ error: error.message }, error.status) : json({ error: "Unable to load Garmin data." }, 502);
  }
}
