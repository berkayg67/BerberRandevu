import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { loginOwner } from "@/app/panel/actions";
import { LoginForm } from "@/components/admin/LoginForm";
import { AuthShell } from "@/components/auth/AuthShell";
import { getCurrentUser } from "@/server/auth/current";

export const metadata: Metadata = { title: "Berber girişi", robots: { index: false } };

async function AlreadySignedIn() {
  const user = await getCurrentUser();
  if (user?.role === "owner") redirect("/panel");
  return null;
}

export default function OwnerLoginPage() {
  return (
    <AuthShell
      title="Berber girişi"
      intro={<p>Dükkânınızın randevularını, müşterilerini ve ayarlarını buradan yönetirsiniz.</p>}
      footer={
        <p>
          Hesabınız yok mu? <Link href="/panel/kayit">Dükkânınızı kaydedin</Link>
        </p>
      }
    >
      <Suspense>
        <AlreadySignedIn />
      </Suspense>
      <LoginForm login={loginOwner} forgotHref="/panel/sifremi-unuttum" />
    </AuthShell>
  );
}
