import { type NextRequest, NextResponse } from "next/server";
import { serverClient } from "@/lib/supabase/server";
import { supabaseConfigured } from "@/lib/config";
export async function GET(request: NextRequest) {
  if (!supabaseConfigured())
    return NextResponse.redirect(new URL("/login?setup=1", request.url));
  const params = request.nextUrl.searchParams,
    client = await serverClient();
  const hash = params.get("token_hash"),
    code = params.get("code");
  let ok = false;
  if (hash && params.get("type") === "email") {
    const result = await client.auth.verifyOtp({
      type: "email",
      token_hash: hash,
    });
    ok = !result.error;
  } else if (code) {
    const result = await client.auth.exchangeCodeForSession(code);
    ok = !result.error;
  }
  return NextResponse.redirect(
    new URL(ok ? "/" : "/login?error=confirmation", request.url),
  );
}
