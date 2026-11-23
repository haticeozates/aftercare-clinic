import Link from "next/link";
import { redirect } from "next/navigation";
import { AppointmentEditor } from "@/components/appointments/forms";
import { appointmentContext, appointmentOptions, getAppointment } from "@/lib/appointments/service";
import { clockLabel, wallDate } from "@/lib/appointments/calendar";
import { transitions } from "@/lib/appointments/contracts";
import "@/components/appointments/appointments.css";

export default async function EditAppointmentPage({ params }: { params: Promise<{ id: string }> }) {
  const [context, { id }] = await Promise.all([appointmentContext(), params]);
  const item = await getAppointment(context.organization.id, id);
  if (!transitions[item.status].length || (!context.manager && !context.roster.some((member) => member.id === item.membership_id && member.own))) {
    redirect(`/clinic/appointments/${item.id}`);
  }
  const options = await appointmentOptions(context.organization.id);
  return (
    <section className="page-section stack booking-page">
      <header className="page-header booking-heading">
        <div><h1>Randevuyu düzenle</h1><p>Yeni saat klinik ve uzman müsaitliğine göre kontrol edilir · {context.zone}</p></div>
        <Link className="button secondary" href={`/clinic/appointments/${id}`}>Randevuya dön</Link>
      </header>
      <div className="panel">
        <AppointmentEditor options={options} roster={context.manager ? context.roster : context.roster.filter((item) => item.own)} base={item}
          start={wallDate(item.starts_at, context.zone) + "T" + clockLabel(item.starts_at, context.zone)} />
      </div>
    </section>
  );
}
