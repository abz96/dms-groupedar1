"use client";

import { useT } from "@/lib/i18n";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { fmtDesk } from "@/lib/deal";
import type { InventoryVehicle, ParsedRow } from "@/lib/inventory";
import { NumField } from "./fields";
import { useStaffList } from "./StaffSelect";

export type InvRow = InventoryVehicle & { id: number; status: string; createdAt: string; updatedAt: string };

const SAMPLE = `New Arrival 2022 Lamborghini Urus Grey
Previous Next 2022 Lamborghini Urus A21444 Your price $249,995 34,080 km Grey Gasoline 5 passengers 4 doors 4×4`;

const COLS: { k: keyof InventoryVehicle; label: string; w: string; num?: boolean }[] = [
  { k: "year", label: "Année", w: "w-[70px]" },
  { k: "make", label: "Marque", w: "w-[130px]" },
  { k: "model", label: "Modèle", w: "w-[120px]" },
  { k: "trim", label: "Version", w: "w-[160px]" },
  { k: "stock", label: "# Stock", w: "w-[100px]" },
  { k: "price", label: "Prix", w: "w-[115px]", num: true },
  { k: "kms", label: "Km", w: "w-[100px]", num: true },
  { k: "extColor", label: "Couleur ext.", w: "w-[120px]" },
];

