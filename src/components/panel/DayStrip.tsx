"use client";

import { useLayoutEffect, useRef, type ReactNode } from "react";
import styles from "./panel.module.css";

/** Gün şeridi; seçili günü ortaya getirir (sayfayı dikey kaydırmadan). */
export function DayStrip({ children }: { children: ReactNode }) {
  const ref = useRef<HTMLElement>(null);
  useLayoutEffect(() => {
    const strip = ref.current;
    const sel = strip?.querySelector<HTMLElement>("[aria-current=date]");
    if (strip && sel) strip.scrollLeft = sel.offsetLeft - strip.clientWidth / 2 + sel.offsetWidth / 2;
  });
  return (
    <nav ref={ref} className={styles.days} aria-label="Günler">
      {children}
    </nav>
  );
}
