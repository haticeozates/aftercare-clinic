import { describe, expect, it } from "vitest";
import sharp from "sharp";
import {
  PHOTO_ALLOWED_MIME_TYPES,
  PHOTO_BUCKETS,
  PHOTO_IMAGE_LIMITS,
  PHOTO_MAX_UPLOAD_BYTES,
  buildOpaquePhotoObjectKey,
  buildPhotoUploadCredential,
  createOpaquePhotoObjectKey,
  inspectAndSanitizePhoto,
  mapPhotoUploadError,
  sanitizePhotoAuditMetadata,
  sanitizePhotoCredentialForAudit,
  finalizePhotoUploadWithAdapters,
  validateDeclaredPhotoUpload
} from "@/lib/photos";
import { AUDIT_ACTIONS, AUDIT_ENTITY_TYPES, sanitizeAuditMetadata } from "@/lib/audit";
import { resolveRolePermissions } from "@/lib/authorization";

describe("photo storage foundation contracts", () => {
  it("defines only private incoming and final buckets", () => {
    expect(PHOTO_BUCKETS).toEqual({
      incoming: "care-photo-incoming",
      final: "care-photos"
    });
  });

  it("accepts only supported raster upload declarations under 5 MB", () => {
    expect(PHOTO_ALLOWED_MIME_TYPES).toEqual(["image/jpeg", "image/png", "image/webp"]);
    expect(PHOTO_MAX_UPLOAD_BYTES).toBe(5 * 1024 * 1024);

    expect(validateDeclaredPhotoUpload({ mimeType: "image/jpeg", sizeBytes: 1024 })).toEqual({
      ok: true
    });
    expect(validateDeclaredPhotoUpload({ mimeType: "image/svg+xml", sizeBytes: 1024 })).toEqual({
      ok: false,
      reason: "unsupported_mime_type"
    });
    expect(validateDeclaredPhotoUpload({ mimeType: "image/png", sizeBytes: 5 * 1024 * 1024 + 1 })).toEqual({
      ok: false,
      reason: "file_too_large"
    });
  });

  it("builds opaque object keys without organization, plan, request, client or filename data", () => {
    const key = buildOpaquePhotoObjectKey({
      prefix: "photos",
      opaqueId: "01234567-89ab-4def-8123-456789abcdef",
      extension: "webp"
    });

    expect(key).toBe("photos/01234567-89ab-4def-8123-456789abcdef.webp");
    expect(key).not.toMatch(/organization|plan|request|client|alpha|beta|filename|\.jpg\.webp/i);
  });

  it("allows photo permissions for active clinic roles without granting audit access to staff", () => {
    expect(resolveRolePermissions("organization_owner")).toEqual(
      expect.arrayContaining(["photo.read", "photo.request.manage", "photo.view"])
    );
    expect(resolveRolePermissions("organization_admin")).toEqual(
      expect.arrayContaining(["photo.read", "photo.request.manage", "photo.view"])
    );
    expect(resolveRolePermissions("staff")).toEqual(expect.arrayContaining(["photo.read", "photo.view"]));
    expect(resolveRolePermissions("staff")).not.toContain("audit.read");
  });

  it("registers photo audit actions and strips storage-sensitive metadata", () => {
    expect(AUDIT_ACTIONS).toEqual(
      expect.arrayContaining([
        "photo_request.created",
        "photo_request.cancelled",
        "photo_upload_intent.created",
        "photo.uploaded",
        "photo.upload_denied",
        "photo.view_access_granted",
        "photo.view_denied"
      ])
    );
    expect(AUDIT_ENTITY_TYPES).toEqual(
      expect.arrayContaining(["photo_request", "photo_upload_intent", "photo_record"])
    );

    expect(
      sanitizeAuditMetadata(
        sanitizePhotoAuditMetadata({
          mime_type: "image/webp",
          size_bytes: 4096,
          result_reason: "declared_mime_rejected",
          storage_path: "incoming/secret",
          signed_url: "https://example.test/signed",
          original_filename: "client-face.jpg",
          portal_session_hash: "hash",
          phone: "+905550000000"
        })
      )
    ).toEqual({
      mime_type: "image/webp",
      size_bytes: 4096,
      result_reason: "declared_mime_rejected"
    });
  });
});

