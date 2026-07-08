import { describe, expect, it } from "vitest";
import {
  PHOTO_ALLOWED_MIME_TYPES,
  PHOTO_BUCKETS,
  PHOTO_MAX_UPLOAD_BYTES,
  buildOpaquePhotoObjectKey,
  sanitizePhotoAuditMetadata,
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
