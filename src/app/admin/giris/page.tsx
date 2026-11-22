import type { Metadata } from "next";
import { Suspense } from "react";
import { redirect } from "next/navigation";
import styles from "@/components/admin/admin.module.css";
import { LoginForm } from "@/components/admin/LoginForm";
import { Plate } from "@/components/ui/Plate";
import { getCurrentUser } from "@/server/auth/current";

export const metadata: Metadata = { title: "Yönetici girişi", robots: { index: false } };

/** Zaten giriş yapmış yöneticiyi panele gönderir. */
async function AlreadySignedIn() {
  const user = await getCurrentUser();
  if (user?.role === "admin") redirect("/admin");
  return null;
}

export default function LoginPage() {
  return (
    <div className={styles.loginWrap}>
      <div className={styles.loginCard}>
        <Suspense>
          <AlreadySignedIn />
        </Suspense>
        <Plate district="Yönetim" name="BerberRandevu" />
        <h1>Yönetici girişi</h1>
        <p>Bu sayfa yalnızca sistem yöneticisi içindir.</p>
        <LoginForm />
      </div>
    </div>
  );
}
