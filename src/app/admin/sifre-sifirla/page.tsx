import type { Metadata } from "next";
import Link from "next/link";
import { connection } from "next/server";
import { Suspense } from "react";
import { AuthShell } from "@/components/auth/AuthShell";
import { ResetForm } from "@/components/auth/ResetForm";
import { resetAction } from "@/server/auth/account-actions";
import { checkResetToken } from "@/server/auth/reset";
import { getDb } from "@/server/db/client";

export const metadata: Metadata = { title: "Yeni şifre belirle", robots: { index: false } };

export default function ResetPage({ searchParams }: PageProps<"/admin/sifre-sifirla">) {
  return (
    <AuthShell title="Yeni şifre belirle" footer={<p><Link href="/admin/giris">Giriş sayfasına dön</Link></p>}>
      <Suspense fallback={<p>Yükleniyor…</p>}>
        <Body searchParams={searchParams} />
      </Suspense>
    </AuthShell>
  );
}

async function Body({ searchParams }: { searchParams: Promise<{ token?: string | string[] }> }) {
  await connection();
  const raw = (await searchParams).token;
  const token = typeof raw === "string" ? raw : "";
  const valid = token && (await checkResetToken(getDb(), token));
  if (!valid || valid.role !== "admin") {
    return (
      <div className="callout">
        <b>Bu bağlantı geçersiz ya da süresi dolmuş.</b> <Link href="/admin/sifremi-unuttum">Yeni bağlantı isteyin</Link>.
      </div>
    );
  }
  return <ResetForm action={resetAction.bind(null, "admin", token)} />;
}
