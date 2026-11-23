"use server";

import { headers } from "next/headers";
import type { InquiryKind, InquiryState } from "./inquiry";
import { recordPublicInquiry } from "./submit-inquiry";

export async function submitPublicInquiry(
  kind: InquiryKind,
  _previous: InquiryState,
  form: FormData
): Promise<InquiryState> {
  const header = await headers();
  const forwarded = header.get("x-forwarded-for")?.split(",").at(-1)?.trim();
  const client = forwarded || header.get("x-real-ip") || "unavailable";
  return recordPublicInquiry(kind, form, client);
}
