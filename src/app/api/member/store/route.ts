import { NextResponse } from "next/server";

import { hasRole, requireUserContext } from "../../../../lib/member";
import { supabaseAdmin } from "../../../../lib/supabase-admin";

// GET /api/member/store — list visible products for the member's organization
export async function GET() {
  const { error, role,  } = await requireUserContext();
  if (error) return NextResponse.json({ error }, { status: 401 });
  if (!hasRole("member", role)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });


  const { data: products, error: dbError } = await supabaseAdmin
    .from("store_products")
    .select("*, store_product_options(*)")
    .eq("hidden_in_store", false)
    .order("created_at", { ascending: false });

  if (dbError) return NextResponse.json({ error: "Internal server error." }, { status: 500 });

  const { data: preorders } = await supabaseAdmin
    .from("store_preorders")
    .select("*, store_preorder_items(product_id)")
    .eq("is_active", true)
    .order("order_deadline", { ascending: true });

  return NextResponse.json({ products: products ?? [], preorders: preorders ?? [] });
}
