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
  | "procedure.manage"
  | "template.read"
  | "template.create"
  | "template.update"
  | "template.publish"
  | "template.deactivate"
  | "plan.read"
  | "plan.create"
  | "plan.update"
  | "plan.stop"
  | "secure_link.create"
  | "secure_link.revoke"
  | "secure_link.rotate"
  | "alert.read"
  | "alert.acknowledge"
  | "alert.resolve"
  | "alert.dismiss"
  | "photo.read"
  | "photo.request.manage"
  | "photo.view";

export type MembershipStatus = "active" | "inactive";

export interface AuthUser {
  id: string;
}
