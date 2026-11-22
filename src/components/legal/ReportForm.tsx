"use client";

import { useActionState } from "react";
import { reportAction, type ReportState } from "@/server/reports/actions";

type Props = { reasons: [string, string][]; initialTarget?: string };

export function ReportForm({ reasons, initialTarget }: Props) {
  const [state, run, pending] = useActionState<ReportState, FormData>(reportAction, {});
  if (state.done) {
    return (
      <div className="notice" role="status">
        Bildiriminiz alındı. İnceleyip gerekirse içeriği kaldıracağız. İletişim bilginizi bıraktıysanız sonucu size bildiririz.
      </div>
    );
  }
  const v = state.values;
  return (
    <form action={run} noValidate>
      <div className="field">
        <label htmlFor="r-target">Hangi sayfa ya da içerik?</label>
        <input
          id="r-target"
          name="target"
          className="input"
          defaultValue={v?.target ?? initialTarget}
          placeholder="Örn. tirasvakti.com/erhankaya, ikinci fotoğraf"
          required
        />
      </div>
      <div className="field">
        <label htmlFor="r-reason">Neden bildiriyorsunuz?</label>
        <select id="r-reason" name="reason" className="input" defaultValue={v?.reason ?? ""} required>
          <option value="" disabled>
            Seçin
          </option>
          {reasons.map(([k, label]) => (
            <option key={k} value={k}>
              {label}
            </option>
          ))}
        </select>
      </div>
      <div className="field">
        <label htmlFor="r-details">Sorunu açıklayın</label>
        <textarea id="r-details" name="details" className="input" rows={5} defaultValue={v?.details} required />
      </div>
      <div className="field">
        <label htmlFor="r-contact">
          E-posta ya da telefon <span className="hint">İsteğe bağlı, sonucu bildirmemiz için</span>
        </label>
        <input id="r-contact" name="contact" className="input" defaultValue={v?.contact} autoComplete="email" />
      </div>
      {/* Bot tuzağı: görünmez, insanlar doldurmaz. */}
      <input name="website" tabIndex={-1} autoComplete="off" aria-hidden="true" style={{ position: "absolute", left: "-9999px", height: 0, opacity: 0 }} />
      <p className="form-error" role="alert">
        {state.error}
      </p>
      <button type="submit" className="btn btn-primary btn-block" disabled={pending}>
        {pending ? "Gönderiliyor…" : "Bildirimi gönder"}
      </button>
    </form>
  );
}
