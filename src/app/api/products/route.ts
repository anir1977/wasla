import { NextResponse } from "next/server";
import {
  apiStore,
  apiError,
  assertOrigin,
  jsonBody,
  ApiError,
} from "@/lib/http";
import { productInput } from "@/lib/validation";
export async function POST(request: Request) {
  try {
    assertOrigin(request);
    const { store, supabase } = await apiStore();
    const product = productInput.parse(await jsonBody(request));
    const { data, error } = await supabase.rpc("save_product", {
      p_store_id: store.id,
      p_product: product,
    });
    if (error)
      throw new ApiError(
        409,
        "Produit non enregistré. Vérifiez les tailles, les couleurs et les stocks.",
      );
    return NextResponse.json({ id: data });
  } catch (error) {
    return apiError(error);
  }
}
