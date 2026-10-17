import { extractionSchema } from "@/lib/validation";
import type { z } from "zod";
import type { Product } from "@/lib/types";

export type Extraction = z.infer<typeof extractionSchema>;

export function validatePurchase(
  output: Extraction,
  catalog: Product[],
  latestMessage: string,
) {
  if (output.intent !== "CONFIRM_PURCHASE" || !output.explicit_confirmation)
    return null;

  // A catalog inquiry must never silently become a purchase.
  // Expanded to support authentic Moroccan Darija (Arabizi & Arabic) and French confirmations.
  const hasConfirmation =
    /(?:\b(?:oui|ok|okay|d['’]?accord|confirme|confirmer|confirmation|je confirme|c['’]?est bon|parfait|wakha|waxa|safi|safy|ah|aha|iyeh|iyh|eyeh|ayeh|sif[e]?t(?:ouha|ha|ou)?|sayf[e]?t(?:ouha|ha|ou)?|ta[’']?kid|n2aked|naked|n2akdou|akid|t?wak+alna(?: 3la lah)?|bghitha)\b|نأكد|نؤكد|أكد|تأكيد|تاكيد|أكيد|موافق|نعم|إيه|ايه|أه|اه|واخا|صافي|صيفط(?:وها|ها|و)?|ارسل(?:وها|ها)?|توكلنا(?: على الله)?|بغيتها)/iu.test(
      latestMessage,
    );

  if (!hasConfirmation) return null;

  // Explicit cancellation or hesitation guards
  const hasRefusal =
    /(?:\b(?:non|annule|annuler|cancel|blach|m?a[ -]?bghitch|bla[ -]?ma[ -]?tsif[e]?t|la choukran|la chokran)\b|لا أريد|ما بغيتش|بلاش|بلا ما تصيفط|إلغاء|الغاء|لا شكرا)/iu.test(
      latestMessage,
    );

  if (hasRefusal) return null;

  if (
    !output.customer_name?.trim() ||
    !output.city?.trim() ||
    !output.address?.trim() ||
    output.address.trim().length < 3
  )
    return null;

  for (const product of catalog) {
    if (!product.active) continue;
    const variant = product.variants.find((v) => v.id === output.variant_id);
    if (variant && variant.stock >= output.quantity)
      return { product, variant };
  }

  return null;
}
