"use client";

import { useLang } from "@/lib/i18n";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { fmtDesk, FREQ_LABEL_FR, type Frequency } from "@/lib/deal";

export interface DealRow {
  id: number;
  dealNumber: string;
  customerName: string;
  vehicleLabel: string;
  dealType: string;
  status: string;
  updatedAt: string;
  createdAt: string;
  payment?: number;
  frequency?: Frequency;
  payment2?: number | null;
  frequency2?: Frequency;
  term?: number | null;
  lender?: string | null;
  quoteNumber?: string;
  salesperson?: string;
  fiManager?: string;
  vehicleStock?: string;
  customerPhone?: string;
  gross?: number;
}

const TYPE_LABEL: Record<string, string> = { cash: "Comptant", finance: "Financement", lease: "Location" };
const TYPE_STYLE: Record<string, string> = {
  lease: "bg-sky-50 text-sky-700 ring-sky-600/30",
  finance: "bg-[#e6f1fa] text-[#005a96] ring-[#0071bc]/30",
  cash: "bg-slate-100 text-slate-700 ring-slate-500/30",
};
const STATUS_LABEL: Record<string, string> = { open: "Ouvert", pending: "En attente", sold: "Vendu", lost: "Perdu" };
const STATUS_STYLE: Record<string, string> = {
  open: "bg-[#e6f1fa] text-[#005a96] ring-[#0071bc]/30",
  pending: "bg-amber-50 text-amber-800 ring-amber-600/30",
  sold: "bg-emerald-50 text-emerald-700 ring-emerald-600/30",
  lost: "bg-red-50 text-red-700 ring-red-600/30",
};
const initials = (n: string) =>
  n
    .split(/[\s-]+/)
    .filter(Boolean)
    .map((w) => w[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

export default function DealList({ initial }: { initial: DealRow[] }) {
  const { t, lang } = useLang();
  const router = useRouter();
  const loc = lang === "fr" ? "fr-CA" : "en-CA";
  const [rows, setRows] = useState(initial);
  const [q, setQ] = useState("");
  const [type, setType] = useState("");
  const [status, setStatus] = useState("");
  const [seller, setSeller] = useState("");
  const [onlyQuotes, setOnlyQuotes] = useState(false);
  const [sort, setSort] = useState("recent");
  const [busy, setBusy] = useState(false);

  const sellers = useMemo(() => Array.from(new Set(rows.map((r) => r.salesperson?.trim()).filter(Boolean) as string[])).sort(), [rows]);

  const filtered = useMemo(() => {
    const s = q.toLowerCase().trim();
    const list = rows.filter(
      (r) =>
        (!type || r.dealType === type) &&
        (!status || r.status === status) &&
        (!seller || (seller === "__none" ? !r.salesperson?.trim() : r.salesperson === seller)) &&
        (!onlyQuotes || !!r.quoteNumber) &&
        (!s ||
          `${r.dealNumber} ${r.quoteNumber ?? ""} ${r.customerName} ${r.vehicleLabel} ${r.vehicleStock ?? ""} ${r.salesperson ?? ""} ${r.customerPhone ?? ""}`
            .toLowerCase()
            .includes(s)),
    );
    const cmp: Record<string, (a: DealRow, b: DealRow) => number> = {
      recent: (a, b) => b.updatedAt.localeCompare(a.updatedAt),
      created: (a, b) => b.createdAt.localeCompare(a.createdAt),
      customer: (a, b) => (a.customerName || "~").localeCompare(b.customerName || "~"),
      seller: (a, b) => (a.salesperson || "~").localeCompare(b.salesperson || "~"),
      payDesc: (a, b) => (b.payment ?? 0) - (a.payment ?? 0),
    };
    return [...list].sort(cmp[sort] ?? cmp.recent);
  }, [rows, q, type, status, seller, onlyQuotes, sort]);

  const stats = useMemo(() => {
    const monthKey = new Date().toISOString().slice(0, 7);
    return {
      total: rows.length,
      open: rows.filter((r) => r.status === "open" || r.status === "pending").length,
      sold: rows.filter((r) => r.status === "sold").length,
      month: rows.filter((r) => r.createdAt.slice(0, 7) === monthKey).length,
      sellers: sellers.length,
    };
  }, [rows, sellers]);

  async function create(duplicateOf?: number) {
    setBusy(true);
    const res = await fetch("/api/deals", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ duplicateOf }),
    });
    const j = await res.json();
    router.push(`/deals/${j.id}`);
  }

  async function remove(id: number) {
    if (!confirm(t("Supprimer ce dossier ?"))) return;
    await fetch(`/api/deals/${id}`, { method: "DELETE" });
    setRows((r) => r.filter((x) => x.id !== id));
  }

  const activeFilters = [q, type, status, seller].filter(Boolean).length + (onlyQuotes ? 1 : 0);
  const lbl = "text-[10px] font-bold uppercase tracking-wider text-[#5a7086]";

  return (
    <div className="space-y-4">
      {/* header */}
      <div className="rounded-md overflow-hidden shadow-[0_2px_8px_rgba(0,38,61,0.15)]">
        <div className="bg-gradient-to-r from-[#00263d] via-[#003a5d] to-[#0a5a8c] text-white px-6 py-4 flex flex-wrap items-center gap-4">
          <div className="flex-1 min-w-[220px]">
            <h1 className="text-[22px] font-bold tracking-tight">{t("Quotations")}</h1>
            <p className="text-[12.5px] text-[#b9d2e5]">{t("Toutes les soumissions de location, financement et comptant — sauvegarde automatique.")}</p>
          </div>
          <button className="h-10 rounded-md bg-[#0071bc] hover:bg-[#1a80c6] ring-1 ring-white/30 px-5 text-[13px] font-bold" disabled={busy} onClick={() => create()}>
            + {t("Nouveau Quotation")}
          </button>
        </div>
        <div className="bg-white grid grid-cols-2 md:grid-cols-5 divide-x divide-[#e3eaf1]">
          {[
            [t("Total"), String(stats.total), "text-[#00263d]"],
            [t("Ouverts / en attente"), String(stats.open), "text-[#0071bc]"],
            [t("Vendus"), String(stats.sold), "text-emerald-700"],
            [t("Créés ce mois-ci"), String(stats.month), "text-[#00263d]"],
            [t("Vendeurs actifs"), String(stats.sellers), "text-[#00263d]"],
          ].map(([k, v, c]) => (
            <div key={k} className="px-4 py-3">
              <div className={lbl}>{k}</div>
              <div className={`text-[19px] font-bold tabular-nums ${c}`}>{v}</div>
            </div>
          ))}
        </div>
      </div>

      {/* filters */}
      <div className="bg-white rounded-md border border-[#cbd8e3] shadow-[0_1px_3px_rgba(0,38,61,0.08)] p-3">
        <div className="flex flex-wrap items-end gap-2">
          <label className="flex-1 min-w-[240px]">
            <span className={lbl}>{t("Recherche")}</span>
            <input className="fld !h-9 mt-0.5" placeholder={t("Client, véhicule, # stock, # dossier, # offre, vendeur…")} value={q} onChange={(e) => setQ(e.target.value)} />
          </label>
          <label>
            <span className={lbl}>{t("Vendeur")}</span>
            <select className="fld !h-9 !w-48 mt-0.5" value={seller} onChange={(e) => setSeller(e.target.value)}>
              <option value="">{t("Tous les vendeurs")}</option>
              {sellers.map((n) => <option key={n} value={n}>{n}</option>)}
              <option value="__none">{t("Non assigné")}</option>
            </select>
          </label>
          <label>
            <span className={lbl}>{t("Type")}</span>
            <select className="fld !h-9 !w-36 mt-0.5" value={type} onChange={(e) => setType(e.target.value)}>
              <option value="">{t("Tous")}</option>
              <option value="lease">{t("Location")}</option>
              <option value="finance">{t("Financement")}</option>
              <option value="cash">{t("Comptant")}</option>
            </select>
          </label>
          <label>
            <span className={lbl}>{t("Statut")}</span>
            <select className="fld !h-9 !w-36 mt-0.5" value={status} onChange={(e) => setStatus(e.target.value)}>
              <option value="">{t("Tous")}</option>
              {Object.entries(STATUS_LABEL).map(([k, v]) => <option key={k} value={k}>{t(v)}</option>)}
            </select>
          </label>
          <label>
            <span className={lbl}>{t("Trier par")}</span>
            <select className="fld !h-9 !w-48 mt-0.5 font-semibold" value={sort} onChange={(e) => setSort(e.target.value)}>
              <option value="recent">{t("Modifiés récemment")}</option>
              <option value="created">{t("Créés récemment")}</option>
              <option value="customer">{t("Client (A → Z)")}</option>
              <option value="seller">{t("Vendeur (A → Z)")}</option>
              <option value="payDesc">{t("Paiement le plus élevé")}</option>
            </select>
          </label>
          <label className="flex items-center gap-1.5 h-9 text-[13px] text-[#1e3a50]">
            <input type="checkbox" checked={onlyQuotes} onChange={(e) => setOnlyQuotes(e.target.checked)} /> {t("Offres AI seulement")}
          </label>
        </div>
        <div className="flex items-center gap-3 mt-2 text-[12px] text-[#5a7086]">
          <span>
            <b className="text-[#00263d]">{filtered.length}</b> {t("soumission(s)")}
          </span>
          {activeFilters > 0 && (
            <button
              className="text-[#0071bc] hover:underline"
              onClick={() => {
                setQ(""); setType(""); setStatus(""); setSeller(""); setOnlyQuotes(false);
              }}
            >
              {t("Réinitialiser les filtres")}
            </button>
          )}
        </div>
      </div>

      {/* table */}
      <div className="bg-white rounded-md border border-[#cbd8e3] shadow-[0_1px_3px_rgba(0,38,61,0.08)] overflow-x-auto">
        <table className="w-full text-[13px]">
          <thead>
            <tr className="bg-[#f4f7fa] text-[10.5px] uppercase tracking-wider text-[#5a7086] border-b border-[#e3eaf1]">
              <th className="text-left px-4 py-2.5 font-bold">{t("# Quotation")}</th>
              <th className="text-left px-3 py-2.5 font-bold">{t("Client")}</th>
              <th className="text-left px-3 py-2.5 font-bold">{t("Véhicule")}</th>
              <th className="text-left px-3 py-2.5 font-bold">{t("Vendeur")}</th>
              <th className="text-left px-3 py-2.5 font-bold">{t("Type")}</th>
              <th className="text-right px-3 py-2.5 font-bold">{t("Paiement")}</th>
              <th className="text-left px-3 py-2.5 font-bold">{t("Statut")}</th>
              <th className="text-left px-3 py-2.5 font-bold">{t("Modifié")}</th>
              <th className="text-right px-4 py-2.5 font-bold">{t("Actions")}</th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 && (
              <tr>
                <td colSpan={9} className="text-center py-12 text-[#5a7086]">
                  <div className="font-semibold text-[#00263d]">{rows.length ? t("Aucune soumission ne correspond aux filtres.") : t("Aucune soumission pour l'instant.")}</div>
                  {!rows.length && <button className="btn btn-primary mt-3" onClick={() => create()}>+ {t("Nouveau Quotation")}</button>}
                </td>
              </tr>
            )}
            {filtered.map((r) => (
              <tr
                key={r.id}
                className="border-b border-[#eef3f7] hover:bg-[#f4f8fb] cursor-pointer"
                onClick={(e) => {
                  if ((e.target as HTMLElement).closest("button")) return;
                  router.push(`/deals/${r.id}`);
                }}
                title={t("Cliquer pour ouvrir le dossier")}
              >
                <td className="px-4 py-2.5">
                  <div className="font-mono font-semibold text-[#00263d]">{r.dealNumber}</div>
                  {r.quoteNumber && (
                    <span className="text-[10px] font-semibold px-1.5 py-0.5 bg-[#e6f1fa] text-[#005a96] rounded-sm" title={t("Converti d'une offre AI")}>
                      {r.quoteNumber}
                    </span>
                  )}
                </td>
                <td className="px-3 py-2.5">
                  <div className="font-semibold text-[#00263d]">{r.customerName || <em className="font-normal text-[#93a8ba]">{t("(sans nom)")}</em>}</div>
                  {r.customerPhone && <div className="text-[11.5px] text-[#5a7086] tabular-nums">{r.customerPhone}</div>}
                </td>
                <td className="px-3 py-2.5 max-w-[260px]">
                  <div className="truncate text-[#1e3a50]">{r.vehicleLabel || "—"}</div>
                  {r.vehicleStock && <div className="text-[11px] text-[#5a7086] font-mono">#{r.vehicleStock}</div>}
                </td>
                <td className="px-3 py-2.5">
                  {r.salesperson ? (
                    <div className="flex items-center gap-2">
                      <span className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[#0071bc] text-white text-[10.5px] font-bold">{initials(r.salesperson)}</span>
                      <div className="min-w-0">
                        <div className="text-[12.5px] font-semibold text-[#00263d] truncate max-w-[150px]">{r.salesperson}</div>
                        {r.fiManager && r.fiManager !== r.salesperson && <div className="text-[10.5px] text-[#5a7086] truncate max-w-[150px]">F&A : {r.fiManager}</div>}
                      </div>
                    </div>
                  ) : (
                    <span className="text-[12px] text-[#93a8ba]">{t("Non assigné")}</span>
                  )}
                </td>
                <td className="px-3 py-2.5">
                  <span className={`inline-flex rounded-full px-2 py-0.5 text-[10.5px] font-bold ring-1 ring-inset ${TYPE_STYLE[r.dealType] ?? TYPE_STYLE.cash}`}>{t(TYPE_LABEL[r.dealType] ?? r.dealType)}</span>
                </td>
                <td className="px-3 py-2.5 text-right whitespace-nowrap">
                  {r.payment !== undefined ? (
                    <>
                      <div className="font-bold tabular-nums text-[#0071bc]">{fmtDesk(r.payment)} $</div>
                      <div className="text-[11px] text-[#5a7086]">
                        {r.dealType === "cash" ? t("Solde à payer") : `${t(FREQ_LABEL_FR[r.frequency ?? "monthly"])}${r.term ? ` · ${r.term} ${t("mois")}` : ""}`}
                      </div>
                      {r.lender && r.dealType !== "cash" && <div className="text-[10.5px] text-[#93a8ba] truncate max-w-[170px] ml-auto">{r.lender}</div>}
                    </>
                  ) : (
                    "—"
                  )}
                </td>
                <td className="px-3 py-2.5">
                  <span className={`inline-flex rounded-full px-2 py-0.5 text-[10.5px] font-bold ring-1 ring-inset ${STATUS_STYLE[r.status] ?? STATUS_STYLE.open}`}>{t(STATUS_LABEL[r.status] ?? r.status)}</span>
                </td>
                <td className="px-3 py-2.5 text-[12px] text-[#5a7086] whitespace-nowrap">{new Date(r.updatedAt).toLocaleString(loc, { dateStyle: "medium", timeStyle: "short" })}</td>
                <td className="px-4 py-2.5 text-right whitespace-nowrap space-x-1">
                  <button className="btn !py-1" onClick={() => window.open(`/deals/${r.id}/documents/all?lang=${lang}`, "_blank")}>{t("Imprimer")}</button>
                  <button className="btn !py-1" disabled={busy} onClick={() => create(r.id)}>{t("Dupliquer")}</button>
                  <button className="btn btn-danger !py-1" onClick={() => remove(r.id)}>✕</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
