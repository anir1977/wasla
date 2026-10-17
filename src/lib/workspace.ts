import "server-only";
import { cache } from "react";
import { redirect } from "next/navigation";
import { serverClient } from "@/lib/supabase/server";
import { isDemo, supabaseConfigured } from "@/lib/config";
import { demoWorkspace } from "@/lib/demo";
import type { Workspace, Store, Product, Order } from "@/lib/types";
export const getIdentity = cache(async () => {
  if (!supabaseConfigured())
    throw new Error("Configurez Supabase dans .env.local.");
  const supabase = await serverClient();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();
  if (error || !user) redirect("/login");
  return { supabase, user };
});
export const getStore = cache(async () => {
  const { supabase, user } = await getIdentity();
  const { data: existingStore, error } = await supabase
    .from("stores")
    .select("*")
    .eq("owner_id", user.id)
    .maybeSingle();
  let store = existingStore;
  if (error)
    throw new Error("Schéma Supabase indisponible. Appliquez la migration.");
  if (!store) {
    const created = await supabase
      .from("stores")
      .upsert(
        { owner_id: user.id, name: "Ma boutique" },
        { onConflict: "owner_id", ignoreDuplicates: true },
      );
    if (created.error) throw new Error("Création de la boutique impossible.");
    const result = await supabase
      .from("stores")
      .select("*")
      .eq("owner_id", user.id)
      .single();
    if (result.error || !result.data) throw new Error("Boutique introuvable.");
    store = result.data;
  }
  return { supabase, user, store: store as Store };
});
export const getWorkspace = cache(async (): Promise<Workspace> => {
  if (isDemo()) return demoWorkspace;
  if (!supabaseConfigured()) redirect("/login?setup=1");
  const { supabase, user, store } = await getStore();
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
  if (products.error || orders.error)
    throw new Error("Lecture des données impossible. Vérifiez la migration.");
  return {
    store,
    products: products.data as Product[],
    orders: orders.data as Order[],
    demo: false,
    email: user.email || "",
  };
});
