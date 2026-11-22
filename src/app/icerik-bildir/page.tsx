import type { Metadata } from "next";
import { Suspense } from "react";
import { LegalHeader } from "@/components/legal/LegalFrame";
import legal from "@/components/legal/legal.module.css";
import { ReportForm } from "@/components/legal/ReportForm";
import { REPORT_REASONS } from "@/server/reports/content";

export const metadata: Metadata = { title: "İçeriği bildir", robots: { index: false } };

async function Form({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const q = await searchParams;
  const from = typeof q.sayfa === "string" ? q.sayfa.slice(0, 200) : undefined;
  return <ReportForm reasons={Object.entries(REPORT_REASONS)} initialTarget={from} />;
}

export default function ReportPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  return (
    <div className={legal.page}>
      <LegalHeader />
      <main className={legal.main}>
        <h1 className={legal.h1}>İçeriği bildir</h1>
        <p className={legal.lead}>
          Tıraş Vakti, dükkân sayfalarındaki içeriği berberler yayımladığı için yer sağlayıcıdır. Hukuka aykırı olduğunu
          ya da haklarınızı ihlal ettiğini düşündüğünüz bir fotoğraf, metin ya da bilgi varsa buradan bildirin. Bildirimleri
          inceler, gerekirse içeriği kaldırırız.
        </p>
        <Suspense>
          <Form searchParams={searchParams} />
        </Suspense>
      </main>
    </div>
  );
}
