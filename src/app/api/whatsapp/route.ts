import { NextResponse } from "next/server";
import { apiStore, apiError, assertOrigin } from "@/lib/http";
import { workerRequest } from "@/lib/worker-client";
export async function GET() {
  try {
    const { store } = await apiStore();
    return NextResponse.json(await workerRequest(store.id), {
      headers: { "Cache-Control": "private, no-store" },
    });
  } catch (error) {
    return apiError(error);
  }
}
export async function POST(request: Request) {
  try {
    assertOrigin(request);
    const { store } = await apiStore();
    return NextResponse.json(await workerRequest(store.id, "POST"));
  } catch (error) {
    return apiError(error);
  }
}
