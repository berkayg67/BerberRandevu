import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "BerberRandevu",
  description: "Mahalle berberleri için online randevu sistemi",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="tr">
      <body>{children}</body>
    </html>
  );
}
