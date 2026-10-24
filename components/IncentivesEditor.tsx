"use client";

import type { Incentive } from "@/lib/deal";
import { useT } from "@/lib/i18n";
import { NumField } from "./fields";

const newId = () => Math.random().toString(36).slice(2, 10);

/** Settings: manufacturer rebates (R.M. non-taxable) and lower-rate incentives — add / edit / remove. */
export default function IncentivesEditor({ list, onChange }: { list: Incentive[]; onChange: (l: Incentive[]) => void }) {
  const t = useT();
  const set = (i: number, patch: Partial<Incentive>) => onChange(list.map((x, j) => (j === i ? { ...x, ...patch } : x)));
  const add = (kind: Incentive["kind"]) =>
    onChange([
      ...list,
      {
        id: newId(),
        name: kind === "cash" ? t("Rabais manufacturier") : t("Taux réduit"),
        kind,
        amount: kind === "cash" ? 1000 : 0,
        rate: kind === "rate" ? 1 : 0,
        dealType: kind === "rate" ? "finance" : "",
        terms: "",
        notes: "",
        active: true,
      },
    ]);

  return (
    <div className="p-3">
      <p className="text-xs text-[#003a5d] mb-2">
        {t("Les rabais manufacturiers s'ajoutent au champ R.M. (Non Tax.) du dossier. Les réductions de taux sont soustraites du taux standard du prêteur (ex. 7,99 % − 1,00 % = 6,99 %).")}
      </p>
      <div className="overflow-x-auto">
        <table className="grid-table w-full text-left min-w-[900px]">
          <thead>
            <tr>
              <th className="w-[60px]">{t("Actif")}</th>
              <th>{t("Nom du programme")}</th>
              <th className="w-[150px]">{t("Type")}</th>
              <th className="w-[120px]">{t("Montant / Taux")}</th>
              <th className="w-[130px]">{t("Applicable à")}</th>
              <th className="w-[110px]">{t("Termes (mois)")}</th>
              <th>{t("Notes")}</th>
              <th className="w-[40px]" />
            </tr>
          </thead>
          <tbody>
            {list.length === 0 && (
              <tr>
                <td colSpan={8} className="text-center py-4 text-[#003a5d]">{t("Aucun programme. Ajoutez un rabais ou un taux réduit.")}</td>
              </tr>
            )}
            {list.map((x, i) => (
              <tr key={x.id} className={x.active ? "" : "opacity-50"}>
                <td className="text-center"><input type="checkbox" checked={x.active} onChange={(e) => set(i, { active: e.target.checked })} /></td>
                <td><input className="fld !h-7" value={x.name} onChange={(e) => set(i, { name: e.target.value })} /></td>
                <td>
                  <select className="fld !h-7" value={x.kind} onChange={(e) => set(i, { kind: e.target.value as Incentive["kind"] })}>
                    <option value="cash">{t("Rabais ($)")}</option>
                    <option value="rate">{t("Réduction de taux (%)")}</option>
                  </select>
                </td>
                <td>
                  {x.kind === "cash" ? (
                    <NumField value={x.amount} onChange={(n) => set(i, { amount: n })} />
                  ) : (
                    <NumField value={x.rate} onChange={(n) => set(i, { rate: n })} suffix=" %" className="!text-green-800" />
                  )}
                </td>
                <td>
                  <select className="fld !h-7" value={x.dealType} onChange={(e) => set(i, { dealType: e.target.value as Incentive["dealType"] })}>
                    <option value="">{t("Tous")}</option>
                    <option value="finance">{t("Financement")}</option>
                    <option value="lease">{t("Location")}</option>
                    <option value="cash">{t("Comptant")}</option>
                  </select>
                </td>
                <td><input className="fld !h-7" placeholder="36,48,60" value={x.terms} onChange={(e) => set(i, { terms: e.target.value })} /></td>
                <td><input className="fld !h-7" value={x.notes} onChange={(e) => set(i, { notes: e.target.value })} /></td>
                <td>
                  <button className="dots" title={t("Retirer")} onClick={() => confirm(t("Supprimer ce programme ?")) && onChange(list.filter((_, j) => j !== i))}>
                    ✕
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="flex gap-2 mt-2">
        <button className="btn btn-primary" onClick={() => add("cash")}>+ {t("Rabais manufacturier")}</button>
        <button className="btn btn-primary" onClick={() => add("rate")}>+ {t("Taux réduit")}</button>
      </div>
    </div>
  );
}
