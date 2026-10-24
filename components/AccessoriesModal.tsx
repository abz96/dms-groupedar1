"use client";

import { useEffect, useState } from "react";
import { fmtDesk, type AccessoryItem, type DealData, type DealerSettings } from "@/lib/deal";
import { useT } from "@/lib/i18n";
import { NumField } from "./fields";
import PlanPicker from "./PlanPicker";

export default function AccessoriesModal({
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
  const [name, setName] = useState("");
  const [price, setPrice] = useState(0);
  const [toast, setToast] = useState("");
  const [catalog, setCatalog] = useState<AccessoryItem[]>(settings.accessoryCatalog ?? []);
  const items = data.accessoryItems;
  const total = items.reduce((a, i) => a + (Number(i.price) || 0), 0);

  useEffect(() => {
    const k = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", k);
    return () => window.removeEventListener("keydown", k);
  }, [onClose]);

  /** keep pricing.accessories = sum of items */
  const setItems = (fn: (list: AccessoryItem[]) => AccessoryItem[]) =>
    upd((d) => {
      // first item added: keep any amount already typed as a line
      if (d.accessoryItems.length === 0 && d.pricing.accessories > 0) {
        d.accessoryItems = [{ name: t("Accessoires"), price: d.pricing.accessories }];
      }
      d.accessoryItems = fn(d.accessoryItems);
      d.pricing.accessories = Math.round(d.accessoryItems.reduce((a, i) => a + (Number(i.price) || 0), 0) * 100) / 100;
    });

  function add(item?: AccessoryItem) {
    const it = item ?? { name: name.trim(), price };
    if (!it.name) return;
    setItems((l) => [...l, { name: it.name, price: Number(it.price) || 0 }]);
    if (!item) {
      setName("");
      setPrice(0);
    }
  }

  async function saveCatalog(next: AccessoryItem[]) {
    setCatalog(next);
    const res = await fetch("/api/settings");
    const s = await res.json();
    await fetch("/api/settings", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...s, accessoryCatalog: next }),
    });
  }

  function addToCatalog(it: AccessoryItem) {
    if (!it.name.trim()) return;
    const next = [...catalog.filter((c) => c.name.toLowerCase() !== it.name.trim().toLowerCase()), { name: it.name.trim(), price: Number(it.price) || 0 }];
    next.sort((a, b) => a.name.localeCompare(b.name));
    void saveCatalog(next);
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/40 flex items-start justify-center pt-16 px-4" onClick={onClose}>
      <div className="win w-full max-w-[820px] max-h-[88vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <div className="win-title flex items-center h-9 px-3">
          <span>{t("Accessoires")}</span>
          <button className="ml-auto text-white/80 hover:text-white" onClick={onClose}>✕</button>
        </div>

        <div className="p-3">
          {toast && <div className="mb-2 px-3 py-1.5 text-[13px] font-semibold text-emerald-800 bg-emerald-50 border border-emerald-200">{toast}</div>}
          <table className="grid-table w-full text-left">
            <thead>
              <tr>
                <th>{t("Nom de l'accessoire")}</th>
                <th className="text-right w-[150px]">{t("Prix")}</th>
                <th className="w-[90px]" />
              </tr>
            </thead>
            <tbody>
              {items.length === 0 && (
                <tr>
                  <td colSpan={3} className="text-center py-4 text-[#003a5d]">{t("Aucun accessoire. Ajoutez-en un ci-dessous.")}</td>
                </tr>
              )}
              {items.map((it, i) => (
                <tr key={i}>
                  <td>
                    <input
                      className="fld !h-7"
                      value={it.name}
                      onChange={(e) => setItems((l) => l.map((x, j) => (j === i ? { ...x, name: e.target.value } : x)))}
                    />
                  </td>
                  <td>
                    <NumField value={it.price} onChange={(n) => setItems((l) => l.map((x, j) => (j === i ? { ...x, price: n } : x)))} />
                  </td>
                  <td className="whitespace-nowrap text-right">
                    <button className="dots" title={t("Enregistrer au catalogue")} onClick={() => addToCatalog(it)}>★</button>{" "}
                    <button className="dots" title={t("Retirer")} onClick={() => setItems((l) => l.filter((_, j) => j !== i))}>✕</button>
                  </td>
                </tr>
              ))}
              <tr className="bg-[#f2f6f9]">
                <td>
                  <input
                    className="fld !h-7"
                    placeholder={t("Ex. : Tapis d'hiver, démarreur à distance…")}
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && add()}
                  />
                </td>
                <td>
                  <NumField value={price} onChange={setPrice} />
                </td>
                <td className="text-right">
                  <button className="btn btn-primary" onClick={() => add()} disabled={!name.trim()}>+ {t("Ajouter")}</button>
                </td>
              </tr>
              <tr>
                <td className="font-bold text-right lbl">{t("Total accessoires")}</td>
                <td className="text-right font-bold tabular-nums">{fmtDesk(total)}</td>
                <td />
              </tr>
            </tbody>
          </table>

          <div className="mt-3">
            <PlanPicker
              sections={["accessory"]}
              vehiclePrice={Math.max(0, data.pricing.basePrice + data.pricing.options - data.pricing.reduction)}
              settings={settings}
              onAdd={(p, y, price) => {
                add({ name: `${p.name} (${y} ${y > 1 ? t("ans") : t("an")})`, price });
                setToast(`✓ ${p.name} — ${fmtDesk(price)} $ ${t("ajouté au dossier")}`);
                setTimeout(() => setToast(""), 2200);
              }}
            />
          </div>

          <div className="mt-3 border border-[#a9bccb] bg-[#f2f6f9] p-2">
            <div className="lbl font-semibold text-[13px] mb-1">{t("Catalogue d'accessoires")}</div>
            {catalog.length === 0 ? (
              <div className="text-[12px] text-[#003a5d]">{t("Cliquez ★ sur une ligne pour l'enregistrer au catalogue et la réutiliser dans d'autres dossiers.")}</div>
            ) : (
              <div className="flex flex-wrap gap-1">
                {catalog.map((c) => (
                  <span key={c.name} className="inline-flex items-center border border-[#93a8ba] bg-white text-[12px]">
                    <button className="px-2 py-1 hover:bg-[#0071bc] hover:text-white" title={t("Ajouter")} onClick={() => add(c)}>
                      + {c.name} <b className="tabular-nums">{fmtDesk(c.price)}</b>
                    </button>
                    <button
                      className="px-1 text-red-700 hover:bg-red-50"
                      title={t("Retirer du catalogue")}
                      onClick={() => void saveCatalog(catalog.filter((x) => x.name !== c.name))}
                    >
                      ✕
                    </button>
                  </span>
                ))}
              </div>
            )}
          </div>

          <div className="flex justify-end gap-2 mt-3">
            {items.length > 0 && (
              <button
                className="btn"
                onClick={() =>
                  upd((d) => {
                    d.accessoryItems = [];
                    d.pricing.accessories = 0;
                  })
                }
              >
                {t("Tout effacer")}
              </button>
            )}
            <button className="btn btn-primary" onClick={onClose}>OK</button>
          </div>
        </div>
      </div>
    </div>
  );
}
