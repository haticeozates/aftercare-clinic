import "server-only";

import { PHOTO_BUCKETS } from "@/lib/photos/contracts";

export interface SignedIncomingUpload {
  path: string;
  token: string;
}

export function createPhotoStorageAdapter(supabase: ReturnType<typeof import("@/lib/supabase/admin").createAdminSupabaseClient>) {
  return {
    async createSignedIncomingUpload(path: string): Promise<SignedIncomingUpload | null> {
      const { data, error } = await supabase.storage.from(PHOTO_BUCKETS.incoming).createSignedUploadUrl(path, {
        upsert: false
      });

      if (error || !data) {
        return null;
      }

      return {
        path: data.path,
        token: data.token
      };
    },

    async downloadIncoming(input: { incomingObjectKey: string }) {
      const { data, error } = await supabase.storage.from(PHOTO_BUCKETS.incoming).download(input.incomingObjectKey);
      if (error || !data) {
        return null;
      }

      return Buffer.from(await data.arrayBuffer());
    },

    async uploadFinal(input: { finalObjectKey: string; bytes: Buffer; contentType: "image/webp" }) {
      const { error } = await supabase.storage.from(PHOTO_BUCKETS.final).upload(input.finalObjectKey, input.bytes, {
        contentType: input.contentType,
        upsert: false
      });

      if (error) {
        return { ok: false as const, reason: "storage_write_failed" };
      }

      return { ok: true as const };
    },

    async deleteObject(key: string) {
      const bucket = key.startsWith("incoming/") ? PHOTO_BUCKETS.incoming : PHOTO_BUCKETS.final;
      const { error } = await supabase.storage.from(bucket).remove([key]);

      if (error) {
        return { ok: false as const, reason: "delete_failed" };
      }

      return { ok: true as const };
    }
  };
}
