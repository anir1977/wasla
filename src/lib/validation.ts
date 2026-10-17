import { z } from "zod";
export const variantInput = z.object({
  id: z.uuid().optional(),
  size: z.enum(["S", "M", "L", "XL"]),
  color: z.string().trim().min(1).max(40),
  stock: z.number().int().min(0).max(1000000),
});
export const productInput = z
  .object({
    id: z.uuid().optional(),
    name: z.string().trim().min(1).max(120),
    description: z.string().trim().max(1000).default(""),
    price_mad: z.number().positive().max(100000).multipleOf(0.01),
    active: z.boolean(),
    variants: z.array(variantInput).min(1).max(100),
  })
  .refine(
    (value) =>
      new Set(value.variants.map((v) => v.size + "|" + v.color.toLowerCase()))
        .size === value.variants.length,
    "Tailles et couleurs doivent être uniques.",
  );
export function normalizePhone(value: string) {
  let digits = value.replace(/[+ ().-]/g, "");
  if (digits.startsWith("00")) digits = digits.slice(2);
  if (/^0[5-7]\d{8}$/.test(digits)) digits = "212" + digits.slice(1);
  if (!/^[1-9]\d{7,14}$/.test(digits))
    throw new Error("Numéro de téléphone invalide.");
  return "+" + digits;
}
export const settingsInput = z.object({
  name: z.string().trim().min(1).max(100),
  phone: z.string().transform((value, ctx) => {
    try {
      return normalizePhone(value);
    } catch {
      ctx.addIssue({ code: "custom", message: "Numéro invalide." });
      return z.NEVER;
    }
  }),
  delivery_casa: z.number().min(0).max(1000).multipleOf(0.01),
  delivery_other: z.number().min(0).max(1000).multipleOf(0.01),
  ai_enabled: z.boolean(),
});
export const extractionSchema = z.object({
  reply: z.string().min(1).max(1800),
  intent: z.enum(["QUESTION", "COLLECTING", "CONFIRM_PURCHASE"]),
  explicit_confirmation: z.boolean(),
  customer_name: z.string().max(100).nullable(),
  city: z.string().max(100).nullable(),
  address: z.string().max(500).nullable(),
  variant_id: z.string().nullable(),
  quantity: z.number().int().min(1).max(20),
});
export const incomingMessage = z.object({
  storeId: z.uuid(),
  messageId: z.string().min(1).max(150),
  eventId: z.string().min(1).max(200),
  phone: z.string().regex(/^\+[1-9]\d{7,14}$/),
  text: z.string().min(1).max(4000),
  occurredAt: z.string().datetime(),
});
