import Link from "next/link";
import { archiveClientAction, updateClientAction } from "@/lib/clients/actions";
import { getClientDetail } from "@/lib/clients/service";
import { formatDisplayDateTime } from "@/lib/formatters";

export const dynamic = "force-dynamic";

export default async function ClientDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { client, canArchive } = await getClientDetail(id);

  return (
    <section className="page-section stack">
      <div className="page-header row-between">
        <div>
          <p className="eyebrow">Danışan detayı</p>
          <h1>{client.fullName}</h1>
          <p>Danışanın temel iletişim ve kayıt durumunu güvenli şekilde yönetin.</p>
        </div>
        <Link className="button secondary" href="/clinic/clients">
          Listeye dön
        </Link>
      </div>

      <div className="panel detail-grid">
        <div>
          <span className="label">Telefon</span>
          <strong>{client.maskedPhone}</strong>
        </div>
        <div>
          <span className="label">E-posta</span>
          <strong>{client.email ?? "Girilmedi"}</strong>
        </div>
        <div>
          <span className="label">Durum</span>
          <strong>{client.status === "active" ? "Aktif" : "Arşivli"}</strong>
        </div>
        <div>
          <span className="label">Sorumlu çalışan</span>
          <strong>{client.responsibleMembershipId ? "Atandı" : "Atanmadı"}</strong>
        </div>
        <div>
          <span className="label">Oluşturulma</span>
          <strong>{formatDisplayDateTime(client.createdAt)}</strong>
        </div>
        <div>
          <span className="label">Güncellenme</span>
          <strong>{formatDisplayDateTime(client.updatedAt)}</strong>
        </div>
      </div>

      <div className="panel stack" id="edit-client">
        <button className="button secondary" type="button">
          Düzenle
        </button>
        <form className="form-grid" action={updateClientAction}>
          <input type="hidden" name="id" value={client.id} />
          <label htmlFor="fullName">Ad soyad</label>
          <input id="fullName" name="fullName" defaultValue={client.fullName} required />
          <label htmlFor="phone">Telefon</label>
          <input id="phone" name="phone" defaultValue={client.phone} required />
          <label htmlFor="email">E-posta opsiyonel</label>
          <input id="email" name="email" type="email" defaultValue={client.email ?? ""} />
          <input name="responsibleMembershipId" type="hidden" value="" />
          <button className="button" type="submit">
            Kaydet
          </button>
        </form>
      </div>

      {canArchive && client.status === "active" ? (
        <form action={archiveClientAction}>
          <input type="hidden" name="id" value={client.id} />
          <button className="button danger" type="submit">
            Arşivle
          </button>
        </form>
      ) : null}
    </section>
  );
}
