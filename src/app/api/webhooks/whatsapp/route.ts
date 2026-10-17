import { NextResponse } from "next/server";
import { adminClient } from "@/lib/supabase/admin";
import { verifyWebhook } from "@/lib/signature";
import { incomingMessage } from "@/lib/validation";
import { extractConversation } from "@/lib/ai/assistant";
import { validatePurchase } from "@/lib/ai/decision";
import { limitedText } from "@/lib/http";
import { isDemo } from "@/lib/config";
import type { Product, Store } from "@/lib/types";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(request: Request) {
  if (isDemo())
    return NextResponse.json({ error: "Demo mode" }, { status: 409 });

  let body: string;
  try {
    body = await limitedText(request);
  } catch {
    return NextResponse.json({ error: "Payload too large" }, { status: 413 });
  }

  if (
    !verifyWebhook(
      body,
      request.headers.get("x-wasla-timestamp"),
      request.headers.get("x-wasla-signature"),
      process.env.WHATSAPP_WEBHOOK_SECRET || "",
    )
  )
    return NextResponse.json({ error: "Invalid signature" }, { status: 401 });

  let parsed;
  try {
    parsed = incomingMessage.safeParse(JSON.parse(body));
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  if (!parsed.success)
    return NextResponse.json({ error: "Invalid event" }, { status: 400 });

  const event = parsed.data;
  let admin: ReturnType<typeof adminClient>;
  try {
    admin = adminClient();
  } catch {
    return NextResponse.json(
      { error: "Backend not configured" },
      { status: 503 },
    );
  }

  const claim = await admin.rpc("claim_webhook", {
    p_store_id: event.storeId,
    p_event_id: event.eventId,
  });
  if (claim.error)
    return NextResponse.json(
      { error: "Event storage unavailable" },
      { status: 503 },
    );

  if (!claim.data.claimed) {
    if (claim.data.busy)
      return NextResponse.json({ error: "Event processing" }, { status: 409 });
    return NextResponse.json(claim.data.response);
  }

  try {
    const { data: store, error: storeError } = await admin
      .from("stores")
      .select("*")
      .eq("id", event.storeId)
      .single();
    if (storeError || !store) throw Error("Store unavailable");

    // Recover a committed order without spending tokens or changing the decision on a retry.
    const prior = await admin
      .from("orders")
      .select("*")
      .eq("store_id", event.storeId)
      .eq("source_message_id", event.messageId)
      .maybeSingle();
    if (prior.error) throw Error("Order lookup failed");
    if (prior.data) {
      const o = prior.data;
      const reply = `Safi ${o.customer_name}, talabiya dyalk t2akdat ✅\n${o.product_name} · ${o.size} · ${o.color} ×${o.quantity}\nTotal : ${o.total_mad} DH (livraison incluse)\nRéf. ${String(o.id).slice(-6).toUpperCase()}`;
      const stored = await admin
        .from("messages")
        .upsert(
          {
            store_id: event.storeId,
            phone: event.phone,
            provider_id: event.messageId,
            role: "assistant",
            content: reply,
          },
          { onConflict: "store_id,provider_id,role", ignoreDuplicates: true },
        );
      if (stored.error) throw Error();
      const response = { ok: true, reply, orderId: o.id };
      await finish(response);
      return NextResponse.json(response);
    }

    if (!store.ai_enabled) {
      const response = { ok: true, reply: null, reason: "assistant_disabled" };
      await finish(response);
      return NextResponse.json(response);
    }

    const quota = await admin.rpc("reserve_ai_call", {
      p_store_id: event.storeId,
    });
    if (quota.error) throw Error("Quota storage unavailable");
    if (!quota.data) {
      const response = { ok: true, reply: null, reason: "hourly_limit" };
      await finish(response);
      return NextResponse.json(response);
    }

    const saved = await admin
      .from("messages")
      .upsert(
        {
          store_id: event.storeId,
          phone: event.phone,
          provider_id: event.messageId,
          role: "user",
          content: event.text,
        },
        { onConflict: "store_id,provider_id,role", ignoreDuplicates: true },
      );
    if (saved.error) throw Error();

    const [products, messages] = await Promise.all([
      admin
        .from("products")
        .select("*,variants:product_variants(*)")
        .eq("store_id", event.storeId)
        .eq("active", true)
        .order("created_at")
        .limit(100),
      admin
        .from("messages")
        .select("role,content")
        .eq("store_id", event.storeId)
        .eq("phone", event.phone)
        .order("created_at", { ascending: false })
        .limit(20),
    ]);
    if (products.error || messages.error) throw Error("Context unavailable");

    const catalog = products.data as Product[];
    const history = messages.data.reverse() as {
      role: "user" | "assistant";
      content: string;
    }[];

    const output = await extractConversation(store as Store, catalog, history);
    let reply = output.reply,
      orderId: string | undefined;

    const purchase = validatePurchase(output, catalog, event.text);
    if (purchase) {
      const committed = await admin.rpc("confirm_order", {
        p_store_id: event.storeId,
        p_variant_id: purchase.variant.id,
        p_customer_name: output.customer_name!.trim(),
        p_phone: event.phone,
        p_city: output.city!.trim(),
        p_address: output.address!.trim(),
        p_quantity: output.quantity,
        p_message_id: event.messageId,
      });
      if (committed.error) {
        reply =
          "Sme7 lia, had variante ma b9atch disponible. N9dro nchoufo taille ou couleur okhra ?";
      } else {
        const order = committed.data;
        orderId = order.id;
        reply = `Safi ${order.customer_name}, talabiya dyalk t2akdat ✅\n${order.product_name} · ${order.size} · ${order.color} ×${order.quantity}\nTotal : ${order.total_mad} DH (livraison ${order.delivery_fee_mad} DH incluse)\n${order.address}, ${order.city}\nRéf. ${String(order.id).slice(-6).toUpperCase()} · Paiement à la livraison.`;
      }
    } else if (output.intent === "CONFIRM_PURCHASE") {
      const missing: string[] = [];
      if (!output.customer_name?.trim()) missing.push("smitk (الاسم)");
      if (!output.city?.trim()) missing.push("l-madina (المدينة)");
      if (!output.address?.trim()) missing.push("l-adresse (العنوان)");
      if (!output.variant_id) missing.push("taille wla couleur");
      reply =
        missing.length > 0
          ? `Marhba bik! 3afak b9at lina ghir ${missing.join(", ")} bach n2akdou talabiya dyalk f l7in إن شاء الله 🚚`
          : "Bach n2akdou talabiya dyalk, 3afak jawb b 'Oui' wla 'Wakha' bach n-sayftouha m3a l-livreur.";
    }

    const stored = await admin
      .from("messages")
      .upsert(
        {
          store_id: event.storeId,
          phone: event.phone,
          provider_id: event.messageId,
          role: "assistant",
          content: reply,
        },
        { onConflict: "store_id,provider_id,role", ignoreDuplicates: true },
      );
    if (stored.error) throw Error("Reply storage unavailable");

    const response = { ok: true, reply, orderId };
    await finish(response);
    return NextResponse.json(response);
  } catch {
    // Do not persist credentials, prompts, customer addresses or provider error bodies in logs.
    await admin
      .from("webhook_events")
      .update({ state: "failed", lease_until: new Date().toISOString() })
      .eq("store_id", event.storeId)
      .eq("event_id", event.eventId);
    return NextResponse.json(
      { error: "Processing unavailable; retry later" },
      { status: 503 },
    );
  }

  async function finish(response: unknown) {
    const result = await admin
      .from("webhook_events")
      .update({ state: "done", response })
      .eq("store_id", event.storeId)
      .eq("event_id", event.eventId);
    if (result.error) throw Error("Event acknowledgement failed");
  }
}
