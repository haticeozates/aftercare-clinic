import "server-only";

import { publicInquiriesEnabled } from "./inquiry-config";
import { consumeSecurityRateLimit, RATE_LIMIT_SCOPES } from "@/lib/rate-limit";
import { deriveRateLimitClientFacet } from "@/lib/rate-limit/keys";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import {
  validateInquiry,
  type InquiryField,
  type InquiryKind,
  type InquiryState
} from "./inquiry";

const unavailable: InquiryState = {
  status: "error",
  message: "Talebiniz şu anda kaydedilemedi. Biraz sonra tekrar deneyin."
};

export async function recordPublicInquiry(
  kind: InquiryKind,
  form: FormData,
  client: string
): Promise<InquiryState> {
  if (!publicInquiriesEnabled()) return unavailable;
  if (kind !== "demo" && kind !== "contact") return unavailable;
  if (form.get("website")) return unavailable;

  const parsed = validateInquiry(kind, form);
  if (!parsed.success) {
    const { fieldErrors } = parsed.error.flatten();
    const fields = Object.fromEntries(
      Object.entries(fieldErrors).map(([field, messages]) => [field, messages?.[0]])
    ) as Partial<Record<InquiryField, string>>;
    return { status: "error", message: "Lütfen işaretli alanları kontrol edin.", fields };
  }

  try {
    const facets = [
      { route: "/inquiry/client", clientFacet: deriveRateLimitClientFacet(client) },
      {
        route: "/inquiry/email",
        clientFacet: deriveRateLimitClientFacet(parsed.data.email)
      },
      {
        route: "/inquiry/total",
        clientFacet: deriveRateLimitClientFacet("public-inquiries")
      }
    ];
    for (const facet of facets) {
      const limit = await consumeSecurityRateLimit({
        scope: RATE_LIMIT_SCOPES.PUBLIC_INQUIRY,
        ...facet
      });
      if (!limit.allowed) {
        return limit.reason === "rate_limited"
          ? {
              status: "error",
              message: "Çok fazla talep gönderildi. Lütfen biraz sonra tekrar deneyin."
            }
          : unavailable;
      }
    }

    const { error } = await createAdminSupabaseClient()
      .from("public_inquiries")
      .insert({ kind, ...parsed.data });
    return error ? unavailable : { status: "success" };
  } catch {
    return unavailable;
  }
}
