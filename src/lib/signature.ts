import { createHmac, timingSafeEqual } from "node:crypto";
export function signWebhook(body: string, timestamp: string, secret: string) {
  return createHmac("sha256", secret)
    .update(timestamp + "." + body)
    .digest("hex");
}
export function verifyWebhook(
  body: string,
  timestamp: string | null,
  signature: string | null,
  secret: string,
  now = Date.now(),
) {
  if (
    secret.length < 32 ||
    !timestamp ||
    !signature ||
    !/^\d{10,13}$/.test(timestamp) ||
    !/^sha256=[a-f\d]{64}$/.test(signature)
  )
    return false;
  if (Math.abs(now - Number(timestamp)) > 300000) return false;
  const expected = Buffer.from(signWebhook(body, timestamp, secret), "hex"),
    actual = Buffer.from(signature.slice(7), "hex");
  return expected.length === actual.length && timingSafeEqual(expected, actual);
}
