"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { CalendarIcon, ChartIcon, ChatIcon, GearIcon, PeopleIcon } from "./icons";
import styles from "./panel.module.css";

const ITEMS = [
  { href: "/panel", label: "Takvim", icon: <CalendarIcon /> },
  { href: "/panel/musteriler", label: "Müşteriler", icon: <PeopleIcon /> },
  { href: "/panel/mesajlar", label: "Mesajlar", icon: <ChatIcon /> },
  { href: "/panel/raporlar", label: "Raporlar", icon: <ChartIcon /> },
  { href: "/panel/ayarlar", label: "Ayarlar", icon: <GearIcon /> },
];

/** Aktif sekmeyi adres satırından bulan menü. */
export function PanelNav() {
  return <NavLinks path={usePathname()} />;
}

/** Adres henüz okunmadan (sayfa hazırlanırken) gösterilen aynı menü. */
export function PanelNavFallback() {
  return <NavLinks path="" />;
}

function NavLinks({ path }: { path: string }) {
  return (
    <nav className={`${styles.nav} material`} aria-label="Panel">
      <div className={styles.navIn}>
        {ITEMS.map((i) => (
          <Link
            key={i.href}
            href={i.href}
            className={styles.navLink}
            aria-current={(i.href === "/panel" ? path === "/panel" : path.startsWith(i.href)) ? "page" : undefined}
          >
            {i.icon}
            {i.label}
          </Link>
        ))}
      </div>
    </nav>
  );
}
