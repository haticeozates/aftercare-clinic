import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const root = process.cwd();

function read(path: string) {
  return readFileSync(join(root, path), "utf8");
}

function migrationSources() {
  const dir = join(root, "supabase/migrations");
  return readdirSync(dir)
    .filter((name) => name.endsWith(".sql"))
    .map((name) => ({ name, source: readFileSync(join(dir, name), "utf8") }));
}

describe("phase 9b clinic photo-request creation gaps", () => {
  it("ships a forward migration for create_photo_request_for_staff", () => {
    const matches = migrationSources().filter(({ source }) =>
      source.includes("create_photo_request_for_staff")
    );

    expect(matches.length).toBeGreaterThan(0);
    expect(matches.some(({ name }) => name >= "20260709100000")).toBe(true);
  });

  it("keeps the create RPC free of organization_id and client_id parameters", () => {
    const migration = migrationSources().find(({ source }) =>
      source.includes("create_photo_request_for_staff")
    );

    expect(migration).toBeTruthy();
    const source = migration!.source;
    const signature = source.match(
      /create(?:\s+or\s+replace)?\s+function\s+public\.create_photo_request_for_staff\s*\(([\s\S]*?)\)\s*returns/i
    );

    expect(signature?.[1] ?? "").not.toMatch(/organization_id|client_id/i);
    expect(source).toMatch(/current_user_has_permission\([^)]*photo\.request\.manage/);
    expect(source).toMatch(/current_user_has_active_membership/);
    expect(source).toMatch(/security definer/i);
    expect(source).toMatch(/search_path\s*=\s*public,\s*pg_temp/);
    expect(source).toMatch(/revoke\s+all\s+on\s+function\s+public\.create_photo_request_for_staff/i);
    expect(source).toMatch(/grant\s+execute\s+on\s+function\s+public\.create_photo_request_for_staff[^;]*authenticated/i);
    expect(source).toMatch(/photo_request\.created/);
    expect(source).toMatch(/unique_violation/);
  });

  it("exposes clinic photo-request create contracts, service, and server action", () => {
    expect(existsSync(join(root, "lib/photos/clinic-request-contracts.ts"))).toBe(true);
    expect(existsSync(join(root, "lib/photos/clinic-request-service.ts"))).toBe(true);
    expect(existsSync(join(root, "lib/photos/clinic-request-actions.ts"))).toBe(true);

    const service = read("lib/photos/clinic-request-service.ts");
    const actions = read("lib/photos/clinic-request-actions.ts");
    const contracts = read("lib/photos/clinic-request-contracts.ts");

    expect(service).toMatch(/create_photo_request_for_staff/);
    expect(service).not.toMatch(/\.from\("photo_requests"\)\.insert/);
    expect(service).not.toMatch(/organizationId|organization_id/);
    expect(actions).toMatch(/"use server"/);
    expect(actions).toMatch(/createPhotoRequestAction/);
    expect(contracts).toMatch(/parseCreatePhotoRequestInput/);
    expect(contracts).toMatch(/mapPhotoRequestRpcResult/);
    expect(contracts).toMatch(/already exists|duplicate/i);
  });

  it("wires plan detail UI to create photo requests without browser organization ids", () => {
    const page = read("app/clinic/plans/[id]/page.tsx");

    expect(page).toMatch(/createPhotoRequestAction|PhotoRequestCreate/);
    expect(page).not.toMatch(/name=["']organizationId["']/);
    expect(page).not.toMatch(/name=["']organization_id["']/);
    expect(page).toMatch(/Fotoğraf talebi|photo request/i);
  });

  it("registers pgTAP coverage for clinic photo-request create", () => {
    const testsDir = join(root, "supabase/tests");
    const names = readdirSync(testsDir).filter((name) => name.endsWith(".sql"));
    expect(names.some((name) => /phase9b.*photo.?request/i.test(name))).toBe(true);

    const source = names
      .filter((name) => /phase9b.*photo.?request/i.test(name))
      .map((name) => readFileSync(join(testsDir, name), "utf8"))
      .join("\n");

    expect(source).toMatch(/create_photo_request_for_staff/);
    expect(source).toMatch(/photo\.request\.manage|permission denied/i);
    expect(source).toMatch(/already exists|one_active|duplicate/i);
  });
});
