import type { MetadataRoute } from "next";

/** Berber paneli telefonda "Ana ekrana ekle" ile uygulama gibi açılır. */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Tıraş Vakti",
    short_name: "Tıraş Vakti",
    description: "Berberler için online randevu paneli",
    start_url: "/panel",
    scope: "/",
    display: "standalone",
    background_color: "#f5f6fa",
    theme_color: "#2447d6",
    lang: "tr",
    icons: [
      { src: "/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
