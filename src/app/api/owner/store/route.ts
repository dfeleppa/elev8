import { NextRequest, NextResponse } from "next/server";

import { hasRole, requireUserContext } from "@/lib/member";
import { supabaseAdmin } from "@/lib/supabase-admin";

// GET /api/owner/store — list all products
export async function GET(request: NextRequest) {
  const { error, role } = await requireUserContext();
  if (error) return NextResponse.json({ error }, { status: 401 });
  if (!hasRole("owner", role)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { data, error: dbError } = await supabaseAdmin
    .from("store_products")
    .select("*, store_product_options(*)")
    .order("created_at", { ascending: false });

  if (dbError) return NextResponse.json({ error: "Internal server error." }, { status: 500 });

  return NextResponse.json({ products: data ?? [] });
}

// POST /api/owner/store — create product
export async function POST(request: NextRequest) {
  const { error, role } = await requireUserContext();
  if (error) return NextResponse.json({ error }, { status: 401 });
  if (!hasRole("owner", role)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body = await request.json().catch(() => null);
  if (!body) return NextResponse.json({ error: "Invalid request body." }, { status: 400 });

  const name = String(body.name ?? "").trim();
  if (!name) return NextResponse.json({ error: "Product name is required." }, { status: 400 });

  const price = parseFloat(body.price) || 0;

  const { data: product, error: insertError } = await supabaseAdmin
    .from("store_products")
    .insert({
      name,
      description: body.description?.trim() || null,
      category: body.category?.trim() || null,
      price,
      coaches_price: body.coachesPrice != null ? parseFloat(body.coachesPrice) || null : null,
      tax_rate: body.taxRate?.trim() || null,
      tax_included_in_price: Boolean(body.taxIncludedInPrice),
      inventory_count: body.inventoryCount != null ? parseInt(body.inventoryCount, 10) || null : null,
      image_url: body.imageUrl?.trim() || null,
      hidden_in_store: Boolean(body.hiddenInStore),
      defer_to_invoice: Boolean(body.deferToInvoice),
      notify_admins_on_purchase: Boolean(body.notifyAdminsOnPurchase),
      has_options: Boolean(body.hasOptions),
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .select("*")
    .single();

  if (insertError) return NextResponse.json({ error: "Internal server error." }, { status: 500 });

  // Insert product options if provided
  if (body.hasOptions && Array.isArray(body.options) && body.options.length > 0) {
    const optionRows = body.options
      .filter((o: { optionName?: string; optionValues?: string[] }) => o.optionName?.trim())
      .map((o: { optionName: string; optionValues?: string[] }) => ({
        product_id: product.id,
        option_name: o.optionName.trim(),
        option_values: Array.isArray(o.optionValues) ? o.optionValues : [],
        created_at: new Date().toISOString(),
      }));

    if (optionRows.length > 0) {
      await supabaseAdmin.from("store_product_options").insert(optionRows);
    }
  }

  return NextResponse.json({ product }, { status: 201 });
}
