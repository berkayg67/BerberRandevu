"use client";

import { useEffect, useState } from "react";
import { openStatus } from "@/lib/domain/open-status";
import styles from "./OpenStatus.module.css";

type Props = {
  hours: { weekday: number; opens: string; closes: string }[];
  lunch: { start: string; end: string } | null;
  timeZone: string;
};

/** "Şu an açık" bilgisi saate bağlı olduğu için tarayıcıda hesaplanır ve her dakika yenilenir. */
export function OpenStatus({ hours, lunch, timeZone }: Props) {
  const [status, setStatus] = useState<{ open: boolean; text: string } | null>(null);
  useEffect(() => {
    const update = () => setStatus(openStatus(hours, lunch, timeZone, new Date()));
    update();
    const t = setInterval(update, 60_000);
    return () => clearInterval(t);
  }, [hours, lunch, timeZone]);

  return (
    <span className={`${styles.status} ${status && !status.open ? styles.closed : ""}`} aria-live="polite">
      <i aria-hidden="true" />
      {status?.text ?? " "}
    </span>
  );
}
