import Link from "next/link";
import { AccountCard } from "@/components/phase11/account";
import { DemoForm, PasswordFields } from "@/components/phase11/forms";
import { resetPasswordAction } from "@/lib/phase11/auth-actions";
import { getRecoveryCookie, requirePhase11 } from "@/lib/phase11/server";

export default async function ResetPasswordPage({ searchParams }: {
  searchParams: Promise<{ durum?: string }>;
}) {
  requirePhase11();
  const ready = Boolean(await getRecoveryCookie());
  const { durum } = await searchParams;
  const message = durum === "gecersiz" ? "Bağlantı geçersiz, kullanılmış veya süresi dolmuş."
    : durum === "yeni-baglanti" ? "Parola değiştirilemedi. Yeni bir bağlantı isteyin."
    : "Geçerli bir parola yenileme oturumu bulunamadı.";

  return (
    <AccountCard title="Yeni parola belirleyin" description="Parolanızı güncelledikten sonra yeni parolanızla giriş yapın.">
      {ready ? <DemoForm action={resetPasswordAction} submit="Parolayı kaydet"><PasswordFields /></DemoForm> : (
        <>
          <p className="form-error" role="alert">{message}</p>
          <p className="phase11-links"><Link href="/sifre-unuttum">Yeni bağlantı iste</Link></p>
        </>
      )}
    </AccountCard>
  );
}
