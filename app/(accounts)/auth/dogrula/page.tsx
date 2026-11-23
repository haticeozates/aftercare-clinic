import Link from "next/link";
import { AccountCard } from "@/components/phase11/account";
import { CapabilityForm } from "@/components/phase11/capability-form";

export default function ConfirmPage() {
  return (
    <AccountCard title="E-posta bağlantısını onaylayın" description="Doğrulama veya parola yenileme işlemini başlatan sizseniz devam edin.">
      <CapabilityForm kind="auth" />
      <p className="phase11-links">
        <Link href="/kayit">Hesap kaydı</Link>
        <Link href="/sifre-unuttum">Parola yenileme</Link>
      </p>
    </AccountCard>
  );
}
