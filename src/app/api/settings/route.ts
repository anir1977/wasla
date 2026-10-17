import { NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import {
  apiStore,
  apiError,
  assertOrigin,
  ApiError,
  limitedBytes,
} from "@/lib/http";
import { settingsInput } from "@/lib/validation";
function imageType(bytes: Buffer) {
  if (
    bytes.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))
  )
    return { mime: "image/png", ext: "png" };
  if (bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255)
    return { mime: "image/jpeg", ext: "jpg" };
  if (
    bytes.toString("ascii", 0, 4) === "RIFF" &&
    bytes.toString("ascii", 8, 12) === "WEBP"
  )
    return { mime: "image/webp", ext: "webp" };
  throw new ApiError(400, "Logo PNG, JPEG ou WebP requis.");
}
export async function POST(request: Request) {
  try {
    assertOrigin(request);
    const { store, supabase } = await apiStore();
    if (Number(request.headers.get("content-length") || 0) > 2200000)
      throw new ApiError(413, "Logo limité à 2 Mo.");
    const raw = await limitedBytes(request, 2200000);
    const form = await new Response(raw, {
      headers: { "Content-Type": request.headers.get("content-type") || "" },
    }).formData();
    const settings = settingsInput.parse(
      JSON.parse(String(form.get("settings"))),
    );
    let uploaded: string | undefined;
    const logo = form.get("logo");
    if (logo instanceof File && logo.size) {
      if (logo.size > 2097152) throw new ApiError(413, "Logo limité à 2 Mo.");
      const bytes = Buffer.from(await logo.arrayBuffer());
      const type = imageType(bytes);
      uploaded = store.id + "/" + randomUUID() + "." + type.ext;
      const result = await supabase.storage
        .from("store-logos")
        .upload(uploaded, bytes, { contentType: type.mime, upsert: false });
      if (result.error)
        throw new ApiError(
          503,
          "Import du logo impossible. Vérifiez le bucket Storage.",
        );
    }
    const { error } = await supabase
      .from("stores")
      .update({ ...settings, ...(uploaded ? { logo_path: uploaded } : {}) })
      .eq("id", store.id);
    if (error) {
      if (uploaded)
        await supabase.storage.from("store-logos").remove([uploaded]);
      throw new ApiError(503, "Boutique non enregistrée.");
    }
    if (uploaded && store.logo_path)
      await supabase.storage.from("store-logos").remove([store.logo_path]);
    return NextResponse.json({ ok: true });
  } catch (error) {
    return apiError(error);
  }
}
