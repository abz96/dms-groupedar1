"use client";

import { useState } from "react";
import { fmtDesk, planPrice, type DealerSettings, type PlanSection, type ProtectionPlan } from "@/lib/deal";
import { useT } from "@/lib/i18n";

export const CATEGORY_LABEL: Record<string, string> = {
  cosmetic: "Cosmétique",
  mechanical: "Mécanique & sécurité",
  antitheft: "Antivol",
  financial: "Financier",
};
export const CATEGORY_COLOR: Record<string, string> = {
  cosmetic: "#8e44ad",
  mechanical: "#0071bc",
  antitheft: "#c0392b",
  financial: "#2e9a57",
};
export const SECTION_LABEL: Record<PlanSection, string> = {
  warranty: "Garantie prolongée",
  tireRim: "Protection pneus & jantes",
  accessory: "Accessoires",
  fi: "Autres produits F&A",
};

/** Protection plans for given deal sections — pick a term (1–6 yrs), price = catalogue formula. */
export default function PlanPicker({
  sections,
  vehiclePrice,
  settings,
  onAdd,
  selectedCode,
}: {
  sections: PlanSection[];
  vehiclePrice: number;
  settings: DealerSettings;
  onAdd: (plan: ProtectionPlan, years: number, price: number) => void;
  /** @deprecated kept for compatibility */
  actionLabel?: string;
  selectedCode?: string;
}) {
  const t = useT();
  const plans = (settings.protectionPlans ?? []).filter((p) => p.active && sections.includes(p.section));
  const years = Object.keys(settings.termFactors ?? {}).map(Number).filter((n) => n > 0).sort((a, b) => a - b);
  const defaultYear = years.includes(1) ? 1 : (years[0] ?? 1);
  const [term, setTerm] = useState<Record<string, number>>({});
  const [flash, setFlash] = useState<string | null>(null);
  if (!plans.length) return null;

  const add = (p: ProtectionPlan, y: number, price: number) => {
    onAdd(p, y, price);
    setFlash(p.id);
    setTimeout(() => setFlash((f) => (f === p.id ? null : f)), 1600);
  };

  return (
    <div className="border border-[#9fb3c4] bg-white">
      <div className="px-2 py-1 bg-[#e6f1fa] border-b border-[#9fb3c4] text-[12px] font-semibold text-[#003a5d] flex items-center">
        {t("Plans de protection")} <span className="ml-2 font-normal text-[#5a7086]">— {t("cliquez sur une ligne ou un prix pour l'ajouter")}</span>
        <span className="ml-auto font-normal text-[#5a7086]">{t("Prix du véhicule")} : {fmtDesk(vehiclePrice)} $</span>
      </div>
      {vehiclePrice <= 0 && (
        <div className="px-2 py-1 text-[11px] text-amber-800 bg-amber-50 border-b border-amber-200">
          {t("Aucun prix de véhicule sur le dossier — le premier palier de prix est utilisé.")}
        </div>
      )}
      <table className="w-full text-[12px]">
        <tbody>
          {plans.map((p) => {
            const y = term[p.id] ?? defaultYear;
            const q = planPrice(p, y, vehiclePrice, settings);
            const sel = selectedCode === p.code;
            const added = flash === p.id;
            return (
              <tr
                key={p.id}
                role="button"
                tabIndex={0}
                title={t("Cliquer pour ajouter au dossier")}
                onClick={() => add(p, y, q.retail)}
                onKeyDown={(e) => {
                  if (e.key === " ") {
                    e.preventDefault();
                    add(p, y, q.retail);
                  }
                }}
                className={`border-b border-[#e1e9f0] cursor-pointer select-none transition-colors ${
                  added ? "bg-emerald-50" : sel ? "bg-[#d4e8f7]" : "hover:bg-[#eaf3fb]"
                }`}
              >
                <td className="px-2 py-1.5">
                  <div className="font-semibold text-[#00263d]">{p.name}</div>
                  <div className="text-[10px] text-[#5a7086]">
                    <span className="font-mono">{p.code}</span> ·{" "}
                    <span style={{ color: CATEGORY_COLOR[p.category] }}>{t(CATEGORY_LABEL[p.category] ?? p.category)}</span>
                  </div>
                </td>
                <td className="px-1 w-[100px]" onClick={(e) => e.stopPropagation()}>
                  <select className="fld !h-7" value={y} onChange={(e) => setTerm((m) => ({ ...m, [p.id]: Number(e.target.value) }))}>
                    {years.map((n) => <option key={n} value={n}>{n} {n > 1 ? t("ans") : t("an")}</option>)}
                  </select>
                </td>
                <td className="px-1 w-[150px] text-right">
                  <span
                    className={`inline-flex items-center justify-end gap-1 min-w-[132px] px-2 py-1 rounded-sm border font-bold tabular-nums ${
                      added
                        ? "bg-emerald-600 border-emerald-700 text-white"
                        : sel
                          ? "bg-[#0071bc] border-[#005a96] text-white"
                          : "bg-white border-[#9fb3c4] text-[#005a96] hover:bg-[#0071bc] hover:text-white hover:border-[#005a96]"
                    }`}
                  >
                    {added ? `✓ ${t("Ajouté")}` : sel ? `✓ ${fmtDesk(q.retail)} $` : `+ ${fmtDesk(q.retail)} $`}
                  </span>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
