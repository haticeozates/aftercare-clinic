import Link from "next/link";
import { AccountCard } from "@/components/phase11/account";
import { CapabilityForm } from "@/components/phase11/capability-form";
import { acceptInviteAction } from "@/lib/phase11/clinic-actions";
import { getInviteCookie, getVerifiedUser, requirePhase11 } from "@/lib/phase11/server";

export default async function InvitePage({ searchParams }: { searchParams: Promise<{ durum?: string }> }) {
  requirePhase11();
  const saved = await getInviteCookie();
  const { durum } = await searchParams;
  const actor = saved ? await getVerifiedUser() : null;
  return (
    <AccountCard title="Klinik ekip daveti" description="Daveti kabul etmek için gönderildiği doğrulanmış e-posta hesabıyla giriş yapın.">
      {durum === "kapali" ? <p className="form-error" role="alert">
        Bu davet kullanılamıyor. Bağlantıyı, hesabınızı veya davetin süresini kontrol edin.
      </p> : saved ? actor ? (
        <form action={acceptInviteAction}>
          <button className="ui-button ui-button--primary" type="submit">Ekip davetini kabul et</button>
        </form>
      ) : (
        <p className="phase11-links"><Link href="/login">Giriş yap</Link><Link href="/kayit">Hesap oluştur</Link></p>
      ) : <CapabilityForm kind="invite" />}
      <p className="phase11-links"><Link href="/">Ana sayfaya dön</Link></p>
    </AccountCard>
  );
}
