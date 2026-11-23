import "server-only";

import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import { createCorrelationId, logSafeServerEvent } from "@/lib/observability/safe-log";

export const RATE_LIMIT_CLEANUP_BATCH_LIMIT = 100;
const CLEANUP_JOB_NAME = "rate-limit-bucket-cleanup";
const LOCK_TTL_MINUTES = 10;

export type RateLimitCleanupSummary =
  | {
      status: "success";
      scanned: number;
      deleted: number;
      skipped: number;
    }
  | {
      status: "locked";
      scanned: number;
      deleted: number;
      skipped: number;
    }
  | {
      status: "store_unavailable";
      scanned: number;
      deleted: number;
      skipped: number;
    };

export async function runRateLimitCleanupJob(): Promise<RateLimitCleanupSummary> {
  const correlationId = createCorrelationId();
  const supabase = createAdminSupabaseClient();
  const lock = await supabase.rpc("acquire_photo_cleanup_lock", {
    target_job_name: CLEANUP_JOB_NAME,
    target_locked_until: new Date(Date.now() + LOCK_TTL_MINUTES * 60 * 1000).toISOString()
  });

  const lockPayload = lock.data as Record<string, unknown> | null;
  if (lock.error || lockPayload?.status !== "acquired") {
    logSafeServerEvent({
      operation: "rate_limit.cleanup",
      result: "denied",
      correlationId
    });

    return {
      status: "locked",
      scanned: 0,
      deleted: 0,
      skipped: 0
    };
  }

  const lockToken = String(lockPayload.lock_token ?? "");

  try {
    const cleanup = await supabase.rpc("cleanup_expired_rate_limit_buckets", {
      target_batch_limit: RATE_LIMIT_CLEANUP_BATCH_LIMIT
    });

    if (cleanup.error) {
      logSafeServerEvent({
        operation: "rate_limit.cleanup",
        result: "store_unavailable",
        correlationId,
        errorCode: "cleanup_store_unavailable"
      });

      return {
        status: "store_unavailable",
        scanned: 0,
        deleted: 0,
        skipped: 0
      };
    }

    const deleted = Number(cleanup.data ?? 0);
    const summary = {
      status: "success" as const,
      scanned: RATE_LIMIT_CLEANUP_BATCH_LIMIT,
      deleted,
      skipped: Math.max(0, RATE_LIMIT_CLEANUP_BATCH_LIMIT - deleted)
    };

    logSafeServerEvent({
      operation: "rate_limit.cleanup",
      result: "success",
      correlationId
    });

    return summary;
  } catch {
    logSafeServerEvent({
      operation: "rate_limit.cleanup",
      result: "internal_error",
      correlationId,
      errorCode: "cleanup_failed"
    });

    return {
      status: "store_unavailable",
      scanned: 0,
      deleted: 0,
      skipped: 0
    };
  } finally {
    if (lockToken) {
      await supabase.rpc("release_photo_cleanup_lock", { target_lock_token: lockToken });
    }
  }
}
