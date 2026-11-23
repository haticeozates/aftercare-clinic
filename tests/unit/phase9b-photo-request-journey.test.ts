import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  mapPhotoRequestRpcResult,
  parseCreatePhotoRequestInput,
  type ClinicPhotoRequestDto
} from "@/lib/photos/clinic-request-contracts";

const root = process.cwd();

function read(path: string) {
  return readFileSync(join(root, path), "utf8");
}

describe("phase 9b photo-request journey regressions", () => {
  it("keeps clinic create path on RPC with defense-in-depth permission checks", () => {
    const service = read("lib/photos/clinic-request-service.ts");
    const actions = read("lib/photos/clinic-request-actions.ts");
    const migration = read("supabase/migrations/20260709100000_phase9b_clinic_photo_request_create.sql");

    expect(service).toMatch(/requireOrganizationPermission\("photo\.request\.manage"\)/);
    expect(service).toMatch(/create_photo_request_for_staff/);
    expect(service).not.toMatch(/\.from\("photo_requests"\)\.insert/);
    expect(service).not.toMatch(/organizationId|organization_id|clientId|client_id/);
    expect(actions).toMatch(/"use server"/);
    expect(actions).toMatch(/isRedirectError/);
    expect(migration).toMatch(/current_user_has_permission\([^)]*photo\.request\.manage/);
    expect(migration).toMatch(/unique_violation/);
    expect(migration).toMatch(/photo_request\.created/);
  });

  it("exposes only safe clinic photo-request DTO fields", () => {
    const dto: ClinicPhotoRequestDto = {
      id: "00000000-0000-4000-8000-000000007999",
      carePlanDayId: "00000000-0000-4000-8000-00000000f102",
      label: "Temsili fotoğraf talebi",
      required: false,
      status: "active"
    };

    expect(Object.keys(dto).sort()).toEqual(["carePlanDayId", "id", "label", "required", "status"]);
    expect(JSON.stringify(dto)).not.toMatch(/organization|storage|signed|bucket|object_key|client/i);
  });

  it("maps duplicate and permission failures without leaking SQL details", () => {
    expect(mapPhotoRequestRpcResult(null, { error: "photo request already exists" })).toBe(
      "Bu plan günü için zaten aktif bir fotoğraf talebi var."
    );
    expect(mapPhotoRequestRpcResult({ code: "23505", message: "duplicate key" }, null)).not.toContain("23505");
    expect(mapPhotoRequestRpcResult(null, { error: "permission denied" })).toBe("Bu işlem için yetkiniz yok.");
  });

  it("ignores browser-supplied organization and client ids during parse", () => {
    const parsed = parseCreatePhotoRequestInput({
      carePlanId: "00000000-0000-4000-8000-00000000e102",
      carePlanDayId: "00000000-0000-4000-8000-00000000f102",
      label: "Temsili klinik talebi",
      required: false,
      organizationId: "00000000-0000-4000-8000-0000000000b1",
      clientId: "00000000-0000-4000-8000-00000000c201"
    });

    expect(parsed).toEqual({
      carePlanId: "00000000-0000-4000-8000-00000000e102",
      carePlanDayId: "00000000-0000-4000-8000-00000000f102",
      label: "Temsili klinik talebi",
      required: false
    });
    expect(parsed).not.toHaveProperty("organizationId");
    expect(parsed).not.toHaveProperty("clientId");
  });

  it("wires plan detail UI and create form without browser tenant fields", () => {
    const page = read("app/clinic/plans/[id]/page.tsx");
    const form = read("components/clinic/photo-request-create-form.tsx");
    const service = read("lib/plans/service.ts");

    expect(page).toMatch(/PhotoRequestCreateForm/);
    expect(page).toMatch(/canCreatePhotoRequest/);
    expect(page).toMatch(/Fotoğraf talebi/);
    expect(page).not.toMatch(/name=["']organizationId["']/);
    expect(form).toMatch(/createPhotoRequestAction/);
    expect(form).toMatch(/carePlanId/);
    expect(form).toMatch(/carePlanDayId/);
    expect(form).not.toMatch(/organizationId|organization_id|clientId|client_id/);
    expect(service).toMatch(/canCreatePhotoRequest/);
    expect(service).toMatch(/activePhotoRequests/);
    expect(service).toMatch(/photo\.request\.manage/);
  });

  it("keeps pgTAP coverage for create authorization and duplicate mapping", () => {
    expect(existsSync(join(root, "supabase/tests/phase9b_clinic_photo_request_create.test.sql"))).toBe(true);
    const source = read("supabase/tests/phase9b_clinic_photo_request_create.test.sql");
    expect(source).toMatch(/create_photo_request_for_staff/);
    expect(source).toMatch(/permission denied/);
    expect(source).toMatch(/photo request already exists/);
    expect(source).toMatch(/plan is not eligible/);
    expect(source).toMatch(/not found/);
    expect(source).toMatch(/42501/);
  });
});
