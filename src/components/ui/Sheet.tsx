"use client";

import { useEffect, useEffectEvent, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import styles from "./Sheet.module.css";

type Props = {
  open: boolean;
  onClose: () => void;
  /** Ekran okuyucular için başlık. */
  label: string;
  children: ReactNode;
};

/**
 * Alttan açılan pencere. Aşağı sürükleyerek, karartılmış alana dokunarak ya da
 * Escape ile kapanır. Hızlı bir aşağı fırlatma da kapatır (hız eşiği).
 */
export function Sheet({ open, onClose, label, children }: Props) {
  // Kapanış animasyonu bitene kadar pencere DOM'da kalır.
  const [rendered, setRendered] = useState(open);
  const [visible, setVisible] = useState(false);
  if (open && !rendered) setRendered(true);
  const panel = useRef<HTMLDivElement>(null);
  const drag = useRef<{ y: number; t: number; dy: number; id: number } | null>(null);

  useEffect(() => {
    if (open) {
      // İki kare bekle: önce kapalı konumda çizilsin, sonra açılış geçişi başlasın.
      const raf = requestAnimationFrame(() => requestAnimationFrame(() => setVisible(true)));
      return () => cancelAnimationFrame(raf);
    }
    const raf = requestAnimationFrame(() => setVisible(false));
    const t = setTimeout(() => setRendered(false), 260);
    return () => {
      cancelAnimationFrame(raf);
      clearTimeout(t);
    };
  }, [open]);

  // Escape tuşu her zaman en güncel onClose'u çağırır; efekt yalnızca açılıp kapanınca çalışır.
  const onEscape = useEffectEvent(() => onClose());

  useEffect(() => {
    if (!open) return;
    const previous = document.activeElement as HTMLElement | null;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onEscape();
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    const focusTimer = setTimeout(() => panel.current?.focus({ preventScroll: true }), 50);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
      clearTimeout(focusTimer);
      previous?.focus?.({ preventScroll: true });
    };
  }, [open]);

  function onPointerDown(e: React.PointerEvent) {
    if (drag.current) return; // ikinci parmağı yok say
    drag.current = { y: e.clientY, t: performance.now(), dy: 0, id: e.pointerId };
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    if (panel.current) panel.current.style.transition = "none";
  }

  function onPointerMove(e: React.PointerEvent) {
    const d = drag.current;
    if (!d || e.pointerId !== d.id || !panel.current) return;
    d.dy = e.clientY - d.y;
    // Yukarı çekince sürtünme: hareket giderek azalır.
    const y = d.dy > 0 ? d.dy : -Math.sqrt(-d.dy) * 2;
    panel.current.style.transform = `translateY(${y}px)`;
  }

  function onPointerEnd(e: React.PointerEvent) {
      const d = drag.current;
      if (!d || e.pointerId !== d.id || !panel.current) return;
      drag.current = null;
      panel.current.style.transition = "";
      panel.current.style.transform = "";
      const velocity = Math.abs(d.dy) / Math.max(1, performance.now() - d.t);
      if (d.dy > 120 || (d.dy > 10 && velocity > 0.11)) onClose();
  }

  if (!rendered) return null;
  return createPortal(
    <>
      <div className={`${styles.scrim} ${visible ? styles.scrimOpen : ""}`} onClick={onClose} aria-hidden="true" />
      <div
        ref={panel}
        className={`${styles.sheet} ${visible ? styles.open : ""}`}
        role="dialog"
        aria-modal="true"
        aria-label={label}
        tabIndex={-1}
      >
        <div
          className={styles.grab}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerEnd}
          onPointerCancel={onPointerEnd}
          aria-hidden="true"
        >
          <span />
        </div>
        {children}
      </div>
    </>,
    document.body,
  );
}
