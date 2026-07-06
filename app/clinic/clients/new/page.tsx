import Link from "next/link";
import { ClientForm } from "@/app/clinic/clients/new/client-form";

export const dynamic = "force-dynamic";

export default function NewClientPage() {
  return (
    <section className="page-section stack">
      <div className="page-header">
        <p className="eyebrow">Yeni danışan</p>
        <h1>Temel danışan kaydı</h1>
        <p>TC kimlik, adres, sağlık geçmişi, işlem geçmişi veya tıbbi not alınmaz.</p>
      </div>

      <ClientForm />
      <Link className="button secondary" href="/clinic/clients">
        Vazgeç
      </Link>
    </section>
  );
}
