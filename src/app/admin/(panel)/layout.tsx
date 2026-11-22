import Link from "next/link";
import { logout } from "@/app/admin/actions";
import styles from "@/components/admin/admin.module.css";
import { ThemeToggle } from "@/components/theme/ThemeToggle";
import { Logo } from "@/components/brand/Logo";

export default function AdminLayout({ children }: LayoutProps<"/admin">) {
  return (
    <div className={styles.shell}>
      <header className={`${styles.head} material`}>
        <Link href="/admin" className={styles.homeLink} aria-label="Yönetim ana sayfası">
          <Logo size={24} /> <span className="tag tag-grey">Yönetim</span>
        </Link>
        <div className={styles.headRight}>
          <Link href="/admin/hesap" className={styles.logout}>
            Hesabım
          </Link>
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
