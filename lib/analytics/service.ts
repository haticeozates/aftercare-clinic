import "server-only";

import { createServerSupabaseClient } from "@/lib/supabase/server";
import type { ReportData, ReportFilters } from "./contracts";

export async function fetchOperationsReport(clinic: string, filters: ReportFilters, download = false) {
  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase.rpc("phase15_report", {
    clinic, preset: filters.preset, custom_from: filters.from || null, custom_to: filters.to || null,
    requested_member: filters.member || null, requested_procedure: filters.procedure || null,
    booking_status: filters.status || null, bucket: filters.bucket, export_csv: download,
  });
  if (error?.code === "42501") return { status: "denied" } as const;
  if (error?.code === "22023") return { status: "invalid" } as const;
  if (error || !data) throw new Error("Rapor verileri yüklenemedi.");
  return { status: "ok", report: data as ReportData } as const;
}
