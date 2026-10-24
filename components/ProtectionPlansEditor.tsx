"use client";

import { Fragment, useState } from "react";
import {
  DEFAULT_PLANS,
  DEFAULT_TERM_FACTORS,
  DEFAULT_VEHICLE_TIERS,
  fmtDesk,
  planPrice,
  type DealerSettings,
  type PlanCategory,
  type PlanSection,
  type ProtectionPlan,
  type VehicleTier,
} from "@/lib/deal";
import { useT } from "@/lib/i18n";
import { NumField } from "./fields";
import { CATEGORY_COLOR, CATEGORY_LABEL, SECTION_LABEL } from "./PlanPicker";

type Patch = Partial<Pick<DealerSettings, "protectionPlans" | "vehicleTiers" | "termFactors" | "planMargin">>;

const newId = () => "plan" + Math.random().toString(36).slice(2, 8);

export default function ProtectionPlansEditor({ s, onChange }: { s: DealerSettings; onChange: (p: Patch) => void }) {
  const t = useT();
  const plans = s.protectionPlans;
  const tiers = [...s.vehicleTiers].sort((a, b) => a.min - b.min);
  const years = Object.keys(s.termFactors).map(Number).sort((a, b) => a - b);
  const [previewPrice, setPreviewPrice] = useState(45000);
  const [previewYears, setPreviewYears] = useState(1);
  const [openDesc, setOpenDesc] = useState<string | null>(null);
  const fMin = Math.min(...tiers.map((x) => x.factor));
  const fMax = Math.max(...tiers.map((x) => x.factor));

  const setPlan = (i: number, patch: Partial<ProtectionPlan>) => onChange({ protectionPlans: plans.map((p, j) => (j === i ? { ...p, ...patch } : p)) });
  const move = (i: number, dir: -1 | 1) => {
    const j = i + dir;
    if (j < 0 || j >= plans.length) return;
    const next = [...plans];
    [next[i], next[j]] = [next[j], next[i]];
    onChange({ protectionPlans: next });
  };
  const setTier = (key: string, patch: Partial<VehicleTier>) => onChange({ vehicleTiers: s.vehicleTiers.map((x) => (x.key === key ? { ...x, ...patch } : x)) });

  const ex = planPrice({ id: "ex", name: "", code: "", category: "mechanical", baseWholesale: 1000, scales: true, active: true, section: "warranty" }, previewYears, previewPrice, s);

  return (
    <div className="p-3 space-y-4">
      {/* ---------- catalogue ---------- */}
      <div>
        <div className="flex flex-wrap items-end gap-3 mb-2">
          <div className="lbl font-semibold text-[13px]">{t("Catalogue des plans de protection")}</div>
          <div className="ml-auto flex items-end gap-2 text-[12px]">
            <span className="lbl">{t("Aperçu — prix du véhicule")}</span>
            <div className="w-28"><NumField value={previewPrice} onChange={setPreviewPrice} /></div>
            <select className="fld !w-24 !h-7" value={previewYears} onChange={(e) => setPreviewYears(Number(e.target.value))}>
              {years.map((y) => <option key={y} value={y}>{y} {y > 1 ? t("ans") : t("an")}</option>)}
            </select>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="grid-table w-full text-left min-w-[1100px]">
            <thead>
              <tr>
                <th className="w-[70px]">{t("Ordre")}</th>
                <th>{t("Nom du plan & code")}</th>
                <th className="w-[160px]">{t("Catégorie")}</th>
                <th className="w-[170px]">{t("Section du dossier")}</th>
                <th className="w-[110px]">{t("Coût de base")}</th>
                <th className="w-[130px]">{t("Échelle par palier")}</th>
                <th className="w-[110px] text-right">{t("Prix client (aperçu)")}</th>
                <th className="w-[90px]">{t("Statut")}</th>
                <th className="w-[40px]" />
              </tr>
            </thead>
            <tbody>
              {plans.map((p, i) => {
                const q = planPrice(p, previewYears, previewPrice, s);
                return (
                  <Fragment key={p.id}>
                  <tr className={p.active ? "" : "opacity-50"}>
                    <td>
                      <div className="flex items-center gap-1">
                        <span className="font-semibold text-[#00263d]">#{i + 1}</span>
                        <button className="text-[11px] px-1 hover:text-[#0071bc]" title="↑" onClick={() => move(i, -1)}>▲</button>
                        <button className="text-[11px] px-1 hover:text-[#0071bc]" title="↓" onClick={() => move(i, 1)}>▼</button>
                      </div>
                    </td>
                    <td>
                      <input className="fld !h-7 font-semibold" value={p.name} onChange={(e) => setPlan(i, { name: e.target.value })} />
                      <input className="fld !h-6 !text-[11px] font-mono mt-0.5" value={p.code} onChange={(e) => setPlan(i, { code: e.target.value.toUpperCase().replace(/\s/g, "-") })} />
                      <button className="text-[11px] text-[#0071bc] hover:underline mt-0.5" onClick={() => setOpenDesc((o) => (o === p.id ? null : p.id))}>
                        {openDesc === p.id ? "▾" : "▸"} {t("Description")}{p.description ? "" : ` (${t("vide")})`}
                      </button>
                    </td>
                    <td>
                      <select className="fld !h-7" style={{ color: CATEGORY_COLOR[p.category] }} value={p.category} onChange={(e) => setPlan(i, { category: e.target.value as PlanCategory })}>
                        {Object.entries(CATEGORY_LABEL).map(([k, v]) => <option key={k} value={k}>{t(v)}</option>)}
                      </select>
                    </td>
                    <td>
                      <select className="fld !h-7" value={p.section} onChange={(e) => setPlan(i, { section: e.target.value as PlanSection })}>
                        {(Object.keys(SECTION_LABEL) as PlanSection[]).map((k) => <option key={k} value={k}>{t(SECTION_LABEL[k])}</option>)}
                      </select>
                    </td>
                    <td><NumField value={p.baseWholesale} onChange={(n) => setPlan(i, { baseWholesale: n })} className="!bg-[#fffbe0]" /></td>
                    <td className="text-[12px]">
                      <label className="flex items-center gap-1">
                        <input type="checkbox" checked={p.scales} onChange={(e) => setPlan(i, { scales: e.target.checked })} />
                        {p.scales ? `${t("Oui")} (${fMin}×–${fMax}×)` : t("Non")}
                      </label>
                    </td>
                    <td className="text-right tabular-nums font-semibold text-[#005a96]">{fmtDesk(q.retail)} $</td>
                    <td>
                      <label className="flex items-center gap-1 text-[12px]">
                        <input type="checkbox" checked={p.active} onChange={(e) => setPlan(i, { active: e.target.checked })} />
                        {p.active ? t("Actif") : t("Inactif")}
                      </label>
                    </td>
                    <td>
                      <button className="dots" title={t("Retirer")} onClick={() => confirm(t("Supprimer ce plan ?")) && onChange({ protectionPlans: plans.filter((_, j) => j !== i) })}>✕</button>
                    </td>
                  </tr>
                  {openDesc === p.id && (
                    <tr className="bg-[#f4f8fb]">
                      <td />
                      <td colSpan={8} className="py-2">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                          <label>
                            <span className="lbl text-[11px]">{t("Description (français)")}</span>
                            <textarea className="fld !h-20 py-1 !tracking-normal" value={p.description ?? ""} onChange={(e) => setPlan(i, { description: e.target.value })} />
                          </label>
                          <label>
                            <span className="lbl text-[11px]">{t("Description (anglais)")}</span>
                            <textarea className="fld !h-20 py-1 !tracking-normal" value={p.descriptionEn ?? ""} onChange={(e) => setPlan(i, { descriptionEn: e.target.value })} />
                          </label>
                        </div>
                      </td>
                    </tr>
                  )}
                  </Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
        <div className="flex gap-2 mt-2">
          <button
            className="btn btn-primary"
            onClick={() =>
              onChange({
                protectionPlans: [...plans, { id: newId(), name: t("Nouveau plan"), code: "NEW-PLAN", category: "mechanical", baseWholesale: 500, scales: true, active: true, section: "warranty" }],
              })
            }
          >
            + {t("Ajouter un plan")}
          </button>
          <button className="btn ml-auto" onClick={() => confirm(t("Réinitialiser le catalogue ?")) && onChange({ protectionPlans: DEFAULT_PLANS })}>{t("Réinitialiser")}</button>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
        {/* ---------- 1 · vehicle tiers ---------- */}
        <div>
          <div className="lbl font-semibold text-[13px]">1 · {t("Ajustement selon la valeur du véhicule")}</div>
          <p className="text-xs text-[#003a5d] mb-2">{t("Multiplicateur du coût de gros selon le prix de vente du véhicule. Appliqué avant la marge du concessionnaire.")}</p>
          <table className="grid-table w-full text-left">
            <thead>
              <tr>
                <th className="w-[50px]">{t("Clé")}</th>
                <th>{t("Libellé")}</th>
                <th className="w-[105px]">{t("Prix min. ($)")}</th>
                <th className="w-[105px]">{t("Prix max. ($)")}</th>
                <th className="w-[85px]">{t("Facteur (×)")}</th>
                <th className="w-[40px]" />
              </tr>
            </thead>
            <tbody>
              {tiers.map((x) => (
                <tr key={x.key}>
                  <td className="font-mono font-semibold">{x.key}</td>
                  <td><input className="fld !h-7" value={x.label} onChange={(e) => setTier(x.key, { label: e.target.value })} /></td>
                  <td><NumField value={x.min} decimals={0} onChange={(n) => setTier(x.key, { min: n })} /></td>
                  <td>
                    {x.max === null ? (
                      <button className="fld !h-7 text-left text-[#5a7086]" onClick={() => setTier(x.key, { max: x.min + 20000 })} title={t("Cliquer pour fixer un maximum")}>{t("Illimité")}</button>
                    ) : (
                      <div className="flex gap-1">
                        <NumField value={x.max} decimals={0} onChange={(n) => setTier(x.key, { max: n })} />
                        <button className="text-[10px] text-[#5a7086]" title={t("Illimité")} onClick={() => setTier(x.key, { max: null })}>∞</button>
                      </div>
                    )}
                  </td>
                  <td><NumField value={x.factor} onChange={(n) => setTier(x.key, { factor: n })} className="!bg-[#fffbe0]" /></td>
                  <td><button className="dots" title={t("Retirer")} onClick={() => onChange({ vehicleTiers: s.vehicleTiers.filter((y) => y.key !== x.key) })}>✕</button></td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="flex gap-2 mt-2">
            <button
              className="btn"
              onClick={() => {
                const last = tiers[tiers.length - 1];
                const n = tiers.length + 1;
                const min = last ? (last.max ?? last.min + 20000) : 0;
                onChange({
                  vehicleTiers: [
                    ...s.vehicleTiers.map((x) => (last && x.key === last.key && x.max === null ? { ...x, max: min } : x)),
                    { key: `T${n}`, label: `${t("Plus de")} $${min.toLocaleString("en-CA")}`, min, max: null, factor: (last?.factor ?? 1) + 0.1 },
                  ],
                });
              }}
            >
              + {t("Ajouter un palier")}
            </button>
            <button className="btn ml-auto" onClick={() => onChange({ vehicleTiers: DEFAULT_VEHICLE_TIERS })}>{t("Réinitialiser")}</button>
          </div>
        </div>

        {/* ---------- 2 · term factors ---------- */}
        <div>
          <div className="lbl font-semibold text-[13px]">2 · {t("Ajustement selon le terme du plan (1 à 6 ans)")}</div>
          <p className="text-xs text-[#003a5d] mb-2">{t("Multiplicateurs selon la durée de couverture, par rapport à la base standard 1,00×.")}</p>
          <table className="grid-table w-full text-left">
            <thead>
              <tr>
                <th>{t("Terme")}</th>
                <th>{t("Mois")}</th>
                <th className="w-[110px]">{t("Facteur (×)")}</th>
                <th>{t("vs base 1,00×")}</th>
              </tr>
            </thead>
            <tbody>
              {years.map((y) => {
                const f = Number(s.termFactors[String(y)]) || 0;
                const diff = Math.round((f - 1) * 100);
                return (
                  <tr key={y}>
                    <td className="font-semibold">{y} {y > 1 ? t("ans") : t("an")}</td>
                    <td>{y * 12}</td>
                    <td><NumField value={f} onChange={(n) => onChange({ termFactors: { ...s.termFactors, [String(y)]: n } })} className="!bg-[#fffbe0]" /></td>
                    <td className={diff === 0 ? "text-[#5a7086]" : diff < 0 ? "text-green-800" : "text-red-700"}>
                      {diff === 0 ? t("Base (1,00×)") : `${diff > 0 ? "+" : ""}${diff} %`}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          <div className="flex mt-2">
            <button className="btn ml-auto" onClick={() => onChange({ termFactors: DEFAULT_TERM_FACTORS })}>{t("Réinitialiser")}</button>
          </div>
        </div>
      </div>

      {/* ---------- 3 · margin + sequence ---------- */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
        <div>
          <div className="lbl font-semibold text-[13px]">3 · {t("Politique de marge du concessionnaire")}</div>
          <p className="text-xs text-[#003a5d] mb-2">{t("Marge cible appliquée à tous les plans de protection.")}</p>
          <div className="flex items-center gap-2">
            <span className="lbl">{t("Marge cible (%)")}</span>
            <div className="w-28"><NumField value={s.planMargin} onChange={(n) => onChange({ planMargin: Math.min(95, Math.max(0, n)) })} suffix=" %" className="!bg-[#fffbe0] font-semibold" /></div>
            <span className="text-[12px] text-[#5a7086]">{t("du prix de détail")}</span>
          </div>
          <p className="text-[11px] text-[#5a7086] mt-2">
            {t("Standard : 40 %. Le prix de détail est calculé pour que le profit brut soit exactement ce pourcentage du prix présenté au client.")}
          </p>
        </div>
        <div className="border border-[#9fb3c4] bg-white p-2">
          <div className="lbl font-semibold text-[13px] mb-1">{t("Séquence officielle du calcul de prix")}</div>
          <ol className="text-[12px] text-[#1e3a50] space-y-0.5 list-decimal pl-5">
            <li>{t("Coût de gros de base : selon le catalogue")} — <b>1 000,00 $</b></li>
            <li>{t("Ajustement valeur du véhicule")} ({fmtDesk(previewPrice)} $ → {ex.tier?.key}) : <b>× {ex.vehicleFactor}</b></li>
            <li>{t("Ajustement du terme")} ({previewYears} {previewYears > 1 ? t("ans") : t("an")}) : <b>× {ex.termFactor}</b></li>
            <li>{t("Coût de gros estimé")} = <b>{fmtDesk(ex.wholesale)} $</b></li>
            <li>{t("Prix client")} = {fmtDesk(ex.wholesale)} ÷ (1 − {s.planMargin / 100}) = <b className="text-[#005a96]">{fmtDesk(ex.retail)} $</b></li>
            <li>{t("Profit brut du concessionnaire")} = <b className="text-green-800">{fmtDesk(ex.gross)} $</b> ({s.planMargin} %)</li>
          </ol>
        </div>
      </div>
    </div>
  );
}
