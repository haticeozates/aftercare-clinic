import { z } from "zod";
import {
  parseConsentDocumentInput,
  parseConsentVersionInput,
  type ConsentDocumentKind
} from "./index";

export {
  CONSENT_GENERIC_ERROR,
  mapConsentRpcResult,
  selectPublishedVersionForNewDraft
} from "./index";

export type CreateConsentDocumentInput = {
  code: string;
  title: string;
  documentKind: ConsentDocumentKind;
  purposeKey: string;
  initialDraftTitle: string;
  initialDraftSummary: string | null;
  initialDraftBody: string;
};

const createConsentDocumentFieldsSchema = z.object({
  code: z.unknown(),
  title: z.unknown(),
  documentKind: z.unknown(),
  purposeKey: z.unknown(),
  initialDraftTitle: z.unknown().optional(),
  initialDraftSummary: z.unknown().optional(),
  initialDraftBody: z.unknown().optional(),
  titleSnapshot: z.unknown().optional(),
  summaryText: z.unknown().optional(),
  bodyText: z.unknown().optional()
});

export function parseCreateConsentDocumentInput(input: unknown): CreateConsentDocumentInput {
  const raw = createConsentDocumentFieldsSchema.parse(input);
  const document = parseConsentDocumentInput({
    code: raw.code,
    title: raw.title,
    documentKind: raw.documentKind,
    purposeKey: raw.purposeKey
  });
  const version = parseConsentVersionInput({
    titleSnapshot: raw.initialDraftTitle ?? raw.titleSnapshot,
    summaryText: raw.initialDraftSummary ?? raw.summaryText,
    bodyText: raw.initialDraftBody ?? raw.bodyText
  });

  return {
    code: document.code,
    title: document.title,
    documentKind: document.documentKind,
    purposeKey: document.purposeKey,
    initialDraftTitle: version.titleSnapshot,
    initialDraftSummary: version.summaryText,
    initialDraftBody: version.bodyText
  };
}
