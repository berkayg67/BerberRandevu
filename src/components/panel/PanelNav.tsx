"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { CalendarIcon } from "./icons";
import styles from "./panel.module.css";

const ITEMS = [{ href: "/panel", label: "Takvim", icon: <CalendarIcon /> }];

export function PanelNav() {
  const path = usePathname();
  return (
    <nav className={styles.nav} aria-label="Panel">
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
