import type { Metadata } from "next";
import Link from "next/link";
import { AuthShell } from "@/components/auth/AuthShell";
import { SignupForm } from "@/components/auth/SignupForm";

export const metadata: Metadata = { title: "Dükkânınızı kaydedin" };

export default function SignupPage() {
  return (
    <AuthShell
      wide
      title="Dükkânınızı kaydedin"
      intro={
        <p>
          Başvurunuzu inceleyip onayladıktan sonra dükkânınızın randevu sayfası açılır. Fotoğraf, çalışma saatleri ve
          hizmetleri onaydan sonra panelden eklersiniz.
        </p>
      }
      footer={
        <p>
          Zaten hesabınız var mı? <Link href="/panel/giris">Giriş yapın</Link>
        </p>
      }
    >
      <SignupForm />
    </AuthShell>
  );
}
