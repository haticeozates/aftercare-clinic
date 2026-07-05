import type { AuthUser } from "@/lib/types";
import type { Membership } from "@/lib/authorization";

export type ClinicAccessInput = {
  user: AuthUser | null;
  membership: Membership | null;
};

export type ClinicAccessDecision =
  | { status: "allow" }
  | { status: "redirect"; destination: "/login" | "/unauthorized" };

export function resolveClinicAccess(input: ClinicAccessInput): ClinicAccessDecision {
  if (!input.user) {
    return { status: "redirect", destination: "/login" };
  }

  if (!input.membership || input.membership.status !== "active") {
    return { status: "redirect", destination: "/unauthorized" };
  }

  return { status: "allow" };
}
