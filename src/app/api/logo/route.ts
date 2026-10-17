import { NextResponse } from "next/server";
import { apiStore, apiError, ApiError } from "@/lib/http";
export async function GET(request: Request) {
  try {
    const { store, supabase } = await apiStore();
    const path = new URL(request.url).searchParams.get("path");
    if (!path || path !== store.logo_path || !path.startsWith(store.id + "/"))
      throw new ApiError(404, "Logo introuvable.");
    const { data, error } = await supabase.storage
      .from("store-logos")
      .createSignedUrl(path, 60);
    if (error || !data) throw new ApiError(404, "Logo introuvable.");
    return NextResponse.redirect(data.signedUrl, {
      headers: { "Cache-Control": "private, no-store" },
    });
  } catch (error) {
    return apiError(error);
  }
}