export default function InventoryManager({ initial, aiEnabled }: { initial: InvRow[]; aiEnabled: boolean }) {
  const t = useT();
  const router = useRouter();
  const [rows, setRows] = useState(initial);
  const [text, setText] = useState("");
  const [parsed, setParsed] = useState<ParsedRow[] | null>(null);
  const [engine, setEngine] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  const [updateExisting, setUpdateExisting] = useState(false);
  const [q, setQ] = useState("");
  const [status, setStatus] = useState("instock");
  const [sort, setSort] = useState("recent");
  const [makeF, setMakeF] = useState("");
  const [condF, setCondF] = useState("");
  const [priceMin, setPriceMin] = useState(0);
  const [priceMax, setPriceMax] = useState(0);
  const [view, setView] = useState<"cards" | "table">("table");
  const [importOpen, setImportOpen] = useState(false);
  const staffList = useStaffList();
  const [editing, setEditing] = useState<number | null>(null);

  async function reload() {
    const r = await fetch("/api/inventory");
    setRows(await r.json());
  }

  async function analyze() {
    setBusy(true);
    setMsg("");
    const r = await fetch("/api/inventory/parse", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ text }) });
    const j = (await r.json()) as { vehicles: ParsedRow[]; engine: string };
    setParsed(j.vehicles);
    setEngine(j.engine);
    setBusy(false);
    if (!j.vehicles.length) setMsg(t("Aucun véhicule détecté. Vérifiez que chaque annonce contient l'année et la marque (ex. « 2022 Lamborghini Urus »)."));
  }

  async function importRows() {
    if (!parsed) return;
    const list = parsed.filter((p) => p.duplicate === "none" || (updateExisting && p.duplicate === "inventory"));
    setBusy(true);
    const r = await fetch("/api/inventory", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ vehicles: list, updateExisting }),
    });
    const j = (await r.json()) as { inserted: number; updated: number; skipped: number };
    const dupCount = parsed.length - list.length + j.skipped;
    setMsg(`✓ ${j.inserted} ${t("ajouté(s)")} · ${j.updated} ${t("mis à jour")} · ${dupCount} ${t("doublon(s) ignoré(s)")}`);
    setParsed(null);
    setText("");
    setBusy(false);
    await reload();
  }

  function editParsed(i: number, k: keyof InventoryVehicle, v: string | number) {
    setParsed((p) => (p ? p.map((r, j) => (j === i ? { ...r, [k]: v } : r)) : p));
  }

  async function saveRow(r: InvRow) {
    const res = await fetch(`/api/inventory/${r.id}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(r) });
    if (res.status === 409) {
      alert((await res.json()).error);
      return;
    }
    setEditing(null);
    await reload();
  }

  async function remove(id: number) {
    if (!confirm(t("Retirer ce véhicule de l'inventaire ?"))) return;
    await fetch(`/api/inventory/${id}`, { method: "DELETE" });
    setRows((r) => r.filter((x) => x.id !== id));
  }

  async function createDeal(id: number) {
    const r = await fetch("/api/deals", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ inventoryId: id }) });
    const j = await r.json();
    router.push(`/deals/${j.id}`);
  }

  const makes = useMemo(() => Array.from(new Set(rows.map((r) => r.make).filter(Boolean))).sort(), [rows]);

  const filtered = useMemo(() => {
    const s = q.toLowerCase().trim();
    const list = rows.filter(
      (r) =>
        (status === "all" || (status === "instock" ? r.status === "available" || r.status === "hold" : r.status === status)) &&
        (!makeF || r.make === makeF) &&
        (!condF || r.condition === condF) &&
        (!priceMin || r.price >= priceMin) &&
        (!priceMax || r.price <= priceMax) &&
        (!s || `${r.year} ${r.make} ${r.model} ${r.trim} ${r.stock} ${r.vin} ${r.extColor} ${r.employeeName ?? ""}`.toLowerCase().includes(s)),
    );
    const y = (r: InvRow) => Number(r.year) || 0;
    const cmp: Record<string, (a: InvRow, b: InvRow) => number> = {
      newest: (a, b) => y(b) - y(a) || a.kms - b.kms,
      oldest: (a, b) => y(a) - y(b) || b.kms - a.kms,
      // vehicles without a price always go last
      priceAsc: (a, b) => (a.price > 0 ? 0 : 1) - (b.price > 0 ? 0 : 1) || a.price - b.price,
      priceDesc: (a, b) => (a.price > 0 ? 0 : 1) - (b.price > 0 ? 0 : 1) || b.price - a.price,
      kmAsc: (a, b) => a.kms - b.kms,
      kmDesc: (a, b) => b.kms - a.kms,
      recent: (a, b) => b.createdAt.localeCompare(a.createdAt),
      make: (a, b) => `${a.make} ${a.model}`.localeCompare(`${b.make} ${b.model}`) || y(b) - y(a),
    };
    return [...list].sort(cmp[sort] ?? cmp.newest);
  }, [rows, q, status, makeF, condF, priceMin, priceMax, sort]);

  const stats = useMemo(() => {
    const inStock = rows.filter((r) => r.status === "available" || r.status === "hold");
    const days = (r: InvRow) => Math.floor((Date.now() - new Date(r.createdAt).getTime()) / 86400000);
    return {
      inStock: inStock.length,
      value: inStock.reduce((a, r) => a + r.price, 0),
      avgPrice: inStock.length ? inStock.reduce((a, r) => a + r.price, 0) / inStock.length : 0,
      hold: rows.filter((r) => r.status === "hold").length,
      employee: rows.filter((r) => r.status === "employee").length,
      sold: rows.filter((r) => r.status === "sold").length,
      avgDays: inStock.length ? inStock.reduce((a, r) => a + days(r), 0) / inStock.length : 0,
    };
  }, [rows]);

  const newCount = parsed?.filter((p) => p.duplicate === "none").length ?? 0;
  const dupInv = parsed?.filter((p) => p.duplicate === "inventory").length ?? 0;
  const dupList = parsed?.filter((p) => p.duplicate === "list").length ?? 0;
  const activeFilters = [makeF, condF, priceMin, priceMax, q].filter(Boolean).length + (status !== "instock" ? 1 : 0);
  const days = (r: InvRow) => Math.floor((Date.now() - new Date(r.createdAt).getTime()) / 86400000);

  return (
    <div className="space-y-4">
      {/* ---------- header ---------- */}
      <div className="rounded-md overflow-hidden shadow-[0_2px_8px_rgba(0,38,61,0.15)]">
        <div className="bg-gradient-to-r from-[#00263d] via-[#003a5d] to-[#0a5a8c] text-white px-6 py-4 flex flex-wrap items-center gap-4">
          <div className="flex-1 min-w-[200px]">
            <h1 className="text-[22px] font-bold tracking-tight">{t("Inventaire")}</h1>
            <p className="text-[12.5px] text-[#b9d2e5]">{t("Véhicules en stock, réservés, vendus et véhicules d'employés.")}</p>
          </div>
          <button
            className="h-10 rounded-md bg-white/10 hover:bg-white/20 ring-1 ring-white/30 px-4 text-[13px] font-semibold"
            onClick={() => {
              setImportOpen(true);
              setTimeout(() => document.getElementById("inv-import")?.scrollIntoView({ behavior: "smooth" }), 50);
            }}
          >
            {t("Importer des véhicules")}
          </button>
        </div>
        <div className="bg-white grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 divide-x divide-y xl:divide-y-0 divide-[#e3eaf1]">
          {[
            [t("En stock"), String(stats.inStock), "text-[#00263d]"],
            [t("Valeur du stock"), `${fmtDesk(stats.value)} $`, "text-[#0071bc]"],
            [t("Prix moyen"), `${fmtDesk(stats.avgPrice)} $`, "text-[#00263d]"],
            [t("Jours moyens en stock"), stats.avgDays.toFixed(0), stats.avgDays > 60 ? "text-red-700" : "text-[#00263d]"],
            [t("Réservés / Employés"), `${stats.hold} / ${stats.employee}`, "text-amber-700"],
            [t("Vendus"), String(stats.sold), "text-emerald-700"],
          ].map(([k, v, c]) => (
            <div key={k} className="px-4 py-3">
              <div className="text-[10px] font-bold uppercase tracking-wider text-[#5a7086]">{k}</div>
              <div className={`text-[19px] font-bold tabular-nums ${c}`}>{v}</div>
            </div>
          ))}
        </div>
      </div>

      {/* ---------- filters ---------- */}
      <div className="bg-white rounded-md border border-[#cbd8e3] shadow-[0_1px_3px_rgba(0,38,61,0.08)] p-3">
        <div className="flex flex-wrap items-end gap-2">
          <label className="flex-1 min-w-[220px]">
            <span className="text-[10px] font-bold uppercase tracking-wider text-[#5a7086]">{t("Recherche")}</span>
            <input className="fld !h-9 mt-0.5" placeholder={t("Marque, modèle, # stock, NIV, couleur, employé…")} value={q} onChange={(e) => setQ(e.target.value)} />
          </label>
          <label>
            <span className="text-[10px] font-bold uppercase tracking-wider text-[#5a7086]">{t("Trier par")}</span>
            <select className="fld !h-9 !w-56 mt-0.5 font-semibold" value={sort} onChange={(e) => setSort(e.target.value)}>
              <option value="newest">{t("Plus récents d'abord (année)")}</option>
              <option value="oldest">{t("Plus anciens d'abord (année)")}</option>
              <option value="priceAsc">{t("Prix : du plus bas au plus élevé")}</option>
              <option value="priceDesc">{t("Prix : du plus élevé au plus bas")}</option>
              <option value="kmAsc">{t("Kilométrage : le plus bas")}</option>
              <option value="kmDesc">{t("Kilométrage : le plus élevé")}</option>
              <option value="recent">{t("Ajoutés récemment")}</option>
              <option value="make">{t("Marque (A → Z)")}</option>
            </select>
          </label>
          <label>
            <span className="text-[10px] font-bold uppercase tracking-wider text-[#5a7086]">{t("Statut")}</span>
            <select className="fld !h-9 !w-44 mt-0.5" value={status} onChange={(e) => setStatus(e.target.value)}>
              <option value="instock">{t("En stock (disponible + réservé)")}</option>
              <option value="available">{t("Disponible")}</option>
              <option value="hold">{t("Réservé")}</option>
              <option value="employee">{t("Véhicule d'employé")}</option>
              <option value="sold">{t("Vendu")}</option>
              <option value="all">{t("Tous")}</option>
            </select>
          </label>
          <label>
            <span className="text-[10px] font-bold uppercase tracking-wider text-[#5a7086]">{t("Marque")}</span>
            <select className="fld !h-9 !w-40 mt-0.5" value={makeF} onChange={(e) => setMakeF(e.target.value)}>
              <option value="">{t("Toutes")}</option>
              {makes.map((m) => <option key={m} value={m}>{m}</option>)}
            </select>
          </label>
          <label>
            <span className="text-[10px] font-bold uppercase tracking-wider text-[#5a7086]">{t("État")}</span>
            <select className="fld !h-9 !w-32 mt-0.5" value={condF} onChange={(e) => setCondF(e.target.value)}>
              <option value="">{t("Tous")}</option>
              <option value="NEUF">{t("NEUF")}</option>
              <option value="USAGÉ">{t("USAGÉ")}</option>
              <option value="DÉMO">{t("DÉMO")}</option>
            </select>
          </label>
          <label>
            <span className="text-[10px] font-bold uppercase tracking-wider text-[#5a7086]">{t("Prix min.")}</span>
            <div className="w-28 mt-0.5"><NumField value={priceMin} blankZero decimals={0} onChange={setPriceMin} className="!h-9" /></div>
          </label>
          <label>
            <span className="text-[10px] font-bold uppercase tracking-wider text-[#5a7086]">{t("Prix max.")}</span>
            <div className="w-28 mt-0.5"><NumField value={priceMax} blankZero decimals={0} onChange={setPriceMax} className="!h-9" /></div>
          </label>
          <div className="flex rounded-md border border-[#9fb3c4] overflow-hidden h-9">
            {(["table", "cards"] as const).map((v) => (
              <button key={v} onClick={() => setView(v)} className={`px-3 text-[13px] ${view === v ? "bg-[#0071bc] text-white" : "bg-white text-[#003a5d] hover:bg-[#f4f8fb]"}`} title={v === "table" ? t("Liste") : t("Cartes")}>
                {v === "table" ? t("Liste") : t("Cartes")}
              </button>
            ))}
          </div>
        </div>
        <div className="flex items-center gap-3 mt-2 text-[12px] text-[#5a7086]">
          <span><b className="text-[#00263d]">{filtered.length}</b> {t("véhicule(s)")} · {fmtDesk(filtered.reduce((a, r) => a + r.price, 0))} $</span>
          {activeFilters > 0 && (
            <button
              className="text-[#0071bc] hover:underline"
              onClick={() => {
                setQ(""); setMakeF(""); setCondF(""); setPriceMin(0); setPriceMax(0); setStatus("instock");
              }}
            >
              ✕ {t("Réinitialiser les filtres")}
            </button>
          )}
        </div>
      </div>

      {/* ---------- list ---------- */}
      {filtered.length === 0 ? (
        <div className="bg-white rounded-md border border-dashed border-[#9fb3c4] p-10 text-center text-[#5a7086]">
          <div className="font-semibold text-[#00263d] mt-1">{rows.length ? t("Aucun véhicule ne correspond aux filtres.") : t("Aucun véhicule dans l'inventaire.")}</div>
          {!rows.length && <button className="btn btn-primary mt-3" onClick={() => setImportOpen(true)}>{t("Importer des véhicules")}</button>}
        </div>
      ) : view === "cards" ? (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4 gap-3">
          {filtered.map((r) =>
            editing === r.id ? (
              <div key={r.id} className="bg-white rounded-md border-2 border-[#0071bc] p-3 md:col-span-2">
                <EditForm row={r} staff={staffList.map((x) => x.name)} onSave={saveRow} onCancel={() => setEditing(null)} />
              </div>
            ) : (
              <div key={r.id} className="bg-white rounded-md border border-[#cbd8e3] shadow-[0_1px_3px_rgba(0,38,61,0.06)] overflow-hidden flex flex-col">
                <div className="px-4 pt-3 pb-2 border-b border-[#eef3f7]">
                  <div className="flex items-start gap-2">
                    <div className="min-w-0">
                      <div className="text-[11px] font-semibold text-[#5a7086]">{r.year} · {r.condition === "NEUF" ? t("Neuf") : r.condition === "DÉMO" ? t("Démo") : t("Usagé")}</div>
                      <div className="text-[16px] font-bold text-[#00263d] leading-tight truncate">{r.make} {r.model}</div>
                      <div className="text-[12px] text-[#3c5266] truncate">{r.trim || "—"}</div>
                    </div>
                    <div className="ml-auto"><StatusBadge r={r} /></div>
                  </div>
                </div>
                <div className="px-4 py-2 grid grid-cols-3 gap-2 text-[12px]">
                  <div><div className="text-[10px] uppercase tracking-wider text-[#93a8ba]">{t("Stock")}</div><div className="font-mono font-semibold">{r.stock || "—"}</div></div>
                  <div><div className="text-[10px] uppercase tracking-wider text-[#93a8ba]">{t("Km")}</div><div className="font-semibold tabular-nums">{Math.round(r.kms).toLocaleString("fr-CA")}</div></div>
                  <div><div className="text-[10px] uppercase tracking-wider text-[#93a8ba]">{t("Couleur")}</div><div className="font-semibold truncate">{r.extColor || "—"}</div></div>
                </div>
                <div className="mt-auto px-4 py-2.5 bg-[#f8fafc] border-t border-[#eef3f7] flex items-center gap-2">
                  <div>
                    <div className="text-[18px] font-bold text-[#0071bc] tabular-nums leading-none">{fmtDesk(r.price)} $</div>
                    <div className="text-[10px] text-[#93a8ba] mt-0.5">{days(r)} {t("jours en stock")}</div>
                  </div>
                  <div className="ml-auto flex gap-1">
                    {r.status !== "sold" && r.status !== "employee" && <button className="btn btn-primary !py-1" onClick={() => createDeal(r.id)}>{t("Dossier")}</button>}
                    <button className="btn !py-1" onClick={() => setEditing(r.id)}>✎</button>
                    <button className="btn btn-danger !py-1" onClick={() => remove(r.id)}>✕</button>
                  </div>
                </div>
              </div>
            ),
          )}
        </div>
      ) : (
        <div className="bg-white rounded-md border border-[#cbd8e3] shadow-[0_1px_3px_rgba(0,38,61,0.08)] overflow-x-auto">
          <table className="w-full text-[13px]">
            <thead>
              <tr className="bg-[#f4f7fa] text-[10.5px] uppercase tracking-wider text-[#5a7086] border-b border-[#e3eaf1]">
                <th className="text-left px-4 py-2.5 font-bold">{t("Véhicule")}</th>
                <th className="text-left px-3 py-2.5 font-bold">{t("# Stock")}</th>
                <th className="text-right px-3 py-2.5 font-bold">{t("Km")}</th>
                <th className="text-left px-3 py-2.5 font-bold">{t("Couleur")}</th>
                <th className="text-left px-3 py-2.5 font-bold">{t("État")}</th>
                <th className="text-right px-3 py-2.5 font-bold">{t("Jours")}</th>
                <th className="text-right px-3 py-2.5 font-bold">{t("Prix")}</th>
                <th className="text-left px-3 py-2.5 font-bold">{t("Statut")}</th>
                <th className="text-right px-4 py-2.5 font-bold">{t("Actions")}</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((r) =>
                editing === r.id ? (
                  <tr key={r.id} className="bg-[#f4f8fb]">
                    <td colSpan={9} className="px-4 py-3"><EditForm row={r} staff={staffList.map((x) => x.name)} onSave={saveRow} onCancel={() => setEditing(null)} /></td>
                  </tr>
                ) : (
                  <tr key={r.id} className="border-b border-[#eef3f7] hover:bg-[#f8fafc]" onDoubleClick={() => setEditing(r.id)}>
                    <td className="px-4 py-2">
                      <div className="font-semibold text-[#00263d]">{r.year} {r.make} {r.model}</div>
                      <div className="text-[11.5px] text-[#5a7086] truncate max-w-[300px]">{r.trim || "—"}</div>
                    </td>
                    <td className="px-3 py-2 font-mono font-semibold text-[12px]">{r.stock || "—"}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{Math.round(r.kms).toLocaleString("fr-CA")}</td>
                    <td className="px-3 py-2">{r.extColor || "—"}</td>
                    <td className="px-3 py-2">
                      <span className={`text-[10.5px] font-bold px-1.5 py-0.5 rounded-sm ${r.condition === "NEUF" ? "bg-[#e6f1fa] text-[#005a96]" : r.condition === "DÉMO" ? "bg-violet-50 text-violet-700" : "bg-[#f1f3f5] text-[#3c5266]"}`}>
                        {t(r.condition)}
                      </span>
                    </td>
                    <td className={`px-3 py-2 text-right tabular-nums ${days(r) > 60 ? "text-red-700 font-semibold" : days(r) > 30 ? "text-amber-700" : "text-[#3c5266]"}`}>{days(r)}</td>
                    <td className="px-3 py-2 text-right tabular-nums font-bold text-[#0071bc]">{fmtDesk(r.price)} $</td>
                    <td className="px-3 py-2"><StatusBadge r={r} /></td>
                    <td className="px-4 py-2 text-right whitespace-nowrap space-x-1">
                      {r.status !== "sold" && r.status !== "employee" && <button className="btn btn-primary !py-1" onClick={() => createDeal(r.id)}>{t("Créer un dossier")}</button>}
                      <button className="btn !py-1" onClick={() => setEditing(r.id)}>{t("Modifier")}</button>
                      <button className="btn btn-danger !py-1" onClick={() => remove(r.id)}>✕</button>
                    </td>
                  </tr>
                ),
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* ---------- AI import (collapsible, bottom) ---------- */}
      <div id="inv-import" className="win">
        <button className="win-title w-full flex items-center px-3 h-10 text-left" onClick={() => setImportOpen((o) => !o)}>
          <span className="mr-2 inline-block w-4 text-center">{importOpen ? "▾" : "▸"}</span>
          <span>{t("Inventaire AI — Importer par copier-coller")}</span>
          <span className="ml-auto text-xs text-[#cfe3f2]">
            {importOpen ? t("Cliquer pour fermer") : t("Cliquer pour ouvrir")} · {aiEnabled ? t("IA (OpenAI) + analyse locale") : t("analyse intelligente locale")} · {t("Anti-doublons actif")}
          </span>
        </button>
        {importOpen && (
          <>
        <div className="p-3 grid grid-cols-1 lg:grid-cols-[1fr_300px] gap-3">
          <div>
            <textarea
              className="fld !h-40 py-2 !tracking-normal font-mono !text-[12px]"
              placeholder={`Collez ici la liste des véhicules (site web, Excel, etc.)\n\nExemple :\n${SAMPLE}`}
              value={text}
              onChange={(e) => setText(e.target.value)}
            />
            <div className="flex flex-wrap items-center gap-2 mt-2">
              <button className="btn btn-primary" disabled={busy || !text.trim()} onClick={analyze}>
                {busy ? t("Analyse…") : t("Analyser la liste")}
              </button>
              <button className="btn" onClick={() => setText(SAMPLE)}>{t("Exemple")}</button>
              <button className="btn" onClick={() => { setText(""); setParsed(null); }}>{t("Effacer")}</button>
              {msg && <span className="text-[13px] text-[#005a96] font-semibold">{msg}</span>}
            </div>
          </div>
          <div className="text-[12px] text-[#1e3a50] bg-[#f2f6f9] border border-[#a9bccb] p-2 leading-5">
            <b>{t("Champs extraits :")}</b> {t("Année · Marque · Modèle · Version · # Stock · Prix · Kilométrage · Couleur extérieure")}
            <br />
            <b>{t("Formats acceptés :")}</b> {t("texte copié d'un site de concessionnaire (« Your price », « km »…), colonnes Excel/Sheets (tabulations), CSV « ; ».")}
            <br />
            <b>{t("Doublons :")}</b> {t("un véhicule avec le même # de stock (ou NIV, ou annonce identique) n'est jamais ajouté deux fois.")}
          </div>
        </div>

        {parsed && parsed.length > 0 && (
          <div className="border-t border-[#bccbd8]">
            <div className="flex flex-wrap items-center gap-3 px-3 py-2">
              <span className="lbl font-semibold">{t("Aperçu")} — {parsed.length} {t("détecté(s)")}</span>
              <span className="text-[12px] px-2 py-0.5 bg-green-100 text-green-800 border border-green-300">{newCount} {t("nouveau(x)")}</span>
              <span className="text-[12px] px-2 py-0.5 bg-amber-100 text-amber-800 border border-amber-300">{dupInv} {t("déjà en inventaire")}</span>
              <span className="text-[12px] px-2 py-0.5 bg-slate-200 text-slate-700 border border-slate-300">{dupList} {t("en double dans la liste")}</span>
              <span className="text-[11px] text-[#003a5d]">({engine === "ai" ? t("extraction IA") : t("extraction locale")} — {t("corrigez au besoin avant d'importer")})</span>
              <label className="flex items-center gap-1 text-[13px] text-[#1e3a50] ml-auto">
                <input type="checkbox" checked={updateExisting} onChange={(e) => setUpdateExisting(e.target.checked)} />
                {t("Mettre à jour prix/km des véhicules existants")}
              </label>
              <button className="btn btn-primary" disabled={busy || (newCount === 0 && !(updateExisting && dupInv))} onClick={importRows}>
                {t("Importer")} {newCount + (updateExisting ? dupInv : 0)} {t("véhicule(s)")}
              </button>
            </div>
            <div className="overflow-x-auto px-3 pb-3">
              <table className="grid-table w-full text-left">
                <thead>
                  <tr>
                    <th>{t("Statut")}</th>
                    {COLS.map((c) => <th key={c.k}>{t(c.label)}</th>)}
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {parsed.map((p, i) => (
                    <tr key={i} className={p.duplicate === "none" ? "bg-white/60" : "opacity-60"}>
                      <td className="text-[11px] whitespace-nowrap">
                        {p.duplicate === "none" ? (
                          <span className="text-green-800 font-semibold">{t("● Nouveau")}</span>
                        ) : p.duplicate === "inventory" ? (
                          <span className="text-amber-700 font-semibold">{t("● Doublon (inventaire)")}</span>
                        ) : (
                          <span className="text-slate-600 font-semibold">{t("● Doublon (liste)")}</span>
                        )}
                      </td>
                      {COLS.map((c) => (
                        <td key={c.k} className={c.w}>
                          {c.num ? (
                            <NumField value={Number(p[c.k]) || 0} decimals={c.k === "kms" ? 0 : 2} onChange={(n) => editParsed(i, c.k, n)} />
                          ) : (
                            <input className="fld !h-7" value={String(p[c.k] ?? "")} onChange={(e) => editParsed(i, c.k, e.target.value)} />
                          )}
                        </td>
                      ))}
                      <td>
                        <button className="dots" title={t("Retirer de l'aperçu")} onClick={() => setParsed((x) => (x ? x.filter((_, j) => j !== i) : x))}>✕</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
          </>
        )}
      </div>
    </div>
  );
}

const STATUS_STYLE: Record<string, string> = {
  available: "bg-emerald-50 text-emerald-700 ring-emerald-600/30",
  hold: "bg-amber-50 text-amber-800 ring-amber-600/30",
  sold: "bg-slate-100 text-slate-600 ring-slate-500/30",
  employee: "bg-violet-50 text-violet-700 ring-violet-600/30",
};
const STATUS_LABEL: Record<string, string> = { available: "Disponible", hold: "Réservé", sold: "Vendu", employee: "Véhicule d'employé" };

function StatusBadge({ r }: { r: InvRow }) {
  const t = useT();
  return (
    <div className="inline-flex flex-col items-start">
      <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10.5px] font-bold ring-1 ring-inset whitespace-nowrap ${STATUS_STYLE[r.status] ?? STATUS_STYLE.available}`}>
        {t(STATUS_LABEL[r.status] ?? r.status)}
      </span>
      {r.status === "employee" && r.employeeName && <span className="text-[11px] text-violet-700 font-semibold mt-0.5">{r.employeeName}</span>}
    </div>
  );
}

