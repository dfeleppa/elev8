import { NextRequest, NextResponse } from "next/server";

import { hasRole, requireRequestUserContext } from "@/lib/member";
import { supabaseAdmin } from "@/lib/supabase-admin";

type RouteContext = { params: Promise<{ productId: string }> };

function parseNonNegativeNumber(value: unknown): number | null {
  if (value === null || value === undefined || value === "") return null;
  const parsed = typeof value === "number" ? value : parseFloat(String(value));
  if (!Number.isFinite(parsed) || parsed < 0) return null;
  return parsed;
}

// PATCH /api/owner/store/[productId] — update product
export async function PATCH(request: NextRequest, context: RouteContext) {
  const { error, role } = await requireRequestUserContext(request);
  if (error) return NextResponse.json({ error }, { status: 401 });
  if (!hasRole("owner", role)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { productId } = await context.params;
  const body = await request.json().catch(() => null);
  if (!body) return NextResponse.json({ error: "Invalid request body." }, { status: 400 });

  // Verify ownership
  const { data: existing } = await supabaseAdmin
    .from("store_products")
    .select("id")
    .eq("id", productId)
    .single();

  if (!existing) {
    return NextResponse.json({ error: "Not found." }, { status: 404 });
  }

  const updates: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (body.name !== undefined) updates.name = String(body.name).trim();
  if (body.description !== undefined) updates.description = body.description?.trim() || null;
  if (body.category !== undefined) updates.category = body.category?.trim() || null;
  if (body.price !== undefined) {
    const price = parseNonNegativeNumber(body.price);
    if (price === null) {
      return NextResponse.json({ error: "price must be a non-negative number." }, { status: 400 });
    }
    updates.price = price;
  }
  if (body.coachesPrice !== undefined) updates.coaches_price = parseNonNegativeNumber(body.coachesPrice);
  if (body.taxRate !== undefined) updates.tax_rate = body.taxRate?.trim() || null;
  if (body.taxIncludedInPrice !== undefined) updates.tax_included_in_price = Boolean(body.taxIncludedInPrice);
  if (body.inventoryCount !== undefined) updates.inventory_count = body.inventoryCount != null ? parseInt(body.inventoryCount, 10) || null : null;
  if (body.imageUrl !== undefined) updates.image_url = body.imageUrl?.trim() || null;
  if (body.hiddenInStore !== undefined) updates.hidden_in_store = Boolean(body.hiddenInStore);
  if (body.deferToInvoice !== undefined) updates.defer_to_invoice = Boolean(body.deferToInvoice);
  if (body.notifyAdminsOnPurchase !== undefined) updates.notify_admins_on_purchase = Boolean(body.notifyAdminsOnPurchase);
  if (body.hasOptions !== undefined) updates.has_options = Boolean(body.hasOptions);

  const { data: product, error: updateError } = await supabaseAdmin
    .from("store_products")
    .update(updates)
    .eq("id", productId)
    .select("*")
    .single();

  if (updateError) return NextResponse.json({ error: "Internal server error." }, { status: 500 });

  return NextResponse.json({ product });
}

// DELETE /api/owner/store/[productId] — delete product
export async function DELETE(request: NextRequest, context: RouteContext) {
  const { error, role } = await requireRequestUserContext(request);
  if (error) return NextResponse.json({ error }, { status: 401 });
  if (!hasRole("owner", role)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { productId } = await context.params;

  const { data: existing } = await supabaseAdmin
    .from("store_products")
    .select("id")
    .eq("id", productId)
    .single();

  if (!existing) {
    return NextResponse.json({ error: "Not found." }, { status: 404 });
  }

  const { error: deleteError } = await supabaseAdmin
    .from("store_products")
    .delete()
    .eq("id", productId);

  if (deleteError) return NextResponse.json({ error: "Internal server error." }, { status: 500 });

  return NextResponse.json({ success: true });
}
