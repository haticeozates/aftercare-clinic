export type AppEnv = "local" | "test" | "development" | "preview" | "staging" | "production";

export type RoleKey = "organization_owner" | "organization_admin" | "staff";

export type PermissionKey =
  | "organization.read"
  | "organization.update"
  | "membership.read"
  | "membership.manage"
  | "audit.read";

export type MembershipStatus = "active" | "inactive";

export interface AuthUser {
  id: string;
}
