"use client";

import { useT } from "@/lib/i18n";
import { useEffect, useRef, useState } from "react";
import type { Lender } from "@/lib/deal";
import { NumField, TextField } from "./fields";

const TYPE_LABEL: Record<string, string> = {
  bank: "Banque canadienne",
  quebec: "Banque québécoise / Caisse",
  captive: "Captive (fabricant)",
  inhouse: "Financement maison",
  subprime: "Non-prime / 2e chance",
};

export default function LendersEditor({ initial }: { initial: Lender[] }) {
  const tr = useT();
  const [list, setList] = useState(initial);
  const [filter, setFilter] = useState("");

  async function add(type: string) {
    const res = await fetch("/api/lenders", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(
        type === "inhouse"
          ? {
              name: "Financement Maison #2",
              shortName: "MAISON2",
              type,
              allowLease: true,
              financeRates: { "36": 12.99, "48": 13.99, "60": 14.99 },
              leaseRates: { "36": 9.99, "48": 10.99 },
              residuals: { "36": 48, "48": 40 },
              reserveShare: "100",
              maxMarkup: "5",
            }
          : { type },
      ),
    });
    const row = (await res.json()) as Lender;
    setList((l) => [...l, row]);
  }

  async function remove(id: number) {
    if (!confirm(tr("Supprimer ce prêteur ?"))) return;
    await fetch(`/api/lenders/${id}`, { method: "DELETE" });
    setList((l) => l.filter((x) => x.id !== id));
  }

  const shown = list.filter((l) => !filter || l.type === filter);

  return (
    <div className="win">
      <div className="win-title flex items-center px-3 h-9">
        <span>{tr("Prêteurs canadiens — Taux, termes & résiduels")}</span>
        <span className="ml-auto text-xs text-[#cfe3f2]">{tr("Modifications sauvegardées automatiquement")}</span>
      </div>
      <div className="flex flex-wrap items-center gap-2 p-3 border-b border-[#bccbd8]">
        <button className="btn btn-primary" onClick={() => add("bank")}>{tr("+ Banque")}</button>
        <button className="btn btn-primary" onClick={() => add("inhouse")}>{tr("+ Financement maison")}</button>
        <button className="btn" onClick={() => add("captive")}>{tr("+ Captive")}</button>
        <span className="lbl ml-4">{tr("Filtre")}</span>
        <select className="fld !w-56" value={filter} onChange={(e) => setFilter(e.target.value)}>
          <option value="">{tr("Tous")}</option>
          {Object.entries(TYPE_LABEL).map(([k, v]) => <option key={k} value={k}>{tr(v)}</option>)}
        </select>
        <span className="text-xs text-[#003a5d] ml-auto max-w-md">
          {tr("Banques : financement seulement. Seul le financement maison (Groupe Dar) offre la location. Le taux d'intérêt de chaque terme est appliqué automatiquement au dossier.")}
        </span>
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 p-3">
        {shown.map((l) => (
          <LenderCard key={l.id} initial={l} onRemove={() => remove(l.id)} />
        ))}
      </div>
    </div>
  );
}

