import { NextResponse } from "next/server";
import { z } from "zod";
import {
  apiStore,
  apiError,
  assertOrigin,
  jsonBody,
  ApiError,
} from "@/lib/http";
import { adminClient } from "@/lib/supabase/admin";
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    assertOrigin(request);
    const { store } = await apiStore();
    const { id } = await params;
    z.uuid().parse(id);
    const { status } = z
      .object({ status: z.enum(["CONFIRMED", "CANCELLED", "SHIPPED"]) })
      .parse(await jsonBody(request));
    const { data, error } = await adminClient().rpc("change_order_status", {
      p_store_id: store.id,
      p_order_id: id,
      p_status: status,
    });
    if (error)
      throw new ApiError(
        409,
        "Transition impossible : vérifiez le stock et le statut actuel.",
      );
    return NextResponse.json(data);
  } catch (error) {
    return apiError(error);
  }
}
