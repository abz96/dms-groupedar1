"use client";

import { useEffect } from "react";
import Link from "next/link";
import { fmtDesk, type DealData, type DealerSettings, type Incentive } from "@/lib/deal";
import { useT } from "@/lib/i18n";

/** Recompute pricing.rmNonTax from applied cash incentives (keeps any manual amount). */
export function syncRm(d: DealData, prevCashSum: number) {
  const sum = d.incentivesApplied.filter((x) => x.kind === "cash").reduce((a, x) => a + x.amount, 0);
  const manual = Math.max(0, Math.round((d.pricing.rmNonTax - prevCashSum) * 100) / 100);
  d.pricing.rmNonTax = Math.round((manual + sum) * 100) / 100;
}

export default function IncentivesModal({
  data,
  upd,
  settings,
  onClose,
}: {
  data: DealData;
  upd: (fn: (d: DealData) => void) => void;
  settings: DealerSettings;
  onClose: () => void;
}) {
  const t = useT();
  useEffect(() => {
    const k = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", k);
    return () => window.removeEventListener("keydown", k);
  }, [onClose]);

  const programs = (settings.incentives ?? []).filter((x) => x.active && (!x.dealType || x.dealType === data.dealType));
  const applied = new Set(data.incentivesApplied.map((x) => x.id));
  const cashSum = (d: DealData) => d.incentivesApplied.filter((x) => x.kind === "cash").reduce((a, x) => a + x.amount, 0);

  function toggle(p: Incentive) {
    upd((d) => {
      const prev = cashSum(d);
      // rate incentives REDUCE the standard rate by p.rate points (e.g. 7.99 % − 1.00 = 6.99 %)
      const restoreRate = () => {
        const cur = d.incentivesApplied.find((x) => x.kind === "rate");
        if (cur) d.options.forEach((o) => (o.rate = Math.round((o.rate + cur.rate) * 100) / 100));
        d.incentivesApplied = d.incentivesApplied.filter((x) => x.kind !== "rate");
      };
      if (d.incentivesApplied.some((x) => x.id === p.id)) {
        if (p.kind === "rate") restoreRate();
        else d.incentivesApplied = d.incentivesApplied.filter((x) => x.id !== p.id);
      } else {
        if (p.kind === "rate") {
          restoreRate(); // only one rate incentive at a time
          d.options.forEach((o) => (o.rate = Math.round(Math.max(0, o.rate - p.rate) * 100) / 100));
        }
        d.incentivesApplied.push({ id: p.id, name: p.name, kind: p.kind, amount: p.amount, rate: p.rate });
      }
      syncRm(d, prev);
    });
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/40 flex items-start justify-center pt-16 px-4" onClick={onClose}>
      <div className="win w-full max-w-[720px]" onClick={(e) => e.stopPropagation()}>
        <div className="win-title flex items-center h-9 px-3">
          <span>{t("Rabais manufacturiers / Taux réduits")}</span>
          <button className="ml-auto text-white/80 hover:text-white" onClick={onClose}>✕</button>
        </div>
        <div className="p-3">
          {programs.length === 0 ? (
            <div className="text-[13px] text-[#003a5d] py-4 text-center">
              {t("Aucun programme actif pour ce type de dossier.")}{" "}
              <Link href="/settings" className="underline text-[#0071bc]">{t("Ajouter dans les Paramètres")}</Link>
            </div>
          ) : (
            <table className="grid-table w-full text-left">
              <thead>
                <tr>
                  <th className="w-[40px]" />
                  <th>{t("Programme")}</th>
                  <th>{t("Type")}</th>
                  <th className="text-right">{t("Montant / Taux")}</th>
                  <th>{t("Termes (mois)")}</th>
                </tr>
              </thead>
              <tbody>
                {programs.map((p) => (
                  <tr key={p.id} className="cursor-pointer hover:bg-white" onClick={() => toggle(p)}>
                    <td className="text-center"><input type="checkbox" readOnly checked={applied.has(p.id)} /></td>
                    <td>
                      <div className="font-semibold">{p.name}</div>
                      {p.notes && <div className="text-[11px] text-[#5a7086]">{p.notes}</div>}
                    </td>
                    <td>{p.kind === "cash" ? t("Rabais ($)") : t("Réduction de taux (%)")}</td>
                    <td className="text-right tabular-nums font-semibold">{p.kind === "cash" ? fmtDesk(p.amount) : `− ${p.rate.toFixed(2)} %`}</td>
                    <td>{p.terms || "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
          <div className="flex items-center gap-3 mt-3 text-[13px] text-[#1e3a50]">
            <span>
              {t("Total R.M. (Non Tax.)")} : <b className="tabular-nums">{fmtDesk(data.pricing.rmNonTax)}</b>
            </span>
            {data.incentivesApplied.some((x) => x.kind === "rate") && (
              <span>
                · {t("Réduction de taux appliquée")} : <b>− {data.incentivesApplied.find((x) => x.kind === "rate")!.rate.toFixed(2)} %</b> → {t("Taux")} : <b>{data.options[0].rate.toFixed(2)} %</b>
              </span>
            )}
            <button className="btn btn-primary ml-auto" onClick={onClose}>OK</button>
          </div>
        </div>
      </div>
    </div>
  );
}
