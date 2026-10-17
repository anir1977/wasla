import "server-only";
import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { serverClient } from "@/lib/supabase/server";
import { isDemo, supabaseConfigured } from "@/lib/config";
import type { Store } from "@/lib/types";
export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}
export async function apiStore() {
  if (isDemo())
    throw new ApiError(409, "Mode démo : connexion réelle désactivée.");
  if (!supabaseConfigured())
    throw new ApiError(503, "Configurez Supabase pour activer ce service.");
  const supabase = await serverClient();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();
  if (error || !user) throw new ApiError(401, "Connexion requise.");
  const { data: store, error: dbError } = await supabase
    .from("stores")
    .select("*")
    .eq("owner_id", user.id)
    .single();
  if (dbError || !store)
    throw new ApiError(
      404,
      "Boutique introuvable. Ouvrez votre tableau de bord.",
    );
  return { supabase, user, store: store as Store };
}
export function assertOrigin(request: Request) {
  const allowed = new URL(process.env.APP_URL || "http://localhost:3000")
    .origin;
  if (request.headers.get("origin") !== allowed)
    throw new ApiError(403, "Origine de requête refusée.");
}
export function apiError(error: unknown) {
  if (error instanceof ApiError)
    return NextResponse.json(
      { error: error.message },
      { status: error.status },
    );
  if (error instanceof ZodError)
    return NextResponse.json(
      { error: "Champs invalides. Vérifiez les informations saisies." },
      { status: 400 },
    );
  return NextResponse.json(
    { error: "Service indisponible. Réessayez dans un instant." },
    { status: 503 },
  );
}
export async function limitedBytes(request: Request, limit = 20000) {
  const reader = request.body?.getReader();
  if (!reader) return Buffer.alloc(0);
  const chunks: Uint8Array[] = [];
  let size = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.length;
    if (size > limit) {
      await reader.cancel();
      throw new ApiError(413, "Requête trop volumineuse.");
    }
    chunks.push(value);
  }
  return Buffer.concat(chunks);
}
export async function limitedText(request: Request, limit = 20000) {
  return (await limitedBytes(request, limit)).toString("utf8");
}
export async function jsonBody(request: Request) {
  if (!request.headers.get("content-type")?.startsWith("application/json"))
    throw new ApiError(415, "JSON requis.");
  const raw = await limitedText(request);
  try {
    return JSON.parse(raw);
  } catch {
    throw new ApiError(400, "JSON invalide.");
  }
}
