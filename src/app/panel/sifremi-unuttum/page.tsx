import type { Metadata } from "next";
import Link from "next/link";
import { AuthShell } from "@/components/auth/AuthShell";
import { ForgotForm } from "@/components/auth/ForgotForm";
import { forgotAction } from "@/server/auth/account-actions";

export const metadata: Metadata = { title: "Şifremi unuttum", robots: { index: false } };

export default function ForgotPage() {
  return (
    <AuthShell
      title="Şifremi unuttum"
      intro={<p>Kayıtlı e-posta adresinizi yazın, yeni şifre belirlemeniz için bir bağlantı gönderelim.</p>}
      footer={
        <p>
          Şifrenizi hatırladınız mı? <Link href="/panel/giris">Giriş yapın</Link>
        </p>
      }
    >
      <ForgotForm action={forgotAction.bind(null, "owner")} />
    </AuthShell>
  );
}
