export function sanitizePhotoAuditMetadata(input: Record<string, unknown>) {
  return {
    mime_type: input.mime_type,
    size_bytes: input.size_bytes,
    width: input.width,
    height: input.height,
    result_reason: input.result_reason,
    result_reason_code: input.result_reason_code,
    source: input.source,
    day_number: input.day_number,
    retry: input.retry,
    idempotent_result: input.idempotent_result
  };
}

export function sanitizePhotoCredentialForAudit(input: Record<string, unknown>) {
  void input;
  return {};
}
