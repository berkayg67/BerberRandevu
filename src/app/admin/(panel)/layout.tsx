import Link from "next/link";
import { logout } from "@/app/admin/actions";
import styles from "@/components/admin/admin.module.css";
import { ThemeToggle } from "@/components/theme/ThemeToggle";
import { Plate } from "@/components/ui/Plate";

export default function AdminLayout({ children }: LayoutProps<"/admin">) {
  return (
    <div className={styles.shell}>
      <header className={`${styles.head} material`}>
        <Link href="/admin" className={styles.homeLink} aria-label="Yönetim ana sayfası">
          <Plate district="Yönetim" name="BerberRandevu" size="sm" />
        </Link>
        <div className={styles.headRight}>
          <ThemeToggle />
          <form action={logout}>
            <button type="submit" className={styles.logout}>
              Çıkış yap
            </button>
          </form>
        </div>
      </header>
      <main className={styles.main}>{children}</main>
    </div>
  );
}
