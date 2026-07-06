import Link from "next/link";
import { createClientAction } from "@/lib/clients/actions";

export const dynamic = "force-dynamic";

export default function NewClientPage() {
  return (
    <section className="page-section stack">
      <div className="page-header">
        <p className="eyebrow">Yeni danışan</p>
        <h1>Temel danışan kaydı</h1>
        <p>TC kimlik, adres, sağlık geçmişi, işlem geçmişi veya tıbbi not alınmaz.</p>
      </div>

      <form className="panel form-grid" action={createClientAction}>
        <label>
          Ad soyad
          <input name="fullName" required minLength={2} maxLength={120} autoComplete="off" />
        </label>
        <label>
          Telefon
          <input name="phone" required inputMode="tel" placeholder="0555 010 00 01" autoComplete="off" />
        </label>
        <label>
          E-posta opsiyonel
          <input name="email" type="email" placeholder="sentetik@example.test" autoComplete="off" />
        </label>
        <input name="responsibleMembershipId" type="hidden" value="" />
        <div className="button-row">
          <button className="button" type="submit">
            Danışan oluştur
          </button>
          <Link className="button secondary" href="/clinic/clients">
            Vazgeç
          </Link>
        </div>
      </form>
    </section>
  );
}
