import "server-only";

import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { createPhotoStorageAdapter } from "@/lib/photos/storage";

const PHOTO_VIEW_TTL_SECONDS = 60;

export type ClinicPhotoViewResult =
  | {
      ok: true;
      photo: {
        id: string;
        signedUrl: string;
        expiresAt: string;
        mimeType: "image/webp";
        width: number;
        height: number;
        uploadedAt: string;
      };
    }
  | { ok: false; status: 401 | 404 | 500; error: string };

function genericNotFound(): ClinicPhotoViewResult {
  return {
    ok: false,
    status: 404,
    error: "Fotoğraf kaydı bulunamadı."
  };
}

export async function requestClinicPhotoViewUrl(photoRecordId: string): Promise<ClinicPhotoViewResult> {
  const sessionSupabase = await createServerSupabaseClient();
  const { data: claims } = await sessionSupabase.auth.getClaims();
  const actorUserId = claims?.claims?.sub;

  if (!actorUserId) {
    return {
      ok: false,
      status: 401,
      error: "Bu fotoğrafa erişim yetkiniz bulunmuyor."
    };
  }

  const adminSupabase = createAdminSupabaseClient();
  const { data, error } = await adminSupabase.rpc("authorize_photo_view_for_staff", {
    target_actor_user_id: actorUserId,
    target_photo_record_id: photoRecordId
  });

  if (error || !data) {
    return genericNotFound();
  }

  const payload = data as Record<string, unknown>;
  if (payload.status !== "authorized") {
    return genericNotFound();
  }

  const finalObjectKey = String(payload.final_object_key ?? "");
  if (!finalObjectKey) {
    return genericNotFound();
  }

  const storage = createPhotoStorageAdapter(adminSupabase);
  const signed = await storage.createSignedFinalViewUrl({
    finalObjectKey,
    expiresInSeconds: PHOTO_VIEW_TTL_SECONDS
  });

  if (!signed) {
    return {
      ok: false,
      status: 500,
      error: "Fotoğraf şu anda görüntülenemiyor. Lütfen tekrar deneyin."
    };
  }

  return {
    ok: true,
    photo: {
      id: String(payload.photo_record_id ?? photoRecordId),
      signedUrl: signed.signedUrl,
      expiresAt: new Date(Date.now() + PHOTO_VIEW_TTL_SECONDS * 1000).toISOString(),
      mimeType: "image/webp",
      width: Number(payload.width ?? 0),
      height: Number(payload.height ?? 0),
      uploadedAt: String(payload.uploaded_at ?? "")
    }
  };
}
