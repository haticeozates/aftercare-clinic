import "server-only";

import { PHOTO_BUCKETS } from "@/lib/photos/contracts";
import { PHOTO_CLEANUP_BATCH_SIZE, type CleanupStorageObject } from "@/lib/photos/cleanup/contracts";

type AdminClient = ReturnType<typeof import("@/lib/supabase/admin").createAdminSupabaseClient>;

function objectCreatedAt(object: { created_at?: string | null; updated_at?: string | null; last_accessed_at?: string | null }) {
  return object.created_at ?? object.updated_at ?? object.last_accessed_at ?? new Date().toISOString();
}

export function createPhotoCleanupStorageAdapter(supabase: AdminClient) {
  async function listBucketObjects(input: { bucket: "incoming" | "final"; prefix: "incoming" | "photos" }) {
    const bucketId = input.bucket === "incoming" ? PHOTO_BUCKETS.incoming : PHOTO_BUCKETS.final;
    const objects: CleanupStorageObject[] = [];
    let offset = 0;

    while (objects.length < PHOTO_CLEANUP_BATCH_SIZE) {
      const { data, error } = await supabase.storage.from(bucketId).list(input.prefix, {
        limit: Math.min(PHOTO_CLEANUP_BATCH_SIZE - objects.length, 100),
        offset,
        sortBy: { column: "created_at", order: "asc" }
      });

      if (error || !data?.length) {
        break;
      }

      for (const object of data) {
        if (!object.name) {
          continue;
        }
        objects.push({
          key: `${input.prefix}/${object.name}`,
          createdAt: objectCreatedAt(object)
        });
      }

      offset += data.length;
      if (data.length < 100) {
        break;
      }
    }

    return objects;
  }

  return {
    async listIncomingObjects() {
      return listBucketObjects({ bucket: "incoming", prefix: "incoming" });
    },

    async listFinalObjects() {
      return listBucketObjects({ bucket: "final", prefix: "photos" });
    },

    async deleteObject(bucket: "incoming" | "final", key: string) {
      const bucketId = bucket === "incoming" ? PHOTO_BUCKETS.incoming : PHOTO_BUCKETS.final;
      const { error } = await supabase.storage.from(bucketId).remove([key]);
      return error ? { ok: false as const } : { ok: true as const };
    }
  };
}
