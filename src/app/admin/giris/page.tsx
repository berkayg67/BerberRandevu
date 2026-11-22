import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { login } from "@/app/admin/actions";
import { LoginForm } from "@/components/admin/LoginForm";
import { AuthShell } from "@/components/auth/AuthShell";
import { getCurrentUser } from "@/server/auth/current";

export const metadata: Metadata = { title: "Yönetici girişi", robots: { index: false } };

async function AlreadySignedIn() {
  const user = await getCurrentUser();
  if (user?.role === "admin") redirect("/admin");
  return null;
}

export default function LoginPage() {
  return (
    <AuthShell title="Yönetici girişi" intro={<p>Bu sayfa yalnızca Tıraş Vakti yöneticisi içindir.</p>}>
      <Suspense>
        <AlreadySignedIn />
      </Suspense>
      <LoginForm login={login} />
    </AuthShell>
  );
}
