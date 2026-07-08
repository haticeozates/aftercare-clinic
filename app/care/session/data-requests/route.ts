import { NextResponse } from "next/server";
import { parsePortalDataRequestInput } from "@/lib/data-requests/portal-contracts";
import { getPortalDataRequests, submitPortalDataRequest } from "@/lib/data-requests/portal-service";

export const dynamic = "force-dynamic";

export async function GET() {
  const requests = await getPortalDataRequests();
  return NextResponse.json({ requests });
}

export async function POST(request: Request) {
  try {
    const parsed = parsePortalDataRequestInput(await request.json().catch(() => null));
    const result = await submitPortalDataRequest(parsed.requestType);
    if ("error" in result) {
      return NextResponse.json({ error: result.error }, { status: 403 });
    }
    return NextResponse.json({ ok: true, status: result.status, request: result.request });
  } catch {
    return NextResponse.json({ error: "Talebiniz oluşturulamadı. Lütfen tekrar deneyin." }, { status: 400 });
  }
}
