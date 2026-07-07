import type { ReactNode } from "react";
import { requireActiveMembership } from "@/lib/auth/server";
import { signOutAction } from "@/lib/auth/actions";
import { ClinicShell } from "@/components/clinic/clinic-shell";
import { getServerEnv } from "@/lib/env";

export default async function ClinicLayout({ children }: { children: ReactNode }) {
  const context = await requireActiveMembership();
  const env = getServerEnv();

  return (
    <ClinicShell
      organizationName={context.organization.name}
      roleKey={context.membership.roleKey}
      appEnv={env.APP_ENV}
      signOutAction={signOutAction}
    >
      {children}
    </ClinicShell>
  );
}
