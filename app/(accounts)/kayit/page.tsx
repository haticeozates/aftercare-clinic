import Link from "next/link";
import { AccountCard } from "@/components/phase11/account";
import { DemoEmailFields, DemoForm, PasswordFields } from "@/components/phase11/forms";
import { signUpAction } from "@/lib/phase11/auth-actions";

export default function RegistrationPage() {
  return (
    <AccountCard title="Klinik hesabınızı oluşturun" description="Bu yerel portföy demosu için .test uzantılı bir e-posta kullanın. Gerçek kişi veya hasta bilgisi girmeyin.">
      <DemoForm action={signUpAction} submit="Doğrulama bağlantısı iste">
        <DemoEmailFields />
        <PasswordFields />
      </DemoForm>
      <p className="phase11-links"><Link href="/login">Hesabınız var mı? Giriş yapın</Link></p>
    </AccountCard>
  );
}
