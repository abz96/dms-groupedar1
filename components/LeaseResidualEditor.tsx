"use client";

import { useState } from "react";
import {
  DEFAULT_BASE_KM,
  DEFAULT_KM_TIERS,
  DEFAULT_RESIDUAL_TERMS,
  fmtDesk,
  kmMonthlyAdjustment,
  type KmTier,
  type ResidualTerms,
} from "@/lib/deal";
import { useT } from "@/lib/i18n";
import { NumField } from "./fields";

export default function LeaseResidualEditor({
  residualTerms,
  kmTiers,
  baseKm,
  onChange,
}: {
  residualTerms: ResidualTerms;
  kmTiers: KmTier[];
  baseKm: number;
  onChange: (patch: { residualTerms?: ResidualTerms; kmTiers?: KmTier[]; baseKm?: number }) => void;
}) {
  const t = useT();
  const [newTerm, setNewTerm] = useState("");
  const [newKm, setNewKm] = useState("");
  const [shift, setShift] = useState(0);
  const terms = Object.keys(residualTerms).map(Number).sort((a, b) => a - b);
  const tiers = [...kmTiers].sort((a, b) => a.km - b.km);

  const addTerm = () => {
    const n = parseInt(newTerm);
    if (!(n > 0) || residualTerms[String(n)] !== undefined) return;
    const near = terms.length ? terms.reduce((a, b) => (Math.abs(b - n) < Math.abs(a - n) ? b : a)) : null;
    onChange({ residualTerms: { ...residualTerms, [String(n)]: near !== null ? residualTerms[String(near)] : 50 } });
    setNewTerm("");
  };
  const removeTerm = (n: number) => {
    const r = { ...residualTerms };
    delete r[String(n)];
    onChange({ residualTerms: r });
  };
  const applyShift = () => {
    if (!shift) return;
    const r: ResidualTerms = {};
    for (const k of terms) r[String(k)] = Math.round(((residualTerms[String(k)] ?? 0) + shift) * 100) / 100;
    onChange({ residualTerms: r });
    setShift(0);
  };

  const setStep = (km: number, step: number) => onChange({ kmTiers: kmTiers.map((x) => (x.km === km ? { ...x, step } : x)) });
  const addKm = () => {
    const k = parseInt(newKm.replace(/\D/g, ""));
    if (!(k > 0) || kmTiers.some((x) => x.km === k)) return;
    onChange({ kmTiers: [...kmTiers, { km: k, step: k > baseKm ? 10 : -10 }] });
    setNewKm("");
  };
  const removeKm = (k: number) => {
    if (k === baseKm) return;
    onChange({ kmTiers: kmTiers.filter((x) => x.km !== k) });
  };
  const setBase = (k: number) => onChange({ baseKm: k, kmTiers: kmTiers.map((x) => (x.km === k ? { ...x, step: 0 } : x)) });

  return (
    <div className="p-3 grid grid-cols-1 xl:grid-cols-2 gap-4">
      {/* Residual by term */}
      <div>
        <div className="lbl font-semibold text-[13px] mb-1">{t("Résiduel par terme")}</div>
        <p className="text-xs text-[#003a5d] mb-2">{t("Le résiduel dépend seulement du terme. Il s'applique automatiquement à chaque location (sauf résiduel saisi manuellement).")}</p>
        <table className="grid-table text-left w-full max-w-[420px]">
          <thead>
            <tr>
              <th>{t("Terme (mois)")}</th>
              <th className="w-[140px]">{t("Résiduel %")}</th>
              <th className="w-[40px]" />
            </tr>
          </thead>
          <tbody>
            {terms.map((n) => (
              <tr key={n}>
                <td className="font-semibold text-[#1e3a50]">{n} {t("mois")}</td>
                <td>
                  <NumField value={residualTerms[String(n)] ?? 0} onChange={(v) => onChange({ residualTerms: { ...residualTerms, [String(n)]: v } })} suffix=" %" className="!bg-[#fffbe0]" />
                </td>
                <td><button className="dots" title={t("Retirer le terme")} onClick={() => removeTerm(n)}>✕</button></td>
              </tr>
            ))}
          </tbody>
        </table>
        <div className="flex flex-wrap items-center gap-2 mt-2">
          <input className="fld !w-24" placeholder={t("Terme")} value={newTerm} onChange={(e) => setNewTerm(e.target.value)} />
          <button className="btn" onClick={addTerm}>+ {t("Terme")}</button>
          <span className="lbl ml-2">{t("Ajuster tout")}</span>
          <div className="w-24"><NumField value={shift} onChange={setShift} suffix=" %" /></div>
          <button className="btn" onClick={applyShift}>{t("Appliquer ±")}</button>
          <button className="btn" onClick={() => confirm(t("Réinitialiser les résiduels ?")) && onChange({ residualTerms: DEFAULT_RESIDUAL_TERMS })}>
            {t("Réinitialiser")}
          </button>
        </div>
      </div>

      {/* Km tiers */}
      <div>
        <div className="lbl font-semibold text-[13px] mb-1">{t("Kilométrage — frais supplémentaires")}</div>
        <p className="text-xs text-[#003a5d] mb-2">
          {t("Le paiement de base (résiduel réel) correspond au kilométrage de base. Chaque palier ajoute ou retire un montant mensuel par rapport au palier voisin; le montant est converti automatiquement aux 2 semaines ou à la semaine.")}
        </p>
        <div className="overflow-x-auto">
          <table className="grid-table text-left w-full">
            <thead>
              <tr>
                <th>{t("Km / année")}</th>
                <th className="w-[60px] text-center">{t("Base")}</th>
                <th className="w-[120px]">{t("$ / mois vs palier voisin")}</th>
                <th className="text-right">{t("Mensuel")}</th>
                <th className="text-right">{t("Aux 2 sem.")}</th>
                <th className="text-right">{t("Hebdo")}</th>
                <th className="w-[40px]" />
              </tr>
            </thead>
            <tbody>
              {tiers.map((x) => {
                const m = kmMonthlyAdjustment(kmTiers, baseKm, x.km);
                const isBase = x.km === baseKm;
                const sign = (v: number) => (v > 0 ? "+" : "") + fmtDesk(v);
                return (
                  <tr key={x.km} className={isBase ? "bg-[#e7f5ea]" : ""}>
                    <td className="font-semibold text-[#1e3a50]">{x.km.toLocaleString("en-CA")} km</td>
                    <td className="text-center">
                      <input type="radio" name="baseKm" checked={isBase} onChange={() => setBase(x.km)} title={t("Kilométrage de base (résiduel réel)")} />
                    </td>
                    <td>
                      {isBase ? (
                        <span className="text-[12px] text-green-800 font-semibold">{t("Résiduel réel")}</span>
                      ) : (
                        <NumField value={x.step} onChange={(v) => setStep(x.km, v)} className="!bg-[#fffbe0]" />
                      )}
                    </td>
                    <td className="text-right tabular-nums font-semibold">{sign(m)}</td>
                    <td className="text-right tabular-nums">{sign(Math.round(((m * 12) / 26) * 100) / 100)}</td>
                    <td className="text-right tabular-nums">{sign(Math.round(((m * 12) / 52) * 100) / 100)}</td>
                    <td>{!isBase && <button className="dots" title={t("Retirer")} onClick={() => removeKm(x.km)}>✕</button>}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <div className="flex flex-wrap items-center gap-2 mt-2">
          <input className="fld !w-28" placeholder={t("Km/an")} value={newKm} onChange={(e) => setNewKm(e.target.value)} />
          <button className="btn" onClick={addKm}>+ {t("Kilométrage")}</button>
          <button
            className="btn ml-auto"
            onClick={() => confirm(t("Réinitialiser les paliers de kilométrage ?")) && onChange({ kmTiers: DEFAULT_KM_TIERS, baseKm: DEFAULT_BASE_KM })}
          >
            {t("Réinitialiser")}
          </button>
        </div>
        <p className="text-[11px] text-[#5a7086] mt-2">
          {t("Exemple : 12 000 km = −20 $/mois vs 16 000 · 20 000 km = +15 $/mois vs 16 000 · 24 000 km = +10 $/mois vs 20 000.")}
        </p>
      </div>
    </div>
  );
}
