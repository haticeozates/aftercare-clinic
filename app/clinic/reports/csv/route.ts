import { type NextRequest, NextResponse } from "next/server";
import { getCurrentOrganizationContext } from "@/lib/auth/server";
import { parseReportFilters } from "@/lib/analytics/contracts";
import { reportCsv } from "@/lib/analytics/csv";
import { fetchOperationsReport } from "@/lib/analytics/service";

const headers = { "Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff" };
const errorResponse = (status: number, message: string) => NextResponse.json({ message }, { status, headers });

export async function POST(request: NextRequest) {
  const context = await getCurrentOrganizationContext();
  if (context.status === "unauthenticated") return errorResponse(401, "Oturum açın.");
  if (context.status !== "authorized" || context.membership.roleKey === "staff"
    || request.headers.get("origin") !== request.nextUrl.origin) return errorResponse(403, "Rapor dışa aktarma izni gerekiyor.");
  const values = request.nextUrl.searchParams;
  const filters = parseReportFilters(Object.fromEntries(Array.from(new Set(values.keys()), (key) =>
    [key, values.getAll(key).length > 1 ? values.getAll(key) : values.get(key)])));
  if (!filters) return errorResponse(400, "Rapor filtrelerini kontrol edin.");
  try {
    const result = await fetchOperationsReport(context.organization.id, filters, true);
    if (result.status === "denied") return errorResponse(403, "Rapor dışa aktarma izni gerekiyor.");
    if (result.status === "invalid") return errorResponse(400, "Rapor filtrelerini kontrol edin.");
    return new Response(reportCsv(result.report, filters), {
      headers: {
        ...headers, "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="aftercare-operasyon-${result.report.first}-${result.report.last}.csv"`,
      },
    });
  } catch {
    return errorResponse(503, "Rapor şu anda dışa aktarılamadı.");
  }
}
