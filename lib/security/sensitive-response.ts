import { NextResponse } from "next/server";
import { mergeResponseHeaders, SENSITIVE_CACHE_CONTROL } from "@/lib/security/headers";

export function sensitiveJsonResponse(
  body: unknown,
  init?: {
    status?: number;
    headers?: Record<string, string>;
  }
) {
  return NextResponse.json(body, {
    status: init?.status ?? 200,
    headers: mergeResponseHeaders({ "Cache-Control": SENSITIVE_CACHE_CONTROL }, init?.headers ?? {})
  });
}
