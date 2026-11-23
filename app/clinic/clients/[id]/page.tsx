import Link from "next/link";
import { AppointmentLine } from "@/components/appointments/display";
import { requireActiveMembership } from "@/lib/auth/server";
import { listAppointments, schedulingRoster } from "@/lib/appointments/service";
import { ArchiveClientDialog } from "@/components/clinic/archive-client-dialog";
import { ClientConsentAssignmentsSection } from "@/components/clinic/client-consent-assignments-section";
import { ClientEditForm } from "@/components/clinic/client-edit-form";
import { getClientDetail } from "@/lib/clients/service";
import { formatDisplayDateTime } from "@/lib/formatters";

export const dynamic = "force-dynamic";

export default async function ClientDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [{ client, canArchive }, context] = await Promise.all([getClientDetail(id), requireActiveMembership()]);
  const [appointments, calendar] = await Promise.all([
    listAppointments(context.organization.id, { client: client.id, limit: 5 }),
    schedulingRoster(context.organization.id, context.user.id)
  ]);

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

      <ClientEditForm
        client={{
          id: client.id,
          fullName: client.fullName,
          phone: client.phone,
          email: client.email
        }}
      />

      {canArchive && client.status === "active" ? (
        <ArchiveClientDialog clientId={client.id} clientName={client.fullName} />
      ) : null}

      <section className="panel stack">
        <div className="section-header">
          <h2>Randevu geçmişi</h2>
          <div className="button-row">
            <Link href={`/clinic/appointments?list=history&client=${client.id}`}>Tüm randevular</Link>
            {client.status === "active" && <Link href={`/clinic/appointments/new?client=${client.id}`}>Randevu oluştur</Link>}
          </div>
        </div>
        {appointments.length ? appointments.map((item) => (
          <AppointmentLine item={item} key={item.id} zone={calendar.zone} showDate />
        )) : <p>Bu danışana ait randevu bulunmuyor.</p>}
      </section>
      <ClientConsentAssignmentsSection clientId={client.id} />
    </section>
  );
}
