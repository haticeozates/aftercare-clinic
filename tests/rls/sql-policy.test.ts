import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const migration = readFileSync(
  join(process.cwd(), "supabase/migrations/20260706000000_foundation.sql"),
  "utf8"
);

describe("foundation RLS migration", () => {
  it("enables RLS for every exposed foundation table", () => {
    for (const table of [
      "organizations",
      "user_profiles",
      "roles",
      "permissions",
      "role_permissions",
      "organization_memberships",
      "audit_logs",
      "clients",
      "procedures"
    ]) {
      const foundation = migration.includes(`alter table public.${table} enable row level security`);
      const phase2 = readFileSync(
        join(process.cwd(), "supabase/migrations/20260706010000_clients_procedures.sql"),
        "utf8"
      ).includes(`alter table public.${table} enable row level security`);
      expect(foundation || phase2).toBe(true);
    }
  });

  it("prevents browser clients from inserting, updating, or deleting audit logs", () => {
    expect(migration).toContain("audit_logs are append-only");
    expect(migration).toContain("revoke insert, update, delete on public.audit_logs from authenticated");
    expect(migration).toContain("revoke all on public.audit_logs from anon");
    expect(migration).toContain("prevent_audit_log_mutation");
    expect(migration).toContain("write_audit_log");
  });

  it("scopes organization reads and updates through active membership and permissions", () => {
    expect(migration).toContain("members can read their organizations");
    expect(migration).toContain("public.current_user_has_active_membership(id)");
    expect(migration).toContain("admins can update their organizations");
    expect(migration).toContain("public.current_user_has_permission(id, 'organization.update')");
  });

  it("blocks staff from reading audit logs while allowing audit readers in their own organization", () => {
    expect(migration).toContain("admins can read organization audit logs");
    expect(migration).toContain("public.current_user_has_permission(organization_id, 'audit.read')");
  });

  it("uses security definer helpers with a fixed search_path", () => {
    expect(migration).toContain("security definer");
    expect(migration).toContain("set search_path = public");
  });
});
