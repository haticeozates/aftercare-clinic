import Link from "next/link";
import { listClients, type ClientStatus } from "@/lib/clients/service";

export const dynamic = "force-dynamic";

function formatDate(value: string) {
  return new Intl.DateTimeFormat("tr-TR", { dateStyle: "medium" }).format(new Date(value));
}

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
          <p>Bu fazda yalnız temel kimlik ve iletişim kaydı tutulur.</p>
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
          <div className="empty-state">
            <h2>Kayıt bulunamadı</h2>
            <p>Filtreleri değiştirin veya yeni bir sentetik danışan kaydı oluşturun.</p>
          </div>
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Ad soyad</th>
                  <th>Telefon</th>
                  <th>Durum</th>
                  <th>Sorumlu</th>
                  <th>Oluşturulma</th>
                  <th />
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
                    <td data-label="Oluşturulma">{formatDate(client.createdAt)}</td>
                    <td data-label="Aksiyon">
                      <Link href={`/clinic/clients/${client.id}`}>Detay</Link>
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
