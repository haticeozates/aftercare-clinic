import Link from "next/link";
import { archiveClientAction } from "@/lib/clients/actions";
import { getClientDetail } from "@/lib/clients/service";

export const dynamic = "force-dynamic";

function formatDate(value: string) {
  return new Intl.DateTimeFormat("tr-TR", { dateStyle: "medium", timeStyle: "short" }).format(new Date(value));
}

export default async function ClientDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { client, canArchive } = await getClientDetail(id);

  return (
    <section className="page-section stack">
      <div className="page-header row-between">
        <div>
          <p className="eyebrow">Danışan detayı</p>
          <h1>{client.fullName}</h1>
          <p>Bu ekranda yalnız temel danışan bilgileri yer alır.</p>
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
          <strong>{formatDate(client.createdAt)}</strong>
        </div>
        <div>
          <span className="label">Güncellenme</span>
          <strong>{formatDate(client.updatedAt)}</strong>
        </div>
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
