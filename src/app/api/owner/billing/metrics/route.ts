import { NextRequest, NextResponse } from "next/server";
import { hasRole, requireUserContext } from "../../../../../lib/member";
import { getOrganizationBillingMetrics } from "../../../../../lib/billing-metrics";

export async function GET(request: NextRequest) {
  const { error, role, organizationIds } = await requireUserContext();
  if (error) return NextResponse.json({ error }, { status: 401 });
  if (!hasRole("owner", role)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const organizationId = organizationIds[0] ?? null;
  if (!organizationId) return NextResponse.json({ error: "Organization not found" }, { status: 400 });

  const forceRefresh = request.nextUrl.searchParams.get("fresh") === "1";

  try {
    const payload = await getOrganizationBillingMetrics(organizationId, {
      forceRefresh,
    });

    return NextResponse.json(payload, {
      headers: {
        "Cache-Control": "private, max-age=300, stale-while-revalidate=3600",
      },
    });
  } catch (err: any) {
    console.error("Stripe metrics error:", err);
    return NextResponse.json(
      { error: err.message || "Failed to fetch metrics" },
      { status: 500 }
    );
  }
}
