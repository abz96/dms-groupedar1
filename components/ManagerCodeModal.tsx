"use client";

import { useEffect, useRef, useState } from "react";
import { fmtDesk } from "@/lib/deal";
import { useT } from "@/lib/i18n";

/** Manager approval for a discount above the allowed limit. */
export default function ManagerCodeModal({
  amount,
  pct,
  maxPct,
  onApproved,
  onCancel,
}: {
  amount: number;
  pct: number;
  maxPct: number;
  onApproved: () => void;
  onCancel: () => void;
}) {
  const t = useT();
  const [code, setCode] = useState("");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const ref = useRef<HTMLInputElement>(null);
  useEffect(() => {
    ref.current?.focus();
    const k = (e: KeyboardEvent) => e.key === "Escape" && onCancel();
    window.addEventListener("keydown", k);
    return () => window.removeEventListener("keydown", k);
  }, [onCancel]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setErr("");
    const r = await fetch("/api/manager-code", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ code }) });
    setBusy(false);
    if (r.ok) onApproved();
    else {
      setErr(t("Code invalide."));
      setCode("");
      ref.current?.focus();
    }
  }

  return (
    <div className="fixed inset-0 z-[60] bg-black/50 flex items-start justify-center pt-24 px-4" onClick={onCancel}>
      <form data-enter-submit onSubmit={submit} className="win w-full max-w-[420px]" onClick={(e) => e.stopPropagation()}>
        <div className="win-title h-9 px-3 flex items-center">{t("Approbation du gestionnaire requise")}</div>
        <div className="p-4 space-y-3">
          <div className="border-l-4 border-amber-500 bg-amber-50 px-3 py-2 text-[13px] text-amber-900">
            {t("Le rabais demandé dépasse la limite de")} <b>{maxPct} %</b>.
            <div className="mt-1">
              {t("Rabais")} : <b>{fmtDesk(amount)} $</b> ({pct.toFixed(2)} %)
            </div>
          </div>
          <label className="block">
            <span className="lbl text-[12px]">{t("Code du gestionnaire")}</span>
            <input
              ref={ref}
              className="fld !h-10 font-mono text-center !text-[18px] !tracking-[0.4em]"
              type="password"
              inputMode="numeric"
              autoComplete="off"
              value={code}
              onChange={(e) => setCode(e.target.value)}
            />
          </label>
          {err && <div className="text-[13px] text-red-700 font-semibold">{err}</div>}
          <div className="flex gap-2">
            <button className="btn btn-primary flex-1 !py-2" disabled={busy || !code}>{busy ? t("Vérification…") : t("Approuver le rabais")}</button>
            <button type="button" className="btn !py-2" onClick={onCancel}>{t("Annuler")}</button>
          </div>
          <div className="text-[11px] text-[#5a7086]">{t("Si vous annulez, le rabais précédent est conservé.")}</div>
        </div>
      </form>
    </div>
  );
}
