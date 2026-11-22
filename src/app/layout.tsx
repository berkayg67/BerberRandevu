import type { Metadata, Viewport } from "next";
import "@fontsource-variable/figtree";
import "@fontsource/barlow-condensed/500.css";
import "@fontsource/barlow-condensed/600.css";
import "@fontsource/barlow-condensed/700.css";
import "./globals.css";
import { themeBootScript } from "@/components/theme/theme";

export const metadata: Metadata = {
  title: { default: "Tıraş Vakti", template: "%s | Tıraş Vakti" },
  description: "Berberler için online randevu sistemi. Müşteri boş saati görüp randevu alır, berber günü tek ekrandan yönetir.",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f5f6fa" },
    { media: "(prefers-color-scheme: dark)", color: "#0e1220" },
  ],
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    // data-theme açılış betiğiyle ayarlandığı için uyarı bastırılır.
    <html lang="tr" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeBootScript }} />
      </head>
      <body>{children}</body>
    </html>
  );
}
