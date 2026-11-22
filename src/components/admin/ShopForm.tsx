"use client";

import { useActionState } from "react";
import { createShopAction, updateShopAction, type FormState } from "@/app/admin/actions";
import styles from "./admin.module.css";

export type ShopFormDefaults = {
  name?: string;
  district?: string;
  address?: string;
  phone?: string;
  notifyPhone?: string;
  ownerName?: string | null;
  ownerPhone?: string | null;
  monthlyFee?: string;
  billingStart?: string;
  adminNotes?: string | null;
  active?: boolean;
};

type Props = { mode: "create"; defaults: ShopFormDefaults } | { mode: "edit"; shopId: string; defaults: ShopFormDefaults };

export function ShopForm(props: Props) {
  const d = props.defaults;
  const boundAction = props.mode === "create" ? createShopAction : updateShopAction.bind(null, props.shopId);
  const [state, action, pending] = useActionState<FormState, FormData>(boundAction, {});

  const field = (name: keyof ShopFormDefaults, label: string, opts: { hint?: string; type?: string; full?: boolean; inputMode?: "tel" | "decimal" } = {}) => (
    <div className={`field ${opts.full ? styles.full : ""}`}>
      <label htmlFor={`f-${name}`}>
        {label} {opts.hint && <span className="hint">{opts.hint}</span>}
      </label>
      <input
        id={`f-${name}`}
        name={name}
        type={opts.type ?? "text"}
        inputMode={opts.inputMode}
        className="input"
        defaultValue={state.values?.[name] ?? (d[name] as string | null | undefined) ?? ""}
      />
    </div>
  );

  return (
    <form action={action} className={styles.card} noValidate>
      <div className={styles.formGrid}>
        {field("name", "Dükkân adı", { full: true })}
        {field("district", "Semt")}
        {field("phone", "Dükkân telefonu", { hint: "müşteriler görür", inputMode: "tel" })}
        {field("address", "Açık adres", { full: true })}
        {field("notifyPhone", "Bildirim numarası", { hint: "yeni randevular WhatsApp'tan buraya gelir", inputMode: "tel" })}
        {field("ownerName", "Dükkân sahibi", { hint: "isteğe bağlı" })}
        {field("ownerPhone", "Sahibin telefonu", { hint: "isteğe bağlı", inputMode: "tel" })}
        {field("monthlyFee", "Aylık ücret (₺)", { hint: "ücretsizse 0", inputMode: "decimal" })}
        {field("billingStart", "Abonelik başlangıcı", { type: "date" })}
        <div className={`field ${styles.full}`}>
          <label htmlFor="f-adminNotes">
            Notlar <span className="hint">sadece siz görürsünüz</span>
          </label>
          <textarea id="f-adminNotes" name="adminNotes" className={styles.textarea} defaultValue={state.values?.adminNotes ?? d.adminNotes ?? ""} />
        </div>
      </div>

      {props.mode === "edit" && (
        <label className={styles.checkRow}>
          <input
            type="checkbox"
            name="active"
            defaultChecked={state.values ? state.values.active === "on" : d.active}
          />
          Dükkân açık: müşteriler online randevu alabilir
        </label>
      )}

      <p className="form-error" role="alert">
        {state.error}
      </p>
      <div className={styles.formFoot}>
        <button type="submit" className="btn btn-primary" disabled={pending}>
          {pending ? "Kaydediliyor…" : props.mode === "create" ? "Dükkânı ekle" : "Kaydet"}
        </button>
        {state.ok && !pending && <span className={styles.okText}>{state.ok}</span>}
      </div>
    </form>
  );
}