function LenderCard({ initial, onRemove }: { initial: Lender; onRemove: () => void }) {
  const tr = useT();
  const [l, setL] = useState(initial);
  const [status, setStatus] = useState("");
  const first = useRef(true);
  const [newFin, setNewFin] = useState("");
  const [newLease, setNewLease] = useState("");

  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    setStatus("…");
    const t = setTimeout(async () => {
      const res = await fetch(`/api/lenders/${l.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(l),
      });
      setStatus(res.ok ? "✓" : "");
    }, 600);
    return () => clearTimeout(t);
  }, [l]);

  const set = <K extends keyof Lender>(k: K, v: Lender[K]) => setL((x) => ({ ...x, [k]: v }));
  const finTerms = Object.keys(l.financeRates).map(Number).sort((a, b) => a - b);
  const leaseTerms = Array.from(new Set([...Object.keys(l.leaseRates), ...Object.keys(l.residuals)].map(Number))).sort((a, b) => a - b);

  return (
    <div className={`border border-[#9a9a9a] bg-[#f2f6f9] ${l.active ? "" : "opacity-60"}`}>
      <div className="sec-head">
        <div className="sec-tab !py-1 !px-3 !text-sm">{l.shortName || "—"}</div>
        <div className="flex-1 px-2 text-xs text-[#1e3a50]">{tr(TYPE_LABEL[l.type] ?? l.type)}</div>
        <span className="text-xs text-[#1e3a50] px-2">{status === "✓" ? `✓ ${tr("Sauvegardé")}` : status === "" ? `${tr("Erreur")}` : status}</span>
        <button className="btn btn-danger !py-0 mr-1" onClick={onRemove}>✕</button>
      </div>
      <div className="p-2 grid grid-cols-2 gap-x-3 gap-y-1">
        <label className="col-span-2 flex items-center gap-2"><span className="lbl w-24">{tr("Nom")}</span><TextField value={l.name} onChange={(v) => set("name", v)} /></label>
        <label className="flex items-center gap-2"><span className="lbl w-24">{tr("Code")}</span><TextField value={l.shortName} onChange={(v) => set("shortName", v)} /></label>
        <label className="flex items-center gap-2">
          <span className="lbl w-24">{tr("Type")}</span>
          <select className="fld" value={l.type} onChange={(e) => set("type", e.target.value)}>
            {Object.entries(TYPE_LABEL).map(([k, v]) => <option key={k} value={k}>{tr(v)}</option>)}
          </select>
        </label>
        <label className="flex items-center gap-2"><span className="lbl w-24">{tr("Frais RDPRM/PPSA")}</span><NumField value={Number(l.registrationFee)} onChange={(n) => set("registrationFee", String(n))} /></label>
        <div className="flex items-center gap-3 text-[13px] text-[#1e3a50]">
          <label className="flex items-center gap-1"><input type="checkbox" checked={l.active} onChange={(e) => set("active", e.target.checked)} /> {tr("Actif")}</label>
          <label className="flex items-center gap-1"><input type="checkbox" checked={l.allowFinance} onChange={(e) => set("allowFinance", e.target.checked)} /> {tr("Financement")}</label>
          <label className="flex items-center gap-1"><input type="checkbox" checked={l.allowLease} onChange={(e) => set("allowLease", e.target.checked)} /> {tr("Location")}</label>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-2 px-2 pb-2">
        <div>
          <div className="lbl text-xs font-semibold mb-1">{tr("Financement — taux par terme")}</div>
          <table className="w-full text-[12px]">
            <thead><tr className="text-white"><th className="sec-tab !text-xs !py-0.5">{tr("Mois")}</th><th className="sec-tab !text-xs !py-0.5">{tr("Taux %")}</th><th className="sec-tab !text-xs !py-0.5 !px-1" /></tr></thead>
            <tbody>
              {finTerms.map((t) => (
                <tr key={t}>
                  <td className="text-center text-[#1e3a50] font-semibold">{t}</td>
                  <td className="py-0.5"><NumField value={l.financeRates[String(t)]} onChange={(n) => set("financeRates", { ...l.financeRates, [String(t)]: n })} /></td>
                  <td>
                    <button className="dots !w-6 !h-6" onClick={() => { const r = { ...l.financeRates }; delete r[String(t)]; set("financeRates", r); }}>✕</button>
                  </td>
                </tr>
              ))}
              <tr>
                <td><input className="fld !h-6 text-center" placeholder={tr("terme")} value={newFin} onChange={(e) => setNewFin(e.target.value)} /></td>
                <td colSpan={2}>
                  <button className="btn !py-0 w-full" onClick={() => { const t = parseInt(newFin); if (t > 0) { set("financeRates", { ...l.financeRates, [String(t)]: 6.99 }); setNewFin(""); } }}>{tr("+ Ajouter terme")}</button>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
        <div className={l.allowLease ? "" : "opacity-50"}>
          <div className="lbl text-xs font-semibold mb-1">Location — taux & résiduel par terme</div>
          <table className="w-full text-[12px]">
            <thead><tr className="text-white"><th className="sec-tab !text-xs !py-0.5">{tr("Mois")}</th><th className="sec-tab !text-xs !py-0.5">{tr("Taux %")}</th><th className="sec-tab !text-xs !py-0.5" title={tr("Utilisé seulement si le terme est absent de la grille des Paramètres")}>{tr("Rés. % (secours)")}</th><th className="sec-tab !text-xs !py-0.5 !px-1" /></tr></thead>
            <tbody>
              {leaseTerms.map((t) => (
                <tr key={t}>
                  <td className="text-center text-[#1e3a50] font-semibold">{t}</td>
                  <td className="py-0.5"><NumField value={l.leaseRates[String(t)] ?? 0} onChange={(n) => set("leaseRates", { ...l.leaseRates, [String(t)]: n })} /></td>
                  <td className="py-0.5"><NumField value={l.residuals[String(t)] ?? 0} onChange={(n) => set("residuals", { ...l.residuals, [String(t)]: n })} /></td>
                  <td>
                    <button
                      className="dots !w-6 !h-6"
                      onClick={() => {
                        const r = { ...l.leaseRates };
                        const s = { ...l.residuals };
                        delete r[String(t)];
                        delete s[String(t)];
                        setL((x) => ({ ...x, leaseRates: r, residuals: s }));
                      }}
                    >✕</button>
                  </td>
                </tr>
              ))}
              <tr>
                <td><input className="fld !h-6 text-center" placeholder={tr("terme")} value={newLease} onChange={(e) => setNewLease(e.target.value)} /></td>
                <td colSpan={3}>
                  <button
                    className="btn !py-0 w-full"
                    onClick={() => {
                      const t = parseInt(newLease);
                      if (t > 0) {
                        setL((x) => ({ ...x, allowLease: true, leaseRates: { ...x.leaseRates, [String(t)]: 4.99 }, residuals: { ...x.residuals, [String(t)]: 50 } }));
                        setNewLease("");
                      }
                    }}
                  >{tr("+ Ajouter terme")}</button>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
      <div className="px-2 pb-2">
        <textarea className="fld !h-12 py-1 text-xs" placeholder={tr("Notes / conditions du programme")} value={l.notes} onChange={(e) => set("notes", e.target.value)} />
      </div>
    </div>
  );
}
