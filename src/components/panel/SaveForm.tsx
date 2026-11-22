"use client";

import { useActionState, type ReactNode } from "react";
import type { PanelFormState } from "@/app/panel/actions";
import styles from "./panel.module.css";

/** Ayar formlarının ortak kabuğu: kaydet düğmesi, hata ve "kaydedildi" bildirimi. */
export function SaveForm({
  action,
  children,
  submitLabel = "Kaydet",
  className,
  compact,
}: {
  action: (prev: PanelFormState, fd: FormData) => Promise<PanelFormState>;
  children: ReactNode;
  submitLabel?: string;
  className?: string;
  compact?: boolean;
}) {
  const [state, run, pending] = useActionState<PanelFormState, FormData>(action, {});
  return (
    <form action={run} className={className} noValidate>
      {children}
      <div className={compact ? styles.saveRowCompact : styles.saveRow}>
        <button type="submit" className={`btn ${compact ? "btn-quiet" : "btn-primary"} ${compact ? styles.smallBtn : ""}`} disabled={pending}>
          {pending ? "Kaydediliyor…" : submitLabel}
        </button>
        {!pending && state.ok && <span className={styles.okInline}>{state.ok}</span>}
        {!pending && state.error && (
          <span className="form-error" role="alert">
            {state.error}
          </span>
        )}
      </div>
    </form>
  );
}
