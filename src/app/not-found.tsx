import Link from "next/link";

export default function NotFound() {
  return (
    <main style={{ maxWidth: 480, margin: "0 auto", padding: "64px 20px" }}>
      <h1 style={{ font: "600 34px/1.1 var(--f-display)", marginBottom: 8 }}>Sayfa bulunamadı</h1>
      <p style={{ color: "var(--muted)", marginBottom: 20 }}>
        Bu adreste bir dükkân yok ya da dükkân şu an randevu almıyor. Bağlantıyı dükkândan tekrar isteyebilirsiniz.
      </p>
      <Link href="/" className="btn btn-quiet">
        Ana sayfaya dön
      </Link>
    </main>
  );
}
