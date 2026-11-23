import Link from "next/link";
import { AccountCard } from "@/components/phase11/account";
import { DemoEmailFields, DemoForm } from "@/components/phase11/forms";
import { recoveryAction } from "@/lib/phase11/auth-actions";

export default function RecoveryPage() {
  return (
    <AccountCard title="Parolanızı yenileyin" description="Klinik hesabınızın .test adresine bir parola yenileme bağlantısı isteyin.">
      <DemoForm action={recoveryAction} submit="Yenileme bağlantısı iste"><DemoEmailFields /></DemoForm>
      <p className="phase11-links"><Link href="/login">Klinik girişine dön</Link></p>
    </AccountCard>
  );
}
