import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import styles from "@/components/admin/admin.module.css";
import { AccountForm, ChangePasswordForm } from "@/components/auth/SecurityForms";
import { requireAdmin } from "@/server/auth/current";

export const metadata: Metadata = { title: "Hesabım, Yönetim", robots: { index: false } };

export default function AdminAccountPage() {
  return (
    <>
      <Link href="/admin" className={styles.back}>
        Tüm dükkânlar
      </Link>
      <Suspense fallback={<p className={styles.loading}>Yükleniyor…</p>}>
        <Body />
      </Suspense>
    </>
  );
}

async function Body() {
  const user = await requireAdmin();
  return (
    <>
      <div className={styles.titleRow}>
        <div>
          <h1 className={styles.h1}>Hesabım</h1>
          <p className={styles.sub}>Yönetici hesabınızın bilgileri ve şifresi.</p>
        </div>
      </div>
      <h2 className={styles.h2}>Bilgiler</h2>
      <AccountForm name={user.name} email={user.email} />
      <h2 className={styles.h2}>Şifre</h2>
      <ChangePasswordForm />
    </>
  );
}
