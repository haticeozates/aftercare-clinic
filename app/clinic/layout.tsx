import { notificationPreview } from "@/lib/notifications/service";
import "@/components/notifications/notifications.css";
import { redirect } from "next/navigation";
import { clinicManagementEnabled, phase11Config } from "@/lib/phase11/config";
import { getOnboarding } from "@/lib/phase11/server";
import type { ReactNode } from "react";
import { requireActiveMembership } from "@/lib/auth/server";
import { signOutAction } from "@/lib/auth/actions";
import { ClinicShell } from "@/components/clinic/clinic-shell";
import { getServerEnv } from "@/lib/env";

export default async function ClinicLayout({ children }: { children: ReactNode }) {
  const context = await requireActiveMembership();
  const env = getServerEnv();
  const demo = Boolean(phase11Config());
  if (demo && context.membership.roleKey === "organization_owner") {
    const state = await getOnboarding(context.user.id);
    if (state?.organization_id === context.organization.id && !state.completed_at) redirect("/kurulum");
  }

  const notices = await notificationPreview(context.organization.id, context.user.id);
  return (
    <ClinicShell
      organizationName={context.organization.name}
      roleKey={context.membership.roleKey}
      appEnv={env.APP_ENV}
      management={clinicManagementEnabled() && context.membership.roleKey !== "staff"}
      signOutAction={signOutAction}
      notices={notices}
    >
      {children}
    </ClinicShell>
  );
}
