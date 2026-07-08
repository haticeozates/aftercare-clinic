import { formatDisplayDateTime } from "@/lib/formatters";
import type { ClinicPhotoRecordDto } from "@/lib/photos/clinic-view";
import { SecurePhotoViewer } from "@/components/clinic/secure-photo-viewer";

export function PhotoRecordCard({ photo }: { photo: ClinicPhotoRecordDto }) {
  return (
    <article className="photo-record-row">
      <div className="photo-placeholder" aria-hidden="true">
        <span>WEBP</span>
      </div>
      <div className="stack compact-stack">
        <div>
          <p className="eyebrow">Fotoğraf kaydı</p>
          <h4>{photo.requestLabel}</h4>
        </div>
        <p className="muted">
          {photo.requestRequired ? "Zorunlu talep" : "Opsiyonel talep"} · {photo.dayNumber}. gün ·{" "}
          {formatDisplayDateTime(photo.uploadedAt)}
        </p>
        <p className="muted">
          Görsel özel depoda tutulur ve yalnız yetkili klinik kullanıcıları için kısa süreli bağlantıyla açılır.
        </p>
      </div>
      <div className="photo-record-actions">
        <SecurePhotoViewer photo={photo} />
      </div>
    </article>
  );
}
