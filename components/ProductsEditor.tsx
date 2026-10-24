"use client";

import type { DealerSettings, ProductDef } from "@/lib/deal";
import { useT } from "@/lib/i18n";
import { NumField } from "./fields";

const newId = () => "p" + Math.random().toString(36).slice(2, 9);

/** Settings: profit products — add / edit / remove (vehicle, accessories and dealer fees are fixed rows). */
export default function ProductsEditor({
  products,
  profitPct,
  commission,
  onChange,
}: {
  products: ProductDef[];
  profitPct: DealerSettings["profitPct"];
  commission: DealerSettings["commission"];
  onChange: (patch: Partial<DealerSettings>) => void;
}) {
  const t = useT();
  const setProd = (i: number, patch: Partial<ProductDef>) => onChange({ products: products.map((x, j) => (j === i ? { ...x, ...patch } : x)) });
  const setCom = (k: keyof DealerSettings["commission"], n: number) => onChange({ commission: { ...commission, [k]: n } });

  return (
    <div className="p-3">
      <p className="text-xs text-[#003a5d] mb-2">
        {t("Ces produits apparaissent dans « Produits F&A » de chaque nouveau dossier et dans l'Analyse de profit. Coût = Prix × (1 − %).")}
      </p>
      <div className="overflow-x-auto">
        <table className="grid-table w-full text-left min-w-[760px]">
          <thead>
            <tr>
              <th>{t("Produit")}</th>
              <th className="w-[160px]">{t("Catégorie")}</th>
              <th className="w-[130px]">{t("Profit %")}</th>
              <th className="w-[130px]">{t("Comm. %")}</th>
              <th className="w-[40px]" />
            </tr>
          </thead>
          <tbody>
            {/* fixed rows */}
            <tr className="bg-[#f2f6f9]">
              <td className="font-semibold">{t("Véhicule")} <span className="text-[11px] font-normal text-[#5a7086]">({t("% du PDSF")})</span></td>
              <td>{t("Profit avant")}</td>
              <td><NumField value={profitPct.vehicle} onChange={(n) => onChange({ profitPct: { ...profitPct, vehicle: n } })} suffix=" %" /></td>
              <td><NumField value={commission.vehicle} onChange={(n) => setCom("vehicle", n)} suffix=" %" /></td>
              <td />
            </tr>
            <tr className="bg-[#f2f6f9]">
              <td className="font-semibold">{t("Accessoires")}</td>
              <td>{t("Profit avant")}</td>
              <td><NumField value={profitPct.accessories} onChange={(n) => onChange({ profitPct: { ...profitPct, accessories: n } })} suffix=" %" /></td>
              <td><NumField value={commission.accessories} onChange={(n) => setCom("accessories", n)} suffix=" %" /></td>
              <td />
            </tr>
            {products.map((x, i) => (
              <tr key={x.id}>
                <td><input className="fld !h-7" value={x.name} onChange={(e) => setProd(i, { name: e.target.value })} /></td>
                <td>
                  <select className="fld !h-7" value={x.group} onChange={(e) => setProd(i, { group: e.target.value as ProductDef["group"] })}>
                    <option value="back">{t("Profit arrière")}</option>
                    <option value="front">{t("Profit avant")}</option>
                  </select>
                </td>
                <td><NumField value={x.pct} onChange={(n) => setProd(i, { pct: n })} suffix=" %" className="!bg-[#fffbe0]" /></td>
                <td><NumField value={x.commission} onChange={(n) => setProd(i, { commission: n })} suffix=" %" /></td>
                <td>
                  <button className="dots" title={t("Retirer")} onClick={() => confirm(t("Supprimer ce produit ?")) && onChange({ products: products.filter((_, j) => j !== i) })}>
                    ✕
                  </button>
                </td>
              </tr>
            ))}
            <tr className="bg-[#fff7e0]">
              <td className="font-semibold">{t("Frais de concession")}</td>
              <td>{t("Frais de concession")}</td>
              <td><NumField value={100} readOnly suffix=" %" /></td>
              <td><NumField value={commission.fees ?? 0} onChange={(n) => setCom("fees", n)} suffix=" %" /></td>
              <td />
            </tr>
          </tbody>
        </table>
      </div>
      <button
        className="btn btn-primary mt-2"
        onClick={() => onChange({ products: [...products, { id: newId(), name: t("Nouveau produit"), pct: 50, commission: 10, group: "back" }] })}
      >
        + {t("Ajouter un produit")}
      </button>
    </div>
  );
}
