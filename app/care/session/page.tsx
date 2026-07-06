import { redirect } from "next/navigation";
import { hasValidPortalSession } from "@/lib/secure-links/service";

export const dynamic = "force-dynamic";

export default async function CareSessionPage() {
  const ok = await hasValidPortalSession();
  if (!ok) {
    redirect("/care/invalid");
  }

  return (
    <main className="shell">
      <section className="panel stack">
        <p className="eyebrow">AfterCare Clinic</p>
        <h1>Bağlantınız doğrulandı.</h1>
        <p>Danışan bakım portalı bir sonraki aşamada etkinleştirilecektir.</p>
      </section>
    </main>
  );
}
