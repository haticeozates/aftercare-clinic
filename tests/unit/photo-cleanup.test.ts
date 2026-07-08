import { describe, expect, it, vi } from "vitest";
import {
  PHOTO_CLEANUP_BATCH_SIZE,
  PHOTO_FINAL_ORPHAN_MIN_AGE_HOURS,
  PHOTO_INCOMING_ORPHAN_MIN_AGE_HOURS,
  buildEmptyCleanupSummary,
  classifyFinalCleanupCandidate,
  classifyIncomingCleanupCandidate,
  sanitizeCleanupError,
  summarizeCleanupResult,
  runPhotoCleanupWithAdapters
} from "@/lib/photos/cleanup";

const now = new Date("2026-07-08T12:00:00.000Z");

function hoursAgo(hours: number) {
  return new Date(now.getTime() - hours * 60 * 60 * 1000).toISOString();
}

describe("photo cleanup classification contracts", () => {
  it("uses conservative safety defaults", () => {
    expect(PHOTO_INCOMING_ORPHAN_MIN_AGE_HOURS).toBe(24);
    expect(PHOTO_FINAL_ORPHAN_MIN_AGE_HOURS).toBe(24);
    expect(PHOTO_CLEANUP_BATCH_SIZE).toBe(100);
  });

  it("skips new incoming objects even if their intent is expired", () => {
    expect(
      classifyIncomingCleanupCandidate({
        objectKey: "incoming/new",
        objectCreatedAt: hoursAgo(2),
        intentStatus: "expired",
        intentExpiresAt: hoursAgo(1),
        processingStartedAt: null,
        hasPhotoRecord: false,
        now
      })
    ).toEqual({ action: "skip", reason: "too_new" });
  });

  it("marks old expired pending incoming objects as cleanup candidates", () => {
    expect(
      classifyIncomingCleanupCandidate({
        objectKey: "incoming/old",
        objectCreatedAt: hoursAgo(30),
        intentStatus: "pending",
        intentExpiresAt: hoursAgo(25),
        processingStartedAt: null,
        hasPhotoRecord: false,
        now
      })
    ).toEqual({ action: "delete", reason: "expired_incoming" });
  });

  it("skips active pending and active processing incoming objects", () => {
    expect(
      classifyIncomingCleanupCandidate({
        objectKey: "incoming/active",
        objectCreatedAt: hoursAgo(30),
        intentStatus: "pending",
        intentExpiresAt: new Date(now.getTime() + 60_000).toISOString(),
        processingStartedAt: null,
        hasPhotoRecord: false,
        now
      })
    ).toEqual({ action: "skip", reason: "active_intent" });

    expect(
      classifyIncomingCleanupCandidate({
        objectKey: "incoming/processing",
        objectCreatedAt: hoursAgo(30),
        intentStatus: "processing",
        intentExpiresAt: hoursAgo(25),
        processingStartedAt: new Date(now.getTime() - 2 * 60_000).toISOString(),
        hasPhotoRecord: false,
        now
      })
    ).toEqual({ action: "skip", reason: "processing" });
  });

  it("marks old unreferenced final objects as candidates and referenced final objects as skipped", () => {
    expect(
      classifyFinalCleanupCandidate({
        objectKey: "photos/orphan.webp",
        objectCreatedAt: hoursAgo(30),
        isReferencedByRecord: false,
        hasActiveProcessingIntent: false,
        now
      })
    ).toEqual({ action: "delete", reason: "orphan_final" });

    expect(
      classifyFinalCleanupCandidate({
        objectKey: "photos/referenced.webp",
        objectCreatedAt: hoursAgo(30),
        isReferencedByRecord: true,
        hasActiveProcessingIntent: false,
        now
      })
    ).toEqual({ action: "skip", reason: "referenced_record" });
  });

  it("sanitizes raw errors and never serializes object keys in summaries", () => {
    expect(sanitizeCleanupError(new Error("failed to delete photos/secret.webp token=abc"))).toBe("cleanup_failed");
    expect(JSON.stringify(buildEmptyCleanupSummary("dry_run", now.toISOString()))).not.toMatch(/photos\/|incoming\/|token/i);
  });
});

describe("photo cleanup execution contracts", () => {
  it("dry-run counts candidates without deleting storage objects", async () => {
    const deleteObject = vi.fn();
    const result = await runPhotoCleanupWithAdapters({
      mode: "dry_run",
      now,
      listIncomingObjects: async () => [{ key: "incoming/old", createdAt: hoursAgo(30) }],
      listFinalObjects: async () => [{ key: "photos/orphan.webp", createdAt: hoursAgo(30) }],
      classifyIncomingObject: async () => ({ action: "delete", reason: "expired_incoming" }),
      classifyFinalObject: async () => ({ action: "delete", reason: "orphan_final" }),
      deleteObject
    });

    expect(result.candidates).toEqual({ incoming: 1, final: 1 });
    expect(result.deleted).toEqual({ incoming: 0, final: 0 });
    expect(deleteObject).not.toHaveBeenCalled();
    expect(JSON.stringify(summarizeCleanupResult(result))).not.toMatch(/incoming\/|photos\//);
  });

  it("execute deletes only classified candidates and tracks failures safely", async () => {
    const result = await runPhotoCleanupWithAdapters({
      mode: "execute",
      now,
      listIncomingObjects: async () => [
        { key: "incoming/candidate", createdAt: hoursAgo(30) },
        { key: "incoming/active", createdAt: hoursAgo(30) }
      ],
      listFinalObjects: async () => [{ key: "photos/referenced.webp", createdAt: hoursAgo(30) }],
      classifyIncomingObject: async (object) =>
        object.key.includes("candidate")
          ? { action: "delete", reason: "expired_incoming" }
          : { action: "skip", reason: "active_intent" },
      classifyFinalObject: async () => ({ action: "skip", reason: "referenced_record" }),
      deleteObject: async () => ({ ok: true })
    });

    expect(result.candidates).toEqual({ incoming: 1, final: 0 });
    expect(result.deleted).toEqual({ incoming: 1, final: 0 });
    expect(result.skipped.activeIntent).toBe(1);
    expect(result.skipped.referencedRecord).toBe(1);
  });
});
