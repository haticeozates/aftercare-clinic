import "server-only";

import { cookies } from "next/headers";
import { getServerEnv } from "@/lib/env";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import { hashSecureToken } from "@/lib/secure-links";
import {
  PHOTO_ALLOWED_MIME_TYPES,
  PHOTO_MAX_UPLOAD_BYTES,
  buildPhotoUploadCredential,
  createOpaquePhotoObjectKey,
  finalizePhotoUploadWithAdapters,
  mapPhotoUploadError,
  validateDeclaredPhotoUpload,
  type ClaimedPhotoIntent,
  type PhotoAllowedMimeType,
  type PhotoUploadCredentialDto
} from "@/lib/photos";
import { createPhotoStorageAdapter } from "@/lib/photos/storage";

const PORTAL_COOKIE_NAME = "aftercare_portal_session";
const PHOTO_INTENT_TTL_MS = 5 * 60 * 1000;
const PHOTO_INTENT_HOURLY_LIMIT = 3;

async function getPortalSessionHash() {
  const cookieStore = await cookies();
  const token = cookieStore.get(PORTAL_COOKIE_NAME)?.value;
  if (!token) {
    return null;
  }

  return hashSecureToken(token, getServerEnv().AUDIT_LOG_PEPPER);
}

function safeError(code: unknown) {
  return mapPhotoUploadError(code);
}

export async function requestPortalPhotoUploadIntent(input: {
  photoRequestId: string;
  declaredMime: string;
  sizeBytes: number;
}): Promise<{ data: PhotoUploadCredentialDto } | { error: string; status: number }> {
  const declared = validateDeclaredPhotoUpload({
    mimeType: input.declaredMime,
    sizeBytes: input.sizeBytes
  });
  if (!declared.ok) {
    return { error: safeError(declared.reason), status: 400 };
  }

  const sessionHash = await getPortalSessionHash();
  if (!sessionHash) {
    return { error: safeError("request_invalid"), status: 403 };
  }

  const supabase = createAdminSupabaseClient();
  const { data: sessionId, error: sessionError } = await supabase.rpc("validate_portal_session_hash", {
    target_session_hash: sessionHash
  });

  if (sessionError || !sessionId) {
    return { error: safeError("request_invalid"), status: 403 };
  }

  const { data: session } = await supabase
    .from("portal_sessions")
    .select("id, organization_id, care_plan_id")
    .eq("id", sessionId)
    .single();

  if (!session) {
    return { error: safeError("request_invalid"), status: 403 };
  }

  const { data: request } = await supabase
    .from("photo_requests")
    .select("id, organization_id, care_plan_id, care_plan_day_id, status")
    .eq("id", input.photoRequestId)
    .eq("organization_id", session.organization_id)
    .eq("care_plan_id", session.care_plan_id)
    .single();

  if (!request || request.status !== "active") {
    return { error: safeError("request_invalid"), status: 403 };
  }

  const { data: plan } = await supabase
    .from("care_plans")
    .select("status")
    .eq("id", session.care_plan_id)
    .eq("organization_id", session.organization_id)
    .single();

  if (!plan || plan.status === "stopped" || plan.status === "completed") {
    return { error: safeError("request_invalid"), status: 403 };
  }

  const { data: existingRecord } = await supabase
    .from("photo_records")
    .select("id")
    .eq("organization_id", session.organization_id)
    .eq("photo_request_id", request.id)
    .maybeSingle();

  if (existingRecord) {
    return { error: safeError("request_invalid"), status: 409 };
  }

  const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
  const { count: recentIntentCount } = await supabase
    .from("photo_upload_intents")
    .select("id", { count: "exact", head: true })
    .eq("photo_request_id", request.id)
    .eq("portal_session_id", session.id)
    .gte("created_at", oneHourAgo);

  if ((recentIntentCount ?? 0) >= PHOTO_INTENT_HOURLY_LIMIT) {
    return { error: safeError("upload_failed"), status: 429 };
  }

  const { data: activeIntents } = await supabase
    .from("photo_upload_intents")
    .select("id, status, processing_started_at")
    .eq("photo_request_id", request.id)
    .eq("portal_session_id", session.id)
    .in("status", ["pending", "processing"]);

  const activeProcessingIntent = activeIntents?.find((intent) => {
    if (intent.status !== "processing" || !intent.processing_started_at) {
      return false;
    }

    return new Date(intent.processing_started_at).getTime() > Date.now() - 10 * 60 * 1000;
  });

  if (activeProcessingIntent) {
    return { error: safeError("upload_failed"), status: 409 };
  }

  const staleIntentIds = activeIntents?.map((intent) => intent.id) ?? [];
  if (staleIntentIds.length > 0) {
    await supabase.from("photo_upload_intents").update({ status: "expired" }).in("id", staleIntentIds);
  }

  const incomingObjectKey = createOpaquePhotoObjectKey("incoming");
  const expiresAt = new Date(Date.now() + PHOTO_INTENT_TTL_MS).toISOString();
  const { data: intent, error: insertError } = await supabase
    .from("photo_upload_intents")
    .insert({
      organization_id: session.organization_id,
      photo_request_id: request.id,
      care_plan_id: request.care_plan_id,
      care_plan_day_id: request.care_plan_day_id,
      portal_session_id: session.id,
      incoming_object_key: incomingObjectKey,
      declared_mime_type: input.declaredMime as PhotoAllowedMimeType,
      declared_size_bytes: input.sizeBytes,
      expires_at: expiresAt
    })
    .select("id, incoming_object_key, expires_at")
    .single();

  if (insertError || !intent) {
    return { error: safeError("upload_failed"), status: 409 };
  }

  const storage = createPhotoStorageAdapter(supabase);
  const signed = await storage.createSignedIncomingUpload(intent.incoming_object_key);
  if (!signed) {
    await supabase.from("photo_upload_intents").update({ status: "failed", failed_at: new Date().toISOString(), failure_reason_code: "storage_write_failed" }).eq("id", intent.id);
    return { error: safeError("upload_failed"), status: 500 };
  }

  return {
    data: buildPhotoUploadCredential({
      intentId: intent.id,
      path: signed.path,
      token: signed.token,
      expiresAt: intent.expires_at
    })
  };
}

