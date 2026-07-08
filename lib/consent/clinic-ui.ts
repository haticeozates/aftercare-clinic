export type ConsentDocumentUiStatus = "active" | "inactive" | "archived";
export type ConsentVersionUiStatus = "draft" | "published" | "retired";

export type ConsentVersionUiRecord = {
  id: string;
  status: ConsentVersionUiStatus;
  versionNumber: number;
};

export type ConsentDocumentUiRecord = {
  status: ConsentDocumentUiStatus;
  versions: ConsentVersionUiRecord[];
};

export function consentDocumentStatusLabel(status: ConsentDocumentUiStatus) {
  return {
    active: "Aktif",
    inactive: "Pasif",
    archived: "Arşivlendi"
  }[status];
}

export function hasActiveDraftVersion(versions: ConsentVersionUiRecord[]) {
  return versions.some((version) => version.status === "draft");
}

export function latestPublishedVersionNumber(versions: ConsentVersionUiRecord[]) {
  const published = versions.filter((version) => version.status === "published" || version.status === "retired");
  if (published.length === 0) {
    return null;
  }

  return Math.max(...published.map((version) => version.versionNumber));
}

export function canShowNewDraftAction(document: ConsentDocumentUiRecord) {
  if (document.status !== "active") {
    return false;
  }

  if (hasActiveDraftVersion(document.versions)) {
    return false;
  }

  return document.versions.some((version) => version.status === "published" || version.status === "retired");
}

export function canShowArchiveAction(document: ConsentDocumentUiRecord) {
  return document.status === "active";
}

export function isDraftEditable(
  status: ConsentVersionUiStatus,
  canManage: boolean,
  documentStatus: ConsentDocumentUiStatus = "active"
) {
  return canManage && documentStatus === "active" && status === "draft";
}

export function isPublishedReadonly(status: ConsentVersionUiStatus) {
  return status === "published" || status === "retired";
}

export function getFocusableElements(container: HTMLElement) {
  return Array.from(
    container.querySelectorAll<HTMLElement>(
      'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])'
    )
  );
}

export function trapTabFocus(event: KeyboardEvent, container: HTMLElement) {
  if (event.key !== "Tab") {
    return;
  }

  const focusable = getFocusableElements(container);
  if (focusable.length === 0) {
    return;
  }

  const first = focusable[0];
  const last = focusable[focusable.length - 1];
  const active = document.activeElement;

  if (event.shiftKey && active === first) {
    event.preventDefault();
    last.focus();
    return;
  }

  if (!event.shiftKey && active === last) {
    event.preventDefault();
    first.focus();
  }
}
