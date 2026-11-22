"use client";

import { useSearchParams } from "next/navigation";

/** Şifre sıfırlandıktan sonra giriş sayfasının üstünde çıkan bilgi. */
export function RenewedNotice() {
  const renewed = useSearchParams().get("sifre") === "yenilendi";
  if (!renewed) return null;
  return (
    <div className="callout" role="status" style={{ marginBottom: 16 }}>
      <b>Şifreniz yenilendi.</b> Yeni şifrenizle giriş yapabilirsiniz.
    </div>
  );
}
