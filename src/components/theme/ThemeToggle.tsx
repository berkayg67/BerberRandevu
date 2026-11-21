"use client";

import { useEffect } from "react";
import { THEME_STORAGE_KEY, type Theme } from "./theme";
import styles from "./ThemeToggle.module.css";

function applyTheme(theme: Theme) {
  const root = document.documentElement;
  // Renk geçişlerini bir kare boyunca kapat: tema bir anda değişsin.
  root.classList.add("theme-switching");
  root.dataset.theme = theme;
  requestAnimationFrame(() =>
    requestAnimationFrame(() => root.classList.remove("theme-switching")),
  );
}

function savedTheme(): Theme | null {
  try {
    const value = localStorage.getItem(THEME_STORAGE_KEY);
    return value === "light" || value === "dark" ? value : null;
  } catch {
    return null;
  }
}

/**
 * Aydınlık / karanlık mod düğmesi. Simge CSS ile seçilir, bu yüzden
 * sunucu ve tarayıcı çıktısı aynıdır.
 */
export function ThemeToggle() {
  useEffect(() => {
    // Kullanıcı elle seçim yapmadıysa sistem ayarı değiştiğinde onu izle.
    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const onChange = () => {
      if (!savedTheme()) applyTheme(media.matches ? "dark" : "light");
    };
    media.addEventListener("change", onChange);
    return () => media.removeEventListener("change", onChange);
  }, []);

  function toggle() {
    const next: Theme =
      document.documentElement.dataset.theme === "dark" ? "light" : "dark";
    applyTheme(next);
    try {
      localStorage.setItem(THEME_STORAGE_KEY, next);
    } catch {
      /* gizli sekmede saklanamayabilir; tema yine de değişir */
    }
  }

  return (
    <button type="button" className={styles.toggle} onClick={toggle}>
      <svg className={styles.moon} viewBox="0 0 24 24" aria-hidden="true">
        <path d="M20 14.5A8 8 0 0 1 9.5 4a8 8 0 1 0 10.5 10.5Z" />
      </svg>
      <svg className={styles.sun} viewBox="0 0 24 24" aria-hidden="true">
        <circle cx="12" cy="12" r="4" />
        <path d="M12 2.5v2M12 19.5v2M4.6 4.6l1.4 1.4M18 18l1.4 1.4M2.5 12h2M19.5 12h2M4.6 19.4 6 18M18 6l1.4-1.4" />
      </svg>
      <span className={styles.labelDark}>Karanlık moda geç</span>
      <span className={styles.labelLight}>Aydınlık moda geç</span>
    </button>
  );
}
