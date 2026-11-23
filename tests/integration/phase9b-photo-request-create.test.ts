import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const root = process.cwd();

function read(path: string) {
  return readFileSync(join(root, path), "utf8");
}

describe("phase 9b clinic photo-request create integration contracts", () => {
  it("keeps create behind server action and RPC rather than browser DML", () => {
    const service = read("lib/photos/clinic-request-service.ts");
    const actions = read("lib/photos/clinic-request-actions.ts");
    const form = read("components/clinic/photo-request-create-form.tsx");

    expect(actions).toContain("createPhotoRequestFromForm");
    expect(service).toContain('supabase.rpc("create_photo_request_for_staff"');
    expect(service).toContain("revalidatePath");
    expect(form).toContain("useActionState");
    expect(form).not.toContain("createClient");
    expect(form).not.toContain("supabase");
  });

  it("does not expose storage keys or signed URLs from clinic create surfaces", () => {
    const contracts = read("lib/photos/clinic-request-contracts.ts");
    const page = read("app/clinic/plans/[id]/page.tsx");
    const form = read("components/clinic/photo-request-create-form.tsx");
    const service = read("lib/plans/service.ts");

    for (const source of [contracts, page, form, service]) {
      expect(source).not.toMatch(/signedUrl|signed_url|final_object_key|incoming_object_key|care-photos|care-photo-incoming/);
    }
  });
});
