import crypto from "node:crypto";

export function buildOpaquePhotoObjectKey(input: {
  prefix: "incoming" | "photos";
  opaqueId: string;
  extension?: "webp";
}) {
  if (input.prefix === "incoming") {
    return `incoming/${input.opaqueId}`;
  }

  return `photos/${input.opaqueId}.${input.extension ?? "webp"}`;
}

export function createOpaquePhotoObjectKey(prefix: "incoming" | "photos") {
  return buildOpaquePhotoObjectKey({
    prefix,
    opaqueId: crypto.randomUUID(),
    extension: "webp"
  });
}
