import {
  PHOTO_FINAL_ORPHAN_MIN_AGE_HOURS,
  PHOTO_INCOMING_ORPHAN_MIN_AGE_HOURS,
  type CleanupClassification
} from "@/lib/photos/cleanup/contracts";

type IntentStatus = "pending" | "processing" | "consumed" | "expired" | "failed" | "cancelled";

const PROCESSING_LEASE_MINUTES = 10;

function isOlderThan(input: { value: string | null; now: Date; hours: number }) {
  if (!input.value) {
    return false;
  }

  const time = new Date(input.value).getTime();
  if (!Number.isFinite(time)) {
    return false;
  }

  return input.now.getTime() - time >= input.hours * 60 * 60 * 1000;
}

function isPast(input: { value: string | null; now: Date }) {
  if (!input.value) {
    return false;
  }

  const time = new Date(input.value).getTime();
  return Number.isFinite(time) && time <= input.now.getTime();
}

function hasActiveProcessingLease(input: { processingStartedAt: string | null; now: Date }) {
  if (!input.processingStartedAt) {
    return false;
  }

  const time = new Date(input.processingStartedAt).getTime();
  if (!Number.isFinite(time)) {
    return false;
  }

  return input.now.getTime() - time < PROCESSING_LEASE_MINUTES * 60 * 1000;
}

export function classifyIncomingCleanupCandidate(input: {
  objectKey: string;
  objectCreatedAt: string;
  intentStatus: IntentStatus | null;
  intentExpiresAt: string | null;
  processingStartedAt: string | null;
  hasPhotoRecord: boolean;
  now: Date;
}): CleanupClassification {
  if (!input.objectKey.startsWith("incoming/")) {
    return { action: "skip", reason: "uncertain" };
  }

  if (!isOlderThan({ value: input.objectCreatedAt, now: input.now, hours: PHOTO_INCOMING_ORPHAN_MIN_AGE_HOURS })) {
    return { action: "skip", reason: "too_new" };
  }

  if (input.hasPhotoRecord) {
    return { action: "delete", reason: "expired_incoming" };
  }

  if (!input.intentStatus) {
    return { action: "skip", reason: "uncertain" };
  }

  if (input.intentStatus === "pending" && !isPast({ value: input.intentExpiresAt, now: input.now })) {
    return { action: "skip", reason: "active_intent" };
  }

  if (input.intentStatus === "processing" && hasActiveProcessingLease(input)) {
    return { action: "skip", reason: "processing" };
  }

  if (input.intentStatus === "processing") {
    return { action: "delete", reason: "expired_processing" };
  }

  if (input.intentStatus === "pending" || input.intentStatus === "expired" || input.intentStatus === "failed" || input.intentStatus === "cancelled") {
    return isPast({ value: input.intentExpiresAt, now: input.now }) || input.intentStatus !== "pending"
      ? { action: "delete", reason: "expired_incoming" }
      : { action: "skip", reason: "active_intent" };
  }

  return { action: "skip", reason: "uncertain" };
}

export function classifyFinalCleanupCandidate(input: {
  objectKey: string;
  objectCreatedAt: string;
  isReferencedByRecord: boolean;
  hasActiveProcessingIntent: boolean;
  now: Date;
}): CleanupClassification {
  if (!input.objectKey.startsWith("photos/")) {
    return { action: "skip", reason: "uncertain" };
  }

  if (!isOlderThan({ value: input.objectCreatedAt, now: input.now, hours: PHOTO_FINAL_ORPHAN_MIN_AGE_HOURS })) {
    return { action: "skip", reason: "too_new" };
  }

  if (input.isReferencedByRecord) {
    return { action: "skip", reason: "referenced_record" };
  }

  if (input.hasActiveProcessingIntent) {
    return { action: "skip", reason: "processing" };
  }

  return { action: "delete", reason: "orphan_final" };
}
