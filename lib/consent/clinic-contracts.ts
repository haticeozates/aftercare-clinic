import { z } from "zod";
import { consentDocumentKindSchema } from "./index";

export const createConsentDocumentInputSchema = z.object({
  code: z.string().trim().toLowerCase().min(1),
  title: z.string().trim().min(1),
  documentKind: consentDocumentKindSchema,
  purposeKey: z.string().trim().toLowerCase().min(1),
  initialDraftTitle: z.string().trim().min(1),
  initialDraftSummary: z.string().trim().nullable().optional(),
  initialDraftBody: z.string().trim().min(20, "Body must be at least 20 chars")
});

export type CreateConsentDocumentInput = z.infer<typeof createConsentDocumentInputSchema>;

export function parseCreateConsentDocumentInput(input: unknown): CreateConsentDocumentInput {
  return createConsentDocumentInputSchema.parse(input);
}