describe("photo upload intent contracts", () => {
  it("generates unpredictable opaque incoming and final object keys", () => {
    const incomingKey = createOpaquePhotoObjectKey("incoming");
    const finalKey = createOpaquePhotoObjectKey("photos");

    expect(incomingKey).toMatch(/^incoming\/[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
    expect(finalKey).toMatch(/^photos\/[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\.webp$/);
    expect(`${incomingKey} ${finalKey}`).not.toMatch(/organization|client|plan|request|phone|email|filename|alpha|beta/i);
  });

  it("returns a narrow signed upload credential without audit-safe leakage", () => {
    const credential = buildPhotoUploadCredential({
      intentId: "00000000-0000-4000-8000-000000007222",
      path: "incoming/00000000-0000-4000-8000-000000007222",
      token: "signed-upload-token",
      expiresAt: "2026-07-08T10:00:00.000Z"
    });

    expect(credential).toEqual({
      intentId: "00000000-0000-4000-8000-000000007222",
      uploadCredential: {
        path: "incoming/00000000-0000-4000-8000-000000007222",
        token: "signed-upload-token",
        expiresAt: "2026-07-08T10:00:00.000Z",
        maxBytes: PHOTO_MAX_UPLOAD_BYTES,
        allowedMimeTypes: PHOTO_ALLOWED_MIME_TYPES
      }
    });

    expect(
      sanitizeAuditMetadata(
        sanitizePhotoCredentialForAudit({
          ...credential.uploadCredential,
          finalKey: "photos/00000000-0000-4000-8000-000000007222.webp"
        })
      )
    ).toEqual({});
  });

  it("maps raw upload errors to allowlisted safe messages", () => {
    expect(mapPhotoUploadError("unsupported_format")).toBe("Dosya desteklenen bir fotoğraf formatında değil.");
    expect(mapPhotoUploadError("file_too_large")).toBe("Fotoğraf boyutu izin verilen sınırı aşıyor.");
    expect(mapPhotoUploadError(new Error("storage path incoming/secret token=abc"))).toBe(
      "Yükleme tamamlanamadı. Lütfen tekrar deneyin."
    );
  });
});

describe("photo image validation and sanitization", () => {
  async function tinyPng() {
    return sharp({
      create: {
        width: 1,
        height: 1,
        channels: 4,
        background: { r: 255, g: 255, b: 255, alpha: 0.5 }
      }
    })
      .png()
      .toBuffer();
  }

  it("defines strict decoder and output limits", () => {
    expect(PHOTO_IMAGE_LIMITS).toEqual({
      maxInputBytes: 5 * 1024 * 1024,
      maxWidth: 6000,
      maxHeight: 6000,
      maxPixels: 16_000_000,
      maxPages: 1,
      outputFormat: "image/webp",
      outputQuality: 82,
      outputMaxLongEdge: 1600
    });
  });

  it("rejects zero-byte and malformed images before creating output", async () => {
    await expect(inspectAndSanitizePhoto({ bytes: Buffer.alloc(0), declaredMimeType: "image/png" })).resolves.toEqual({
      ok: false,
      reason: "empty_file"
    });
    await expect(
      inspectAndSanitizePhoto({ bytes: Buffer.from("not-an-image"), declaredMimeType: "image/png" })
    ).resolves.toEqual({
      ok: false,
      reason: "malformed_image"
    });
  });

  it("rejects declared MIME mismatch even when bytes decode as an image", async () => {
    await expect(inspectAndSanitizePhoto({ bytes: await tinyPng(), declaredMimeType: "image/jpeg" })).resolves.toEqual({
      ok: false,
      reason: "mime_mismatch"
    });
  });

  it("produces metadata-free WebP output and checksum for valid images", async () => {
    const result = await inspectAndSanitizePhoto({ bytes: await tinyPng(), declaredMimeType: "image/png" });

    expect(result).toMatchObject({
      ok: true,
      verifiedMimeType: "image/webp",
      width: 1,
      height: 1
    });
    if (result.ok) {
      expect(result.outputBytes.length).toBeGreaterThan(0);
      expect(result.checksumSha256).toMatch(/^[a-f0-9]{64}$/);
      expect(result.metadata).not.toHaveProperty("exif");
      expect(result.metadata).not.toHaveProperty("iptc");
      expect(result.metadata).not.toHaveProperty("xmp");
      expect(result.metadata).not.toHaveProperty("icc");
    }
  });
});

describe("photo finalize compensation", () => {
  async function validWebpBytes() {
    return sharp({
      create: {
        width: 2,
        height: 2,
        channels: 3,
        background: "#ffffff"
      }
    })
      .jpeg()
      .toBuffer();
  }

  it("finalizes a claimed incoming object and deletes incoming after DB success", async () => {
    const deleted: string[] = [];
    const finalUploads: string[] = [];

    const result = await finalizePhotoUploadWithAdapters({
      sessionHash: "session-hash",
      intentId: "00000000-0000-4000-8000-000000007111",
      database: {
        claimIntent: async () => ({
          status: "processing",
          claimId: "00000000-0000-4000-8000-000000007333",
          incomingObjectKey: "incoming/00000000-0000-4000-8000-000000007111",
          declaredMimeType: "image/jpeg"
        }),
        recordFinalized: async () => ({ status: "ready" })
      },
      storage: {
        downloadIncoming: async () => await validWebpBytes(),
        uploadFinal: async ({ finalObjectKey }) => {
          finalUploads.push(finalObjectKey);
          return { ok: true };
        },
        deleteObject: async (key) => {
          deleted.push(key);
          return { ok: true };
        }
      }
    });

    expect(result).toEqual({ ok: true, status: "ready" });
    expect(finalUploads[0]).toMatch(/^photos\/[0-9a-f-]+\.webp$/);
    expect(deleted).toEqual(["incoming/00000000-0000-4000-8000-000000007111"]);
  });

  it("deletes the final object when DB finalize fails after storage write", async () => {
    const deleted: string[] = [];
    const result = await finalizePhotoUploadWithAdapters({
      sessionHash: "session-hash",
      intentId: "00000000-0000-4000-8000-000000007111",
      database: {
        claimIntent: async () => ({
          status: "processing",
          claimId: "00000000-0000-4000-8000-000000007333",
          incomingObjectKey: "incoming/00000000-0000-4000-8000-000000007111",
          declaredMimeType: "image/jpeg"
        }),
        recordFinalized: async () => ({ error: "db_finalize_failed" })
      },
      storage: {
        downloadIncoming: async () => await validWebpBytes(),
        uploadFinal: async () => ({ ok: true }),
        deleteObject: async (key) => {
          deleted.push(key);
          return { ok: true };
        }
      }
    });

    expect(result).toEqual({ ok: false, reason: "finalize_failed" });
    expect(deleted).toHaveLength(1);
    expect(deleted[0]).toMatch(/^photos\/[0-9a-f-]+\.webp$/);
  });
});
