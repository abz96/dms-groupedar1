"use client";

import { useState } from "react";
import { DEFAULT_DEAL_TERMS, FREQ_LABEL_FR, type DealerSettings, type Frequency, type OptDefault } from "@/lib/deal";
import { useT } from "@/lib/i18n";

type Patch = Partial<Pick<DealerSettings, "dealTerms" | "optDefaults" | "defaultKmPerYear" | "defaultKmPerYear2">>;

/** Settings: terms offered (add / edit / remove) + OPT 1 / OPT 2 defaults for lease & finance. */
export default function TermsDefaultsEditor({ s, onChange }: { s: DealerSettings; onChange: (p: Patch) => void }) {
  const t = useT();
  const [newTerm, setNewTerm] = useState("");
  const terms = [...s.dealTerms].sort((a, b) => a - b);
  const kms = s.kmTiers.map((x) => x.km).sort((a, b) => a - b);

  const setTerms = (list: number[]) => onChange({ dealTerms: Array.from(new Set(list.filter((n) => n > 0))).sort((a, b) => a - b) });
  const setOpt = (type: "lease" | "finance", i: 0 | 1, patch: Partial<OptDefault>) => {
    const cur = s.optDefaults[type];
    const next = [...cur] as [OptDefault, OptDefault];
    next[i] = { ...next[i], ...patch };
    onChange({ optDefaults: { ...s.optDefaults, [type]: next } });
  };

  return (
    <div className="p-3 grid grid-cols-1 xl:grid-cols-[380px_minmax(0,1fr)] gap-4">
      {/* Terms */}
      <div>
        <div className="lbl font-semibold text-[13px] mb-1">{t("Termes offerts (mois)")}</div>
        <p className="text-xs text-[#003a5d] mb-2">{t("S'applique à la location et au financement pour tous les prêteurs. Le taux d'un terme absent de la grille du prêteur est interpolé.")}</p>
        <div className="flex flex-wrap gap-1.5">
          {terms.map((n, i) => (
            <span key={n} className="inline-flex items-center border border-[#9fb3c4] bg-white">
              <input
                className="w-12 h-7 text-center text-[13px] font-semibold outline-none"
                defaultValue={n}
                onBlur={(e) => {
                  const v = parseInt(e.target.value);
                  if (v > 0 && v !== n) setTerms(terms.map((x, j) => (j === i ? v : x)));
                  else e.target.value = String(n);
                }}
              />
              <button className="px-1.5 text-red-700 hover:bg-red-50 h-7" title={t("Retirer")} onClick={() => setTerms(terms.filter((x) => x !== n))}>✕</button>
            </span>
          ))}
        </div>
        <div className="flex items-center gap-2 mt-2">
          <input className="fld !w-24" placeholder={t("Terme")} value={newTerm} onChange={(e) => setNewTerm(e.target.value.replace(/\D/g, ""))} />
          <button
            className="btn"
            onClick={() => {
              const v = parseInt(newTerm);
              if (v > 0) setTerms([...terms, v]);
              setNewTerm("");
            }}
          >
            + {t("Terme")}
          </button>
          <button className="btn ml-auto" onClick={() => setTerms(DEFAULT_DEAL_TERMS)}>{t("Réinitialiser")}</button>
        </div>
      </div>

      {/* OPT defaults */}
      <div>
        <div className="lbl font-semibold text-[13px] mb-1">{t("Structure par défaut — OPT 1 / OPT 2")}</div>
        <p className="text-xs text-[#003a5d] mb-2">{t("Appliquée aux nouveaux dossiers et lorsque vous passez en Location ou en Financement.")}</p>
        <table className="grid-table w-full text-left">
          <thead>
            <tr>
              <th />
              <th>{t("Option")}</th>
              <th>{t("Terme (mois)")}</th>
              <th>{t("Fréquence")}</th>
              <th>{t("Km / année")}</th>
            </tr>
          </thead>
          <tbody>
            {(["lease", "finance"] as const).map((type) =>
              ([0, 1] as const).map((i) => {
                const o = s.optDefaults[type][i];
                const termList = terms.includes(o.term) ? terms : [...terms, o.term].sort((a, b) => a - b);
                return (
                  <tr key={`${type}${i}`}>
                    {i === 0 && (
                      <td rowSpan={2} className="font-semibold text-[#00263d] align-middle">
                        {type === "lease" ? t("Location") : t("Financement")}
                      </td>
                    )}
                    <td className="font-semibold">OPT {i + 1}</td>
                    <td>
                      <select className="fld !h-7" value={o.term} onChange={(e) => setOpt(type, i, { term: Number(e.target.value) })}>
                        {termList.map((n) => <option key={n} value={n}>{n}</option>)}
                      </select>
                    </td>
                    <td>
                      <select className="fld !h-7" value={o.frequency} onChange={(e) => setOpt(type, i, { frequency: e.target.value as Frequency })}>
                        {(Object.keys(FREQ_LABEL_FR) as Frequency[]).map((f) => <option key={f} value={f}>{t(FREQ_LABEL_FR[f])}</option>)}
                      </select>
                    </td>
                    <td>
                      {type === "lease" ? (
                        <select
                          className="fld !h-7"
                          value={i === 0 ? s.defaultKmPerYear : s.defaultKmPerYear2}
                          onChange={(e) => onChange(i === 0 ? { defaultKmPerYear: Number(e.target.value) } : { defaultKmPerYear2: Number(e.target.value) })}
                        >
                          {kms.map((k) => <option key={k} value={k}>{k.toLocaleString("en-CA")} km</option>)}
                        </select>
                      ) : (
                        <span className="text-[#93a8ba]">—</span>
                      )}
                    </td>
                  </tr>
                );
              }),
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
