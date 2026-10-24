"use client";

import {
  DEFAULT_TIRE_RIM,
  DEFAULT_WARRANTY_DIVISORS,
  fmtDesk,
  tireRimOptions,
  warrantyOptions,
  type TireRimFormula,
} from "@/lib/deal";
import { useT } from "@/lib/i18n";
import { NumField } from "./fields";

const SAMPLE = 50000;

export default function DivisorsEditor({
  warrantyDivisors,
  tireRimFormula,
  onChange,
}: {
  warrantyDivisors: Record<string, number>;
  tireRimFormula: TireRimFormula;
  onChange: (patch: { warrantyDivisors?: Record<string, number>; tireRimFormula?: TireRimFormula }) => void;
}) {
  const t = useT();
  const years = Object.keys(warrantyDivisors).map(Number).sort((a, b) => a - b);
  const w = warrantyOptions(warrantyDivisors, SAMPLE);
  const tr = tireRimOptions(tireRimFormula, SAMPLE);
  const yr = (y: number) => `${y} ${y > 1 ? t("ans") : t("an")}`;

  return (
    <div className="p-3 grid grid-cols-1 xl:grid-cols-2 gap-4">
      {/* Warranty */}
      <div>
        <div className="lbl font-semibold text-[13px]">{t("Diviseurs — Garantie prolongée")}</div>
        <p className="text-xs text-[#003a5d] mb-2">{t("Prix de la garantie = Prix du véhicule ÷ diviseur.")}</p>
        <table className="grid-table w-full text-left">
          <thead>
            <tr>
              <th>{t("Terme")}</th>
              <th className="w-[120px]">{t("Diviseur")}</th>
              <th className="text-right">{t("Sur 50 000 $")}</th>
              <th className="w-[40px]" />
            </tr>
          </thead>
          <tbody>
            {years.map((y) => (
              <tr key={y}>
                <td className="font-semibold text-[#1e3a50]">{yr(y)}</td>
                <td>
                  <NumField
                    value={warrantyDivisors[String(y)]}
                    decimals={2}
                    onChange={(n) => onChange({ warrantyDivisors: { ...warrantyDivisors, [String(y)]: n } })}
                    className="!bg-[#fffbe0]"
                  />
                </td>
                <td className="text-right tabular-nums">{fmtDesk(w.find((x) => x.years === y)?.price ?? 0)}</td>
                <td>
                  <button
                    className="dots"
                    title={t("Retirer")}
                    onClick={() => {
                      const d = { ...warrantyDivisors };
                      delete d[String(y)];
                      onChange({ warrantyDivisors: d });
                    }}
                  >
                    ✕
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <div className="flex gap-2 mt-2">
          <button
            className="btn"
            onClick={() => {
              const next = (years[years.length - 1] ?? 0) + 1;
              const last = warrantyDivisors[String(years[years.length - 1])] ?? 10;
              onChange({ warrantyDivisors: { ...warrantyDivisors, [String(next)]: Math.max(1, last - 1) } });
            }}
          >
            + {t("Ajouter une année")}
          </button>
          <button className="btn ml-auto" onClick={() => onChange({ warrantyDivisors: DEFAULT_WARRANTY_DIVISORS })}>{t("Réinitialiser")}</button>
        </div>
      </div>

      {/* Tire & rim */}
      <div>
        <div className="lbl font-semibold text-[13px]">{t("Formule — Protection pneus & jantes")}</div>
        <p className="text-xs text-[#003a5d] mb-2">
          {t("Le terme maximum utilise le diviseur de base; chaque année plus courte ajoute l'ajustement annuel. Le profit brut est fixé par le % du produit.")}
        </p>
        <div className="grid grid-cols-3 gap-2 mb-2">
          <label>
            <span className="lbl text-[12px]">{t("Diviseur de base (terme max)")}</span>
            <NumField value={tireRimFormula.base} decimals={2} onChange={(n) => onChange({ tireRimFormula: { ...tireRimFormula, base: n } })} className="!bg-[#fffbe0]" />
          </label>
          <label>
            <span className="lbl text-[12px]">{t("+ diviseur par année plus courte")}</span>
            <NumField value={tireRimFormula.step} decimals={2} onChange={(n) => onChange({ tireRimFormula: { ...tireRimFormula, step: n } })} className="!bg-[#fffbe0]" />
          </label>
          <label>
            <span className="lbl text-[12px]">{t("Nombre d'années maximum")}</span>
            <NumField
              value={tireRimFormula.maxYears}
              decimals={0}
              onChange={(n) => onChange({ tireRimFormula: { ...tireRimFormula, maxYears: Math.max(1, Math.min(10, Math.round(n))) } })}
              className="!bg-[#fffbe0]"
            />
          </label>
        </div>
        <table className="grid-table w-full text-left">
          <thead>
            <tr>
              <th>{t("Terme")}</th>
              <th className="text-right">{t("Diviseur")}</th>
              <th className="text-right">{t("Sur 50 000 $")}</th>
            </tr>
          </thead>
          <tbody>
            {tr.map((o) => (
              <tr key={o.years}>
                <td className="font-semibold text-[#1e3a50]">{yr(o.years)}</td>
                <td className="text-right tabular-nums">÷ {o.divisor}</td>
                <td className="text-right tabular-nums">{fmtDesk(o.price)}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <div className="flex mt-2">
          <button className="btn ml-auto" onClick={() => onChange({ tireRimFormula: DEFAULT_TIRE_RIM })}>{t("Réinitialiser")}</button>
        </div>
      </div>
    </div>
  );
}
