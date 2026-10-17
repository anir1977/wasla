import { NextResponse } from "next/server";
import { apiStore, apiError, jsonBody } from "@/lib/http";
import { extractConversation } from "@/lib/ai/assistant";
import { validatePurchase } from "@/lib/ai/decision";
import { isDemo } from "@/lib/config";
import { demoProducts, demoStore } from "@/lib/demo";
import type { Product, Store } from "@/lib/types";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const body = await jsonBody(request);
    const { message, history = [] } = body;
    if (!message || typeof message !== "string") {
      return NextResponse.json({ error: "Message requis" }, { status: 400 });
    }

    let store: Store;
    let catalog: Product[];
    let supabaseClient = null;

    if (isDemo()) {
      store = demoStore as Store;
      catalog = demoProducts;
    } else {
      const auth = await apiStore();
      store = auth.store;
      supabaseClient = auth.supabase;
      const { data: products } = await supabaseClient
        .from("products")
        .select("*,variants:product_variants(*)")
        .eq("store_id", store.id)
        .eq("active", true)
        .order("created_at");
      catalog = (products || []) as Product[];
      if (catalog.length === 0) {
        catalog = demoProducts;
      }
    }

    const conversationHistory = [
      ...history,
      { role: "user" as const, content: message },
    ];

    const output = await extractConversation(store, catalog, conversationHistory);
    let reply = output.reply;
    let order = null;

    const purchase = validatePurchase(output, catalog, message);
    if (purchase && supabaseClient) {
      const committed = await supabaseClient.rpc("confirm_order", {
        p_store_id: store.id,
        p_variant_id: purchase.variant.id,
        p_customer_name: output.customer_name?.trim() || "Client Test",
        p_phone: "+212600000000",
        p_city: output.city?.trim() || "Casablanca",
        p_address: output.address?.trim() || "Centre Ville",
        p_quantity: output.quantity || 1,
        p_message_id: "sim-" + Date.now(),
      });
      if (!committed.error && committed.data) {
        order = committed.data;
        reply = `Safi ${order.customer_name}, talabiya dyalk t2akdat ✅\n${order.product_name} · ${order.size} · ${order.color} ×${order.quantity}\nTotal : ${order.total_mad} DH (livraison ${order.delivery_fee_mad} DH incluse)\n${order.address}, ${order.city}\nRéf. ${String(order.id).slice(-6).toUpperCase()} · Paiement à la livraison.`;
      }
    }

    return NextResponse.json({
      reply,
      order,
      intent: output.intent,
      extracted: output,
    });
  } catch (error) {
    return apiError(error);
  }
}
