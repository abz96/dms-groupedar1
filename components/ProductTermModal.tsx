"use client";

import { useEffect, useState } from "react";
import { fmtDesk, tireRimOptions, warrantyOptions, type DealerSettings, type DealProduct } from "@/lib/deal";
import { useT } from "@/lib/i18n";
import { NumField } from "./fields";
import PlanPicker from "./PlanPicker";
import type { ProtectionPlan } from "@/lib/deal";

/** Pick warranty / tire & rim coverage by term — price = vehicle price ÷ divisor (editable). */
export default function ProductTermModal({
  kind,
  vehiclePrice,
  settings,
  current,
  onPick,
  onPickPlan,
  onClose,
}: {
  kind: "warranty" | "tireRim";
  vehiclePrice: number;
  settings: DealerSettings;
  current?: DealProduct;
  onPick: (term: number | null, price: number) => void;
  onPickPlan?: (plan: ProtectionPlan, term: number, price: number) => void;
  onClose: () => void;
}) {
  const t = useT();
  const opts = kind === "warranty" ? warrantyOptions(settings.warrantyDivisors, vehiclePrice) : tireRimOptions(settings.tireRimFormula, vehiclePrice);
  const [custom, setCustom] = useState(current?.price ?? 0);
  const [customTerm, setCustomTerm] = useState<number>(current?.term ?? 1);

  useEffect(() => {
    const k = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", k);
    return () => window.removeEventListener("keydown", k);
  }, [onClose]);

  const title = kind === "warranty" ? t("Garantie prolongée") : t("Protection pneus & jantes");

  return (
    <div className="fixed inset-0 z-50 bg-black/40 flex items-start justify-center pt-16 px-4" onClick={onClose}>
      <div className="win w-full max-w-[680px] max-h-[88vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <div className="win-title flex items-center h-9 px-3">
          <span>{title}</span>
          <button className="ml-auto text-white/80 hover:text-white" onClick={onClose}>✕</button>
        </div>
        <div className="p-3">
          <div className="text-[12px] text-[#1e3a50] mb-2">
            {t("Choisissez le terme désiré par le client.")}
          </div>
          {vehiclePrice <= 0 ? (
            <div className="text-[13px] text-red-700 py-3">{t("Entrez d'abord le prix du véhicule.")}</div>
          ) : (
            <table className="grid-table w-full text-left">
              <thead>
                <tr>
                  <th>{t("Terme")}</th>
                  <th className="text-right">{t("Prix")}</th>
                  <th className="w-[100px]" />
                </tr>
              </thead>
              <tbody>
                {opts.map((o) => {
                  const selected = current?.term === o.years;
                  return (
                    <tr
                      key={o.years}
                      className={`cursor-pointer ${selected ? "bg-[#d4e8f7] font-semibold" : "hover:bg-white"}`}
                      onClick={() => {
                        onPick(o.years, o.price);
                        onClose();
                      }}
                    >
                      <td>{o.years} {o.years > 1 ? t("ans") : t("an")}</td>
                      <td className="text-right tabular-nums font-semibold">{fmtDesk(o.price)}</td>
                      <td className="text-right">
                        <span className={`text-[11px] px-2 py-0.5 ${selected ? "bg-[#0071bc] text-white" : "border border-[#93a8ba] text-[#1e3a50]"}`}>
                          {selected ? `✓ ${t("Choisi")}` : t("Choisir")}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}

          {onPickPlan && (
            <div className="mt-3">
              <PlanPicker
                sections={[kind]}
                vehiclePrice={vehiclePrice}
                settings={settings}
                selectedCode={current?.code}
                onAdd={(p, y, price) => {
                  onPickPlan(p, y, price);
                  onClose();
                }}
              />
            </div>
          )}

          <div className="mt-3 border border-[#a9bccb] bg-[#f2f6f9] p-2">
            <div className="lbl text-[12px] font-semibold mb-1">{t("Montant personnalisé")}</div>
            <div className="flex items-center gap-2">
              <select className="fld !w-28" value={customTerm} onChange={(e) => setCustomTerm(Number(e.target.value))}>
                {(opts.length ? opts.map((o) => o.years) : [1, 2, 3, 4, 5, 6]).map((y) => (
                  <option key={y} value={y}>{y} {y > 1 ? t("ans") : t("an")}</option>
                ))}
              </select>
              <div className="w-36"><NumField value={custom} onChange={setCustom} /></div>
              <button
                className="btn btn-primary"
                onClick={() => {
                  onPick(customTerm, custom);
                  onClose();
                }}
              >
                {t("Appliquer")}
              </button>
              <a href="/settings#divisors" className="text-[11px] text-[#0071bc] underline ml-auto" title={t("Modifier les diviseurs dans les Paramètres")}>
                {t("Modifier les diviseurs")}
              </a>
              <button
                className="btn"
                onClick={() => {
                  onPick(null, 0);
                  onClose();
                }}
              >
                {t("Aucun")}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
