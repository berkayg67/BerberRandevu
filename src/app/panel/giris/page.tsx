import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { loginOwner } from "@/app/panel/actions";
import styles from "@/components/admin/admin.module.css";
import { LoginForm } from "@/components/admin/LoginForm";
import { Plate } from "@/components/ui/Plate";
import { getCurrentUser } from "@/server/auth/current";

export const metadata: Metadata = { title: "Berber girişi", robots: { index: false } };

async function AlreadySignedIn() {
  const user = await getCurrentUser();
  if (user?.role === "owner") redirect("/panel");
  return null;
}

export default function OwnerLoginPage() {
  return (
    <div className={styles.loginWrap}>
      <div className={styles.loginCard}>
        <Suspense>
          <AlreadySignedIn />
        </Suspense>
        <Plate district="Berber paneli" name="BerberRandevu" />
        <h1>Giriş yapın</h1>
        <p>Dükkânınızın randevularını buradan yönetirsiniz. Giriş bilgilerinizi size biz ilettik.</p>
        <LoginForm login={loginOwner} />
      </div>
    </div>
  );
}
