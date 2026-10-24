"use client";

import { useMemo, useState } from "react";
import {
  applyRollback,
  leaseConfig,
  fmtDesk,
  FREQ_LABEL_FR,
  solveRollback,
  type DealCalc,
  type DealData,
  type DealerSettings,
  type Frequency,
  type Lender,
  type RollbackMode,
} from "@/lib/deal";
import { useT } from "@/lib/i18n";
import { NumField } from "./fields";

/**
 * Rollback: customer wants to pay X per month / bi-weekly / weekly →
 * how much down payment, rebate or discount is needed.
 */
export default function RollbackPanel({
  data,
  upd,
  calc,
  lenders,
  settings,
}: {
  data: DealData;
  upd: (fn: (d: DealData) => void) => void;
  calc: DealCalc;
  lenders: Lender[];
  settings: DealerSettings;
}) {
  const t = useT();
  const [idx, setIdx] = useState<0 | 1>(0);
  const [target, setTarget] = useState(0);
  const [freq, setFreq] = useState<Frequency>(data.options[0].frequency);
  const [mode, setMode] = useState<RollbackMode>("cash");

  const res = useMemo(
    () => solveRollback(data, lenders, idx, target, freq, mode, settings.excessKmCharge, leaseConfig(settings)),
    [data, lenders, idx, target, freq, mode, settings],
  );

  const modeLabel: Record<RollbackMode, string> = {
    cash: data.dealType === "lease" ? t("Comptant (sans taxes)") : t("Comptant (taxes incl.)"),
    rebate: t("Remise (R.A. sans taxes)"),
    discount: t("Réduction (rabais)"),
  };

  const already = res.feasible && res.delta <= 0;
  const current = calc.options[idx].totalPayment;

  return (
    <div className="mt-3 border border-[#a5a5a5] bg-[#f2f6f9]">
      <div className="sec-head">
        <div className="sec-tab !py-1 !text-sm">{t("Rollback — Paiement cible")}</div>
      </div>
      <div className="p-2 grid grid-cols-2 gap-x-2 gap-y-1.5 items-center">
        <span className="lbl text-[13px]">{t("Option")}</span>
        <select className="fld" value={idx} onChange={(e) => setIdx(Number(e.target.value) as 0 | 1)}>
          <option value={0}>OPT 1</option>
          <option value={1}>OPT 2</option>
        </select>

        <span className="lbl text-[13px]">{t("Paiement désiré (taxes incl.)")}</span>
        <NumField value={target} onChange={setTarget} blankZero className="!bg-[#fffbe0] font-semibold" />

        <span className="lbl text-[13px]">{t("Fréquence")}</span>
        <select className="fld" value={freq} onChange={(e) => setFreq(e.target.value as Frequency)}>
          {(Object.keys(FREQ_LABEL_FR) as Frequency[]).map((f) => (
            <option key={f} value={f}>{t(FREQ_LABEL_FR[f])}</option>
          ))}
        </select>

        <span className="lbl text-[13px]">{t("Calculer avec")}</span>
        <select className="fld !text-[12px]" value={mode} onChange={(e) => setMode(e.target.value as RollbackMode)}>
          {(Object.keys(modeLabel) as RollbackMode[]).map((m) => (
            <option key={m} value={m}>{modeLabel[m]}</option>
          ))}
        </select>
      </div>

      <div className="px-2 pb-2">
        <div className="text-[12px] text-[#1e3a50] mb-1">
          {t("Paiement actuel")} ({t(FREQ_LABEL_FR[data.options[idx].frequency])}) : <b>{fmtDesk(current)}</b>
          {freq !== data.options[idx].frequency && (
            <> · {t(FREQ_LABEL_FR[freq])} : <b>{fmtDesk(res.currentPayment)}</b></>
          )}
        </div>
        {!target ? (
          <div className="text-[12px] text-[#003a5d]">{t("Entrez le paiement désiré pour calculer le montant requis.")}</div>
        ) : !res.feasible ? (
          <div className="text-[12px] text-red-700">{t("Impossible de calculer — vérifiez le prêteur, le terme et le taux.")}</div>
        ) : already ? (
          <div className="text-[13px] text-green-800 font-semibold">
            ✓ {t("Le paiement est déjà sous la cible.")} {t("Marge")} : {fmtDesk(-res.delta)} {modeLabel[mode].toLowerCase()}
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-2 items-end">
            <div>
              <div className="lbl text-[11px]">{t("Montant additionnel requis")}</div>
              <div className="fld hl num flex items-center justify-end font-bold !text-[15px]">{fmtDesk(res.delta)}</div>
            </div>
            <div>
              <div className="lbl text-[11px]">{t("Total")} {modeLabel[mode].toLowerCase()}</div>
              <div className="fld ro num flex items-center justify-end font-semibold">{fmtDesk(res.newValue)}</div>
            </div>
          </div>
        )}
        <div className="flex items-center gap-2 mt-2">
          {target > 0 && (
            <span className="text-[12px] text-[#1e3a50]">
              {t("Nouveau paiement")} : <b>{fmtDesk(res.resultPayment)}</b>
            </span>
          )}
          <button
            className="btn btn-primary ml-auto"
            disabled={!target || !res.feasible || res.delta === 0}
            onClick={() => upd((d) => applyRollback(d, idx, mode, res.newValue, freq))}
          >
            {t("Appliquer au dossier")}
          </button>
        </div>
      </div>
    </div>
  );
}