export async function finalizePortalPhotoUpload(input: {
  intentId: string;
}): Promise<{ data: { ok: true; status: "ready" | "already_finalized" } } | { error: string; status: number }> {
  const sessionHash = await getPortalSessionHash();
  if (!sessionHash) {
    return { error: safeError("request_invalid"), status: 403 };
  }

  const supabase = createAdminSupabaseClient();
  const storage = createPhotoStorageAdapter(supabase);
  const result = await finalizePhotoUploadWithAdapters({
    sessionHash,
    intentId: input.intentId,
    database: {
      async claimIntent({ sessionHash: targetSessionHash, intentId }) {
        const { data, error } = await supabase.rpc("claim_photo_upload_intent_for_portal", {
          target_session_hash: targetSessionHash,
          target_intent_id: intentId
        });

        if (error || !data) {
          return { error: "request_invalid" };
        }

        const payload = data as Record<string, unknown>;
        if (payload.status === "already_finalized") {
          return { status: "already_finalized" };
        }
        if (payload.status !== "processing") {
          return { error: String(payload.error ?? "request_invalid") };
        }

        return {
          status: "processing",
          claimId: String(payload.claim_id ?? ""),
          incomingObjectKey: String(payload.incoming_object_key ?? ""),
          declaredMimeType: payload.declared_mime_type as PhotoAllowedMimeType
        } satisfies ClaimedPhotoIntent;
      },
      async recordFinalized({
        sessionHash: targetSessionHash,
        intentId,
        claimId,
        finalObjectKey,
        verifiedSizeBytes,
        width,
        height,
        checksumSha256
      }) {
        const { data, error } = await supabase.rpc("record_finalized_photo_for_portal", {
          target_session_hash: targetSessionHash,
          target_intent_id: intentId,
          target_processing_claim_id: claimId,
          target_final_object_key: finalObjectKey,
          target_verified_size_bytes: verifiedSizeBytes,
          target_width: width,
          target_height: height,
          target_checksum_sha256: checksumSha256
        });

        if (error || !data) {
          return { error: "db_finalize_failed" };
        }

        const payload = data as Record<string, unknown>;
        if (payload.status === "ready" || payload.status === "already_finalized") {
          return { status: payload.status };
        }

        return { error: String(payload.error ?? "db_finalize_failed") };
      }
    },
    storage
  });

  if (!result.ok) {
    return { error: safeError(result.reason), status: 400 };
  }

  return {
    data: result
  };
}

export function photoUploadIntentLimits() {
  return {
    maxBytes: PHOTO_MAX_UPLOAD_BYTES,
    allowedMimeTypes: PHOTO_ALLOWED_MIME_TYPES
  };
}
