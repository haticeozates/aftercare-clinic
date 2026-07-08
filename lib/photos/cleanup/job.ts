import "server-only";

import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import { createPhotoCleanupStorageAdapter } from "@/lib/photos/cleanup/storage";
import {
  runPhotoCleanupWithAdapters,
  type CleanupClassification,
  type CleanupStorageObject,
  type PhotoCleanupMode,
  type PhotoCleanupSummary
} from "@/lib/photos/cleanup";

const CLEANUP_JOB_NAME = "photo-storage-cleanup";
const LOCK_TTL_MINUTES = 20;

function normalizeClassification(payload: unknown): CleanupClassification {
  const value = payload as Record<string, unknown> | null;
  if (value?.action === "delete") {
    const reason = String(value.reason ?? "orphan_final");
    return {
      action: "delete",
      reason: reason === "expired_processing" ? "expired_processing" : reason === "expired_incoming" ? "expired_incoming" : "orphan_final"
    };
  }

  const reason = String(value?.reason ?? "uncertain");
  if (reason === "active_intent" || reason === "processing" || reason === "referenced_record" || reason === "too_new") {
    return { action: "skip", reason };
  }

  return { action: "skip", reason: "uncertain" };
}

async function recordCleanupAudit(input: { summary: PhotoCleanupSummary; result: "success" | "failure"; startedAt: number }) {
  const supabase = createAdminSupabaseClient();
  await supabase.rpc("record_photo_cleanup_audit", {
    target_mode: input.summary.mode,
    target_result: input.result,
    target_scanned_incoming: input.summary.scanned.incoming,
    target_scanned_final: input.summary.scanned.final,
    target_candidate_incoming: input.summary.candidates.incoming,
    target_candidate_final: input.summary.candidates.final,
    target_deleted_incoming: input.summary.deleted.incoming,
    target_deleted_final: input.summary.deleted.final,
    target_failed: input.summary.failed,
    target_duration_ms: Math.max(0, Date.now() - input.startedAt)
  });
}

export async function runPhotoCleanupJob(mode: PhotoCleanupMode): Promise<PhotoCleanupSummary | { status: "already_running" }> {
  const startedAt = Date.now();
  const supabase = createAdminSupabaseClient();
  const lock = await supabase.rpc("acquire_photo_cleanup_lock", {
    target_job_name: CLEANUP_JOB_NAME,
    target_locked_until: new Date(Date.now() + LOCK_TTL_MINUTES * 60 * 1000).toISOString()
  });

  const lockPayload = lock.data as Record<string, unknown> | null;
  if (lock.error || lockPayload?.status !== "acquired") {
    return { status: "already_running" };
  }

  const lockToken = String(lockPayload.lock_token ?? "");
  const storage = createPhotoCleanupStorageAdapter(supabase);

  try {
    const summary = await runPhotoCleanupWithAdapters({
      mode,
      listIncomingObjects: () => storage.listIncomingObjects(),
      listFinalObjects: () => storage.listFinalObjects(),
      classifyIncomingObject: async (object: CleanupStorageObject) => {
        const { data } = await supabase.rpc("classify_photo_cleanup_candidate", {
          target_bucket_kind: "incoming",
          target_object_key: object.key,
          target_object_created_at: object.createdAt
        });
        return normalizeClassification(data);
      },
      classifyFinalObject: async (object: CleanupStorageObject) => {
        const { data } = await supabase.rpc("classify_photo_cleanup_candidate", {
          target_bucket_kind: "final",
          target_object_key: object.key,
          target_object_created_at: object.createdAt
        });
        return normalizeClassification(data);
      },
      deleteObject: (bucket, key) => storage.deleteObject(bucket, key)
    });

    await recordCleanupAudit({ summary, result: summary.failed > 0 ? "failure" : "success", startedAt });
    return summary;
  } catch {
    const failedSummary: PhotoCleanupSummary = {
      mode,
      scanned: { incoming: 0, final: 0 },
      candidates: { incoming: 0, final: 0 },
      deleted: { incoming: 0, final: 0 },
      skipped: { activeIntent: 0, processing: 0, referencedRecord: 0, tooNew: 0, uncertain: 0 },
      failed: 1,
      startedAt: new Date(startedAt).toISOString(),
      completedAt: new Date().toISOString()
    };
    await recordCleanupAudit({ summary: failedSummary, result: "failure", startedAt });
    return failedSummary;
  } finally {
    if (lockToken) {
      await supabase.rpc("release_photo_cleanup_lock", { target_lock_token: lockToken });
    }
  }
}
