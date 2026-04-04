import { NextRequest, NextResponse } from "next/server";

import { hasRole, requireUserContext } from "../../../../lib/member";
import { supabaseAdmin } from "../../../../lib/supabase-admin";

function canAccess(organizationIds: string[], organizationId: string) {
  return organizationIds.includes(organizationId);
}

// GET /api/owner/preorders
export async function GET(request: NextRequest) {
  const { error, role, organizationIds } = await requireUserContext();
  if (error) return NextResponse.json({ error }, { status: 401 });
  if (!hasRole("owner", role)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const organizationId =
    request.nextUrl.searchParams.get("organizationId")?.trim() ?? organizationIds[0] ?? null;
  if (!organizationId) return NextResponse.json({ error: "Organization not found." }, { status: 400 });
  if (!canAccess(organizationIds, organizationId))
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { data, error: dbError } = await supabaseAdmin
    .from("store_preorders")
    .select("*, store_preorder_items(product_id)")
    .eq("organization_id", organizationId)
    .order("created_at", { ascending: false });

  if (dbError) return NextResponse.json({ error: "Internal server error." }, { status: 500 });

  return NextResponse.json({ preorders: data ?? [] });
}

// POST /api/owner/preorders
export async function POST(request: NextRequest) {
  const { error, role, organizationIds } = await requireUserContext();
  if (error) return NextResponse.json({ error }, { status: 401 });
  if (!hasRole("owner", role)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const organizationId = organizationIds[0] ?? null;
  if (!organizationId) return NextResponse.json({ error: "Organization not found." }, { status: 400 });

  const body = await request.json().catch(() => null);
  if (!body) return NextResponse.json({ error: "Invalid request body." }, { status: 400 });

  const name = String(body.name ?? "").trim();
  if (!name) return NextResponse.json({ error: "Preorder name is required." }, { status: 400 });

  const { data: preorder, error: insertError } = await supabaseAdmin
    .from("store_preorders")
    .insert({
      organization_id: organizationId,
      name,
      description: body.description?.trim() || null,
      order_deadline: body.orderDeadline || null,
      estimated_delivery_date: body.estimatedDeliveryDate || null,
      is_active: body.isActive !== false,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .select("*")
    .single();

  if (insertError) return NextResponse.json({ error: "Internal server error." }, { status: 500 });

  // Link product IDs if provided
  if (Array.isArray(body.productIds) && body.productIds.length > 0) {
    const itemRows = body.productIds.map((pid: string) => ({
      preorder_id: preorder.id,
      product_id: pid,
      created_at: new Date().toISOString(),
    }));
    await supabaseAdmin.from("store_preorder_items").insert(itemRows);
  }

  return NextResponse.json({ preorder }, { status: 201 });
}
