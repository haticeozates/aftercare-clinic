"use client";

import type { ChangeEvent } from "react";

export function PhotoFilePicker({
  disabled,
  errorId,
  onSelect
}: {
  disabled: boolean;
  errorId?: string;
  onSelect(files: FileList | null): void;
}) {
  return (
    <div className="stack">
      <label className="label" htmlFor="portal-photo-file">
        Fotoğraf seç
      </label>
      <input
        id="portal-photo-file"
        name="portal-photo-file"
        type="file"
        accept="image/jpeg,image/png,image/webp"
        disabled={disabled}
        aria-describedby={errorId}
        onChange={(event: ChangeEvent<HTMLInputElement>) => onSelect(event.target.files)}
      />
    </div>
  );
}
