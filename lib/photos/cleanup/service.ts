import {
  PHOTO_CLEANUP_BATCH_SIZE,
  buildEmptyCleanupSummary,
  summarizeCleanupResult,
  type CleanupClassification,
  type CleanupSkipReason,
  type CleanupStorageObject,
  type PhotoCleanupMode,
  type PhotoCleanupSummary
} from "@/lib/photos/cleanup/contracts";

function incrementSkip(summary: PhotoCleanupSummary, reason: CleanupSkipReason) {
  if (reason === "active_intent") {
    summary.skipped.activeIntent += 1;
  } else if (reason === "processing") {
    summary.skipped.processing += 1;
  } else if (reason === "referenced_record") {
    summary.skipped.referencedRecord += 1;
  } else if (reason === "too_new") {
    summary.skipped.tooNew += 1;
  } else {
    summary.skipped.uncertain += 1;
  }
}

async function processObject(input: {
  bucket: "incoming" | "final";
  object: CleanupStorageObject;
  summary: PhotoCleanupSummary;
  mode: PhotoCleanupMode;
  classify: (object: CleanupStorageObject) => Promise<CleanupClassification>;
  deleteObject: (bucket: "incoming" | "final", key: string) => Promise<{ ok: true } | { ok: false }>;
}) {
  const classification = await input.classify(input.object);

  if (classification.action === "skip") {
    incrementSkip(input.summary, classification.reason);
    return;
  }

  input.summary.candidates[input.bucket] += 1;
  if (input.mode === "dry_run") {
    return;
  }

  const deleted = await input.deleteObject(input.bucket, input.object.key);
  if (deleted.ok) {
    input.summary.deleted[input.bucket] += 1;
  } else {
    input.summary.failed += 1;
  }
}

export async function runPhotoCleanupWithAdapters(input: {
  mode: PhotoCleanupMode;
  now?: Date;
  listIncomingObjects: () => Promise<CleanupStorageObject[]>;
  listFinalObjects: () => Promise<CleanupStorageObject[]>;
  classifyIncomingObject: (object: CleanupStorageObject) => Promise<CleanupClassification>;
  classifyFinalObject: (object: CleanupStorageObject) => Promise<CleanupClassification>;
  deleteObject: (bucket: "incoming" | "final", key: string) => Promise<{ ok: true } | { ok: false }> | { ok: true } | { ok: false };
}): Promise<PhotoCleanupSummary> {
  const startedAt = (input.now ?? new Date()).toISOString();
  const summary = buildEmptyCleanupSummary(input.mode, startedAt);
  const incoming = (await input.listIncomingObjects()).slice(0, PHOTO_CLEANUP_BATCH_SIZE);
  const final = (await input.listFinalObjects()).slice(0, PHOTO_CLEANUP_BATCH_SIZE);

  summary.scanned.incoming = incoming.length;
  summary.scanned.final = final.length;

  for (const object of incoming) {
    await processObject({
      bucket: "incoming",
      object,
      summary,
      mode: input.mode,
      classify: input.classifyIncomingObject,
      deleteObject: async (bucket, key) => input.deleteObject(bucket, key)
    });
  }

  for (const object of final) {
    await processObject({
      bucket: "final",
      object,
      summary,
      mode: input.mode,
      classify: input.classifyFinalObject,
      deleteObject: async (bucket, key) => input.deleteObject(bucket, key)
    });
  }

  summary.completedAt = (input.now ?? new Date()).toISOString();
  return summarizeCleanupResult(summary);
}
