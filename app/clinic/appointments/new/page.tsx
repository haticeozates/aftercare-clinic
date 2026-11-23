import Link from "next/link";
import { AppointmentEditor } from "@/components/appointments/forms";
import { appointmentContext, appointmentOptions } from "@/lib/appointments/service";
import { calendarDate, wallDate } from "@/lib/appointments/calendar";
import { uuid } from "@/lib/appointments/contracts";
import "@/components/appointments/appointments.css";

export default async function NewAppointmentPage({ searchParams }: { searchParams: Promise<{ date?: string; client?: string; plan?: string }> }) {
  const [context, params] = await Promise.all([appointmentContext(), searchParams]);
  const { organization, manager, roster, zone } = context;
  const options = await appointmentOptions(organization.id);
  const date = calendarDate(params.date, wallDate(new Date(), zone));
  const initialClient = options.clients.find((item) => item.id === uuid.safeParse(params.client).data)?.id;
  const initialPlan = options.plans.find((item) => item.id === uuid.safeParse(params.plan).data)?.id;
  return (
    <section className="page-section stack booking-page">
      <header className="page-header booking-heading">
        <div><h1>Yeni randevu</h1><p>Randevu saati · {zone}</p></div>
        <Link className="button secondary" href="/clinic/appointments">Takvime dön</Link>
      </header>
      <div className="panel">
        <AppointmentEditor options={options} roster={manager ? roster : roster.filter((item) => item.own)}
          start={date + "T09:00"} initialClient={initialClient} initialPlan={initialPlan} />
      </div>
    </section>
  );
}
