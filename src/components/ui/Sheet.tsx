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

/** Sınırın ötesine çekince öğe giderek daha az takip eder (Apple'ın rubber-band formülü). */
function rubberband(overshoot: number, dimension: number, constant = 0.55) {
  return (overshoot * dimension * constant) / (dimension + constant * Math.abs(overshoot));
}

/** Bırakılan hızla öğenin nerede duracağını öngörür (kaydırma yavaşlamasıyla aynı form). */
function project(velocityPxPerMs: number, decelerationRate = 0.998) {
  return (velocityPxPerMs * decelerationRate) / (1 - decelerationRate);
}

const DRAWER = "cubic-bezier(0.32, 0.72, 0, 1)";

/**
 * Alttan açılan pencere. Tutamaktan sürüklenince parmağı birebir izler,
 * yukarı çekince direnç gösterir, bırakınca parmağın hızıyla kapanır ya da
 * yerine oturur. Karartılmış alana dokunarak ya da Escape ile de kapanır.
 */
export function Sheet({ open, onClose, label, children }: Props) {
  // Kapanış animasyonu bitene kadar pencere DOM'da kalır.
  const [rendered, setRendered] = useState(open);
  const [visible, setVisible] = useState(false);
  if (open && !rendered) setRendered(true);
  const panel = useRef<HTMLDivElement>(null);
  const scrim = useRef<HTMLDivElement>(null);
  const drag = useRef<{ id: number; startY: number; dy: number; height: number; history: { y: number; t: number }[] } | null>(
    null,
  );

  useEffect(() => {
    if (open) {
      // Sürükleyerek kapatıldıktan hemen sonra yeniden açılırsa önceki satır içi konum temizlenir.
      for (const el of [panel.current, scrim.current]) {
        el?.style.removeProperty("transform");
        el?.style.removeProperty("transition");
        el?.style.removeProperty("opacity");
      }
      // İki kare bekle: önce kapalı konumda çizilsin, sonra açılış geçişi başlasın.
      const raf = requestAnimationFrame(() => requestAnimationFrame(() => setVisible(true)));
      return () => cancelAnimationFrame(raf);
    }
    const raf = requestAnimationFrame(() => setVisible(false));
    const t = setTimeout(() => setRendered(false), 320);
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
    const el = panel.current;
    if (drag.current || !el) return; // ikinci parmağı yok say
    // Pencere hareket halindeyse şu anki konumundan yakala (sıçrama olmasın).
    const live = new DOMMatrixReadOnly(getComputedStyle(el).transform).m42 || 0;
    drag.current = {
      id: e.pointerId,
      startY: e.clientY - live,
      dy: live,
      height: el.getBoundingClientRect().height,
      history: [{ y: e.clientY, t: e.timeStamp }],
    };
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    el.style.transition = "none";
    if (scrim.current) scrim.current.style.transition = "none";
  }

  function onPointerMove(e: React.PointerEvent) {
    const d = drag.current;
    const el = panel.current;
    if (!d || e.pointerId !== d.id || !el) return;
    d.dy = e.clientY - d.startY;
    d.history.push({ y: e.clientY, t: e.timeStamp });
    if (d.history.length > 6) d.history.shift();
    const y = d.dy >= 0 ? d.dy : rubberband(d.dy, d.height);
    el.style.transform = `translateY(${y}px)`;
    if (scrim.current) scrim.current.style.opacity = String(Math.max(0, 1 - Math.max(0, d.dy) / d.height));
  }

  function onPointerEnd(e: React.PointerEvent) {
    const d = drag.current;
    const el = panel.current;
    if (!d || e.pointerId !== d.id || !el) return;
    drag.current = null;

    // Son ~100 ms'deki hareketten bırakma hızı (px/ms).
    const last = d.history[d.history.length - 1];
    const first = d.history.find((h) => last.t - h.t <= 100) ?? d.history[0];
    const velocity = last.t > first.t ? (last.y - first.y) / (last.t - first.t) : 0;
    const landing = d.dy + project(velocity);

    if (landing > d.height * 0.5 || (d.dy > 24 && velocity > 0.5)) {
      // Kapan: kalan yolu parmağın hızıyla bitir (sürükleme ile animasyon arasında dikiş olmasın).
      const remaining = d.height - Math.max(0, d.dy);
      const ms = Math.round(Math.min(320, Math.max(140, remaining / Math.max(velocity, 0.9))));
      el.style.transition = `transform ${ms}ms ${DRAWER}`;
      el.style.transform = "translateY(100%)";
      if (scrim.current) {
        scrim.current.style.transition = `opacity ${ms}ms ease`;
        scrim.current.style.opacity = "0";
      }
      onClose();
    } else {
      // Yerine otur: aşmadan, yumuşakça (kritik sönümlü yay hissi).
      el.style.transition = `transform 380ms ${DRAWER}`;
      el.style.transform = "";
      if (scrim.current) {
        scrim.current.style.transition = "opacity 380ms ease";
        scrim.current.style.opacity = "";
      }
    }
  }

  if (!rendered) return null;
  return createPortal(
    <>
      <div ref={scrim} className={`${styles.scrim} ${visible ? styles.scrimOpen : ""}`} onClick={onClose} aria-hidden="true" />
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
