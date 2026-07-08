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

function intentStatusForError(code: unknown) {
  if (code === "unsupported_mime_type" || code === "file_too_large") {
    return 400;
  }

  if (code === "rate_limited") {
    return 429;
  }

  if (code === "intent_processing" || code === "already_finalized") {
    return 409;
  }

  return 403;
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
  const incomingObjectKey = createOpaquePhotoObjectKey("incoming");
  const expiresAt = new Date(Date.now() + PHOTO_INTENT_TTL_MS).toISOString();
  const { data, error } = await supabase.rpc("create_photo_upload_intent_for_portal", {
    target_session_hash: sessionHash,
    target_photo_request_id: input.photoRequestId,
    target_declared_mime_type: input.declaredMime,
    target_declared_size_bytes: input.sizeBytes,
    target_incoming_object_key: incomingObjectKey,
    target_expires_at: expiresAt
  });

  if (error || !data) {
    return { error: safeError("upload_failed"), status: 500 };
  }

  const intent = data as Record<string, unknown>;
  if (intent.status !== "created") {
    const code = String(intent.error ?? "request_invalid");
    return { error: safeError(code), status: intentStatusForError(code) };
  }

  const storage = createPhotoStorageAdapter(supabase);
  const signed = await storage.createSignedIncomingUpload(String(intent.incoming_object_key ?? ""));
  if (!signed) {
    return { error: safeError("upload_failed"), status: 500 };
  }

  return {
    data: buildPhotoUploadCredential({
      intentId: String(intent.intent_id ?? ""),
      path: signed.path,
      token: signed.token,
      expiresAt: String(intent.expires_at ?? expiresAt)
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