function EditForm({ row, staff, onSave, onCancel }: { row: InvRow; staff: string[]; onSave: (r: InvRow) => void; onCancel: () => void }) {
  const t = useT();
  const [r, setR] = useState(row);
  const fld = (k: keyof InventoryVehicle, label: string, w = "") => (
    <label className={w}>
      <span className="text-[10px] font-bold uppercase tracking-wider text-[#5a7086]">{t(label)}</span>
      <input className="fld !h-8 mt-0.5" value={String(r[k] ?? "")} onChange={(e) => setR({ ...r, [k]: e.target.value })} />
    </label>
  );
  return (
    <div className="space-y-2">
      <div className="grid grid-cols-2 md:grid-cols-4 xl:grid-cols-8 gap-2">
        {fld("year", "Année")}
        {fld("make", "Marque")}
        {fld("model", "Modèle")}
        {fld("trim", "Version", "md:col-span-2")}
        {fld("stock", "# Stock")}
        {fld("vin", "NIV / VIN", "md:col-span-2")}
        <label>
          <span className="text-[10px] font-bold uppercase tracking-wider text-[#5a7086]">{t("Prix")}</span>
          <NumField value={r.price} onChange={(n) => setR({ ...r, price: n })} className="!h-8 mt-0.5" />
        </label>
        <label>
          <span className="text-[10px] font-bold uppercase tracking-wider text-[#5a7086]">{t("Km")}</span>
          <NumField value={r.kms} decimals={0} onChange={(n) => setR({ ...r, kms: n })} className="!h-8 mt-0.5" />
        </label>
        {fld("extColor", "Couleur ext.")}
        <label>
          <span className="text-[10px] font-bold uppercase tracking-wider text-[#5a7086]">{t("État")}</span>
          <select className="fld !h-8 mt-0.5" value={r.condition} onChange={(e) => setR({ ...r, condition: e.target.value })}>
            <option value="NEUF">{t("NEUF")}</option>
            <option value="USAGÉ">{t("USAGÉ")}</option>
            <option value="DÉMO">{t("DÉMO")}</option>
          </select>
        </label>
        <label>
          <span className="text-[10px] font-bold uppercase tracking-wider text-[#5a7086]">{t("Statut")}</span>
          <select className="fld !h-8 mt-0.5" value={r.status} onChange={(e) => setR({ ...r, status: e.target.value })}>
            <option value="available">{t("Disponible")}</option>
            <option value="hold">{t("Réservé")}</option>
            <option value="employee">{t("Véhicule d'employé")}</option>
            <option value="sold">{t("Vendu")}</option>
          </select>
        </label>
        {r.status === "employee" && (
          <label className="md:col-span-2">
            <span className="text-[10px] font-bold uppercase tracking-wider text-violet-700">{t("Employé")}</span>
            <select className="fld !h-8 mt-0.5 !border-violet-400" value={r.employeeName ?? ""} onChange={(e) => setR({ ...r, employeeName: e.target.value })}>
              <option value="">— {t("Choisir un employé")} —</option>
              {r.employeeName && !staff.includes(r.employeeName) && <option value={r.employeeName}>{r.employeeName}</option>}
              {staff.map((n) => <option key={n} value={n}>{n}</option>)}
            </select>
          </label>
        )}
      </div>
      <div className="flex gap-2">
        <button className="btn btn-primary" onClick={() => onSave(r)} disabled={r.status === "employee" && !r.employeeName}>{t("Enregistrer")}</button>
        <button className="btn" onClick={onCancel}>{t("Annuler")}</button>
        {r.status === "employee" && !r.employeeName && <span className="text-[12px] text-violet-700 self-center">{t("Choisissez l'employé qui utilise ce véhicule.")}</span>}
      </div>
    </div>
  );
}
