import Link from "next/link";
import { listClients, type ClientStatus } from "@/lib/clients/service";
import { formatDisplayDateTime } from "@/lib/formatters";
import { ButtonLink, EmptyState } from "@/components/ui";

export const dynamic = "force-dynamic";

export default async function ClientsPage({
  searchParams
}: {
  searchParams: Promise<{ status?: ClientStatus; q?: string }>;
}) {
  const params = await searchParams;
  const status = params.status === "archived" ? "archived" : "active";
  const { clients } = await listClients({ status, search: params.q });

  return (
    <section className="page-section stack">
      <div className="page-header row-between">
        <div>
          <p className="eyebrow">Danışanlar</p>
          <h1>Danışan kayıtları</h1>
          <p>Danışan kayıtlarınızı güvenli şekilde görüntüleyin ve yönetin.</p>
        </div>
        <Link className="button" href="/clinic/clients/new">
          Yeni danışan
        </Link>
      </div>

      <form className="toolbar" action="/clinic/clients">
        <input name="q" placeholder="Ad soyad ara" defaultValue={params.q ?? ""} />
        <select name="status" defaultValue={status}>
          <option value="active">Aktif</option>
          <option value="archived">Arşivli</option>
        </select>
        <button className="button secondary" type="submit">
          Filtrele
        </button>
      </form>

      <div className="panel">
        {clients.length === 0 ? (
          <EmptyState
            title={params.q ? "Arama sonucu bulunamadı" : status === "archived" ? "Arşivli danışan yok" : "Danışan kaydı yok"}
            description={
              params.q
                ? "Farklı bir arama terimi deneyin veya filtreyi temizleyin."
                : status === "archived"
                  ? "Arşivlenmiş danışan kaydı bulunmuyor."
                  : "Yeni bir danışan kaydı oluşturarak takip akışını başlatın."
            }
            action={!params.q && status === "active" ? <ButtonLink href="/clinic/clients/new">Yeni danışan</ButtonLink> : undefined}
          />
        ) : (
          <div className="table-wrap" role="region" aria-label="Danışan listesi" tabIndex={0}>
            <table>
              <thead>
                <tr>
                  <th scope="col">Ad soyad</th>
                  <th scope="col">Telefon</th>
                  <th scope="col">Durum</th>
                  <th scope="col">Sorumlu</th>
                  <th scope="col">Oluşturulma</th>
                  <th scope="col"><span className="sr-only">İşlemler</span></th>
                </tr>
              </thead>
              <tbody>
                {clients.map((client) => (
                  <tr key={client.id}>
                    <td data-label="Ad soyad">{client.fullName}</td>
                    <td data-label="Telefon">{client.maskedPhone}</td>
                    <td data-label="Durum">
                      <span className="badge">{client.status === "active" ? "Aktif" : "Arşivli"}</span>
                    </td>
                    <td data-label="Sorumlu">{client.responsibleMembershipId ? "Atandı" : "Atanmadı"}</td>
                    <td data-label="Oluşturulma">{formatDisplayDateTime(client.createdAt)}</td>
                    <td data-label="Aksiyon">
                      <Link className="action-link" href={`/clinic/clients/${client.id}`}>
                        Detay
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </section>
  );
}
