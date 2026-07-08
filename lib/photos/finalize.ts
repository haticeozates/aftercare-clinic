import {
  PHOTO_BUCKETS,
  type PhotoAllowedMimeType
} from "@/lib/photos/contracts";
import { createOpaquePhotoObjectKey } from "@/lib/photos/keys";
import { inspectAndSanitizePhoto } from "@/lib/photos/image-processing";

export type PhotoFinalizeResult =
  | { ok: true; status: "ready" | "already_finalized" }
  | { ok: false; reason: "request_invalid" | "incoming_missing" | "decode_failed" | "storage_write_failed" | "finalize_failed" };

export type ClaimedPhotoIntent =
  | {
      status: "processing";
      claimId: string;
      incomingObjectKey: string;
      declaredMimeType: PhotoAllowedMimeType;
    }
  | { status: "already_finalized" }
  | { error: string };

export interface PhotoFinalizeDatabaseAdapter {
  claimIntent(input: { sessionHash: string; intentId: string }): Promise<ClaimedPhotoIntent>;
  recordFinalized(input: {
    sessionHash: string;
    intentId: string;
    claimId: string;
    finalObjectKey: string;
    verifiedSizeBytes: number;
    width: number;
    height: number;
    checksumSha256: string;
  }): Promise<{ status: "ready" | "already_finalized" } | { error: string }>;
}

export interface PhotoFinalizeStorageAdapter {
  downloadIncoming(input: { incomingObjectKey: string }): Promise<Buffer | null>;
  uploadFinal(input: {
    finalObjectKey: string;
    bytes: Buffer;
    contentType: "image/webp";
  }): Promise<{ ok: true } | { ok: false; reason: string }>;
  deleteObject(key: string): Promise<{ ok: true } | { ok: false; reason: string }>;
}

export async function finalizePhotoUploadWithAdapters(input: {
  sessionHash: string;
  intentId: string;
  database: PhotoFinalizeDatabaseAdapter;
  storage: PhotoFinalizeStorageAdapter;
}): Promise<PhotoFinalizeResult> {
  const claim = await input.database.claimIntent({
    sessionHash: input.sessionHash,
    intentId: input.intentId
  });

  if ("error" in claim) {
    return { ok: false, reason: "request_invalid" };
  }

  if (claim.status === "already_finalized") {
    return { ok: true, status: "already_finalized" };
  }

  const incomingBytes = await input.storage.downloadIncoming({
    incomingObjectKey: claim.incomingObjectKey
  });

  if (!incomingBytes) {
    return { ok: false, reason: "incoming_missing" };
  }

  const sanitized = await inspectAndSanitizePhoto({
    bytes: incomingBytes,
    declaredMimeType: claim.declaredMimeType
  });

  if (!sanitized.ok) {
    return { ok: false, reason: "decode_failed" };
  }

  const finalObjectKey = createOpaquePhotoObjectKey("photos");
  const upload = await input.storage.uploadFinal({
    finalObjectKey,
    bytes: sanitized.outputBytes,
    contentType: PHOTO_BUCKETS.final === "care-photos" ? "image/webp" : "image/webp"
  });

  if (!upload.ok) {
    return { ok: false, reason: "storage_write_failed" };
  }

  const recorded = await input.database.recordFinalized({
    sessionHash: input.sessionHash,
    intentId: input.intentId,
    claimId: claim.claimId,
    finalObjectKey,
    verifiedSizeBytes: sanitized.verifiedSizeBytes,
    width: sanitized.width,
    height: sanitized.height,
    checksumSha256: sanitized.checksumSha256
  });

  if ("error" in recorded) {
    await input.storage.deleteObject(finalObjectKey).catch(() => ({ ok: false as const, reason: "delete_failed" }));
    return { ok: false, reason: "finalize_failed" };
  }

  await input.storage.deleteObject(claim.incomingObjectKey).catch(() => ({ ok: false as const, reason: "delete_failed" }));

  return {
    ok: true,
    status: recorded.status
  };
}
