import { NextResponse } from "next/server";
import { apiStore, apiError } from "@/lib/http";
export async function GET() {
  try {
    const { store, supabase, user } = await apiStore();
    const [products, orders] = await Promise.all([
      supabase
        .from("products")
        .select("*,variants:product_variants(*)")
        .eq("store_id", store.id)
        .order("created_at", { ascending: false }),
      supabase
        .from("orders")
        .select("*")
        .eq("store_id", store.id)
        .order("created_at", { ascending: false })
        .limit(200),
    ]);
    if (products.error || orders.error) throw Error();
    return NextResponse.json(
      {
        store,
        products: products.data,
        orders: orders.data,
        demo: false,
        email: user.email,
      },
      { headers: { "Cache-Control": "private, no-store" } },
    );
  } catch (error) {
    return apiError(error);
  }
}
