export type AppEnv = "local" | "test" | "development" | "preview" | "staging" | "production";

export type RoleKey = "organization_owner" | "organization_admin" | "staff";

export type PermissionKey =
  | "organization.read"
  | "organization.update"
  | "membership.read"
  | "membership.manage"
  | "audit.read"
  | "client.read"
  | "client.create"
  | "client.update"
  | "client.archive"
  | "procedure.read"
  | "procedure.manage";

export type MembershipStatus = "active" | "inactive";

export interface AuthUser {
  id: string;
}
