import crypto from "node:crypto";

export const SAFE_LOG_RESULTS = [
  "success",
  "denied",
  "rate_limited",
  "store_unavailable",
  "invalid_input",
  "internal_error"
] as const;

export type SafeLogResult = (typeof SAFE_LOG_RESULTS)[number];

export const SAFE_INTERNAL_ERROR_CODES = [
  "rate_limit_store_unavailable",
  "cleanup_store_unavailable",
  "cleanup_failed",
  "unauthorized",
  "invalid_request"
] as const;

export type SafeInternalErrorCode = (typeof SAFE_INTERNAL_ERROR_CODES)[number];

const safeLogResultSet = new Set<string>(SAFE_LOG_RESULTS);
const safeInternalErrorCodeSet = new Set<string>(SAFE_INTERNAL_ERROR_CODES);

export function createCorrelationId() {
  return crypto.randomUUID();
}

export function formatSafeServerLog(input: {
  operation: string;
  result: SafeLogResult;
  correlationId: string;
  errorCode?: SafeInternalErrorCode;
}) {
  if (!safeLogResultSet.has(input.result)) {
    throw new Error("Unsupported safe log result");
  }

  if (input.errorCode && !safeInternalErrorCodeSet.has(input.errorCode)) {
    throw new Error("Unsupported internal error code");
  }

  return JSON.stringify({
    operation: input.operation,
    result: input.result,
    correlationId: input.correlationId,
    ...(input.errorCode ? { errorCode: input.errorCode } : {})
  });
}

export function logSafeServerEvent(input: {
  operation: string;
  result: SafeLogResult;
  correlationId?: string;
  errorCode?: SafeInternalErrorCode;
}) {
  const line = formatSafeServerLog({
    operation: input.operation,
    result: input.result,
    correlationId: input.correlationId ?? createCorrelationId(),
    errorCode: input.errorCode
  });

  if (input.result === "success") {
    console.info(line);
    return;
  }

  console.error(line);
}
