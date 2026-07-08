export const PHOTO_INCOMING_ORPHAN_MIN_AGE_HOURS = 24;
export const PHOTO_FINAL_ORPHAN_MIN_AGE_HOURS = 24;
export const PHOTO_CLEANUP_BATCH_SIZE = 100;

export type PhotoCleanupMode = "dry_run" | "execute";

export type CleanupSkipReason =
  | "active_intent"
  | "processing"
  | "referenced_record"
  | "too_new"
  | "uncertain";

export type CleanupDeleteReason = "expired_incoming" | "expired_processing" | "orphan_final";

export type CleanupClassification =
  | { action: "delete"; reason: CleanupDeleteReason }
  | { action: "skip"; reason: CleanupSkipReason };

export interface CleanupStorageObject {
  key: string;
  createdAt: string;
}

export interface PhotoCleanupSummary {
  mode: PhotoCleanupMode;
  scanned: {
    incoming: number;
    final: number;
  };
  candidates: {
    incoming: number;
    final: number;
  };
  deleted: {
    incoming: number;
    final: number;
  };
  skipped: {
    activeIntent: number;
    processing: number;
    referencedRecord: number;
    tooNew: number;
    uncertain: number;
  };
  failed: number;
  startedAt: string;
  completedAt: string;
}

export function buildEmptyCleanupSummary(mode: PhotoCleanupMode, startedAt: string): PhotoCleanupSummary {
  return {
    mode,
    scanned: { incoming: 0, final: 0 },
    candidates: { incoming: 0, final: 0 },
    deleted: { incoming: 0, final: 0 },
    skipped: {
      activeIntent: 0,
      processing: 0,
      referencedRecord: 0,
      tooNew: 0,
      uncertain: 0
    },
    failed: 0,
    startedAt,
    completedAt: startedAt
  };
}

export function summarizeCleanupResult(result: PhotoCleanupSummary): PhotoCleanupSummary {
  return {
    mode: result.mode,
    scanned: { ...result.scanned },
    candidates: { ...result.candidates },
    deleted: { ...result.deleted },
    skipped: { ...result.skipped },
    failed: result.failed,
    startedAt: result.startedAt,
    completedAt: result.completedAt
  };
}
