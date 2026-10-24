"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, type ReactNode } from "react";
import { FREQ_LABEL_FR, type Frequency } from "@/lib/deal";
import { useLang } from "@/lib/i18n";

export interface DashboardData {
  totals: {
    deals: number;
    monthCreated: number;
    monthSold: number;
    monthGross: number;
    grossSold: number;
    grossPipeline: number;
    avgGross: number;
    closeRate: number;
    front: number;
    back: number;
  };
  status: Record<string, number>;
  byType: Record<string, number>;
  monthly: { month: string; created: number; sold: number; gross: number }[];
  lenders: { name: string; count: number }[];
  people: { name: string; deals: number; sold: number; gross: number }[];
  recent: {
    id: number;
    dealNumber: string;
    customer: string;
    vehicle: string;
    type: string;
    status: string;
    payment: number;
    frequency: Frequency;
    gross: number;
    updatedAt: string;
  }[];
  inventory: {
    count: number;
    value: number;
    newCount: number;
    usedCount: number;
    avgDays: number;
    over60: number;
    oldest: { id: number; label: string; stock: string; price: number; kms: number; days: number }[];
  };
}

const TYPE_LABEL: Record<string, string> = { cash: "Comptant", finance: "Financement", lease: "Location" };
const STATUS_LABEL: Record<string, string> = { open: "Ouvert", pending: "En attente", sold: "Vendu", lost: "Perdu" };
const STATUS_COLOR: Record<string, string> = { open: "#0071bc", pending: "#e0a100", sold: "#2e9a57", lost: "#c0392b" };
const TYPE_COLOR: Record<string, string> = { cash: "#5a7086", finance: "#0071bc", lease: "#0b9bb5" };

function Panel({ title, action, children }: { title: string; action?: ReactNode; children: ReactNode }) {
  return (
    <div className="win">
      <div className="win-title h-8 px-3 flex items-center text-[13px]">
        <span>{title}</span>
        <span className="ml-auto">{action}</span>
      </div>
      <div className="p-3">{children}</div>
    </div>
  );
}

export default function DashboardView({ data }: { data: DashboardData }) {
  const { t, lang } = useLang();
  const router = useRouter();
  const [creating, setCreating] = useState(false);
  const loc = lang === "fr" ? "fr-CA" : "en-CA";
  const money = (n: number, dec = 0) =>
    n.toLocaleString(loc, { style: "currency", currency: "CAD", minimumFractionDigits: dec, maximumFractionDigits: dec });
  const num = (n: number) => n.toLocaleString(loc, { maximumFractionDigits: 0 });
  const T = data.totals;

  async function newDeal() {
    setCreating(true);
    const r = await fetch("/api/deals", { method: "POST", headers: { "Content-Type": "application/json" }, body: "{}" });
    const j = await r.json();
    router.push(`/deals/${j.id}`);
  }

  const kpis: { label: string; value: string; sub: string; color: string }[] = [
    { label: t("Dossiers ce mois-ci"), value: num(T.monthCreated), sub: `${num(T.deals)} ${t("au total")}`, color: "#0071bc" },
    { label: t("Ventes ce mois-ci"), value: num(T.monthSold), sub: `${T.closeRate.toFixed(0)}% ${t("taux de conclusion")}`, color: "#2e9a57" },
    { label: t("Profit brut ce mois-ci"), value: money(T.monthGross), sub: `${t("Moy. / vente")} ${money(T.avgGross)}`, color: "#0b9bb5" },
    { label: t("Profit potentiel (en cours)"), value: money(T.grossPipeline), sub: `${num((data.status.open ?? 0) + (data.status.pending ?? 0))} ${t("dossiers ouverts")}`, color: "#e0a100" },
    { label: t("Inventaire disponible"), value: num(data.inventory.count), sub: money(data.inventory.value), color: "#6c4bd1" },
  ];

  const maxCreated = Math.max(1, ...data.monthly.map((m) => Math.max(m.created, m.sold)));
  const maxGross = Math.max(1, ...data.monthly.map((m) => m.gross));
  const statusTotal = Math.max(1, Object.values(data.status).reduce((a, b) => a + b, 0));
  const typeTotal = Math.max(1, Object.values(data.byType).reduce((a, b) => a + b, 0));
  const maxLender = Math.max(1, ...data.lenders.map((l) => l.count));
  const monthName = (m: string) => {
    const [y, mo] = m.split("-").map(Number);
    return new Date(y, mo - 1, 1).toLocaleDateString(loc, { month: "short" });
  };

  // donut for deal types
  let acc = 0;
  const donut = (["finance", "lease", "cash"] as const)
    .map((k) => {
      const v = data.byType[k] ?? 0;
      const start = (acc / typeTotal) * 360;
      acc += v;
      return `${TYPE_COLOR[k]} ${start}deg ${(acc / typeTotal) * 360}deg`;
    })
    .join(", ");

  return (
    <div className="space-y-4">
      {/* Quick actions */}
      <div className="flex flex-wrap items-center gap-2">
        <button className="btn btn-primary !py-2 !px-4" onClick={newDeal} disabled={creating}>
          + {creating ? t("Création…") : t("Nouveau dossier")}
        </button>
        <Link href="/inventory" className="btn !py-2 !px-4">{t("Importer l'inventaire")}</Link>
        <Link href="/deals" className="btn !py-2 !px-4">{t("Gestionnaire de dossiers")}</Link>
        <Link href="/lenders" className="btn !py-2 !px-4">{t("Taux des prêteurs")}</Link>
      </div>

      {/* KPI cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-5 gap-3">
        {kpis.map((k) => (
          <div key={k.label} className="kpi" style={{ ["--kpi" as string]: k.color }}>
            <div className="text-[11px] uppercase tracking-wider text-[#5a7086] font-semibold">{k.label}</div>
            <div className="text-[24px] font-bold text-[#00263d] tabular-nums mt-1">{k.value}</div>
            <div className="text-[12px] text-[#5a7086] mt-0.5">{k.sub}</div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
        {/* Monthly activity */}
        <div className="xl:col-span-2">
          <Panel title={t("Activité — 6 derniers mois")}>
            <div className="flex items-end gap-4 h-48 px-2">
              {data.monthly.map((m) => (
                <div key={m.month} className="flex-1 flex flex-col items-center gap-1 h-full">
                  <div className="flex-1 w-full flex items-end justify-center gap-1">
                    <div className="w-1/3 bg-[#9cc9ea]" style={{ height: `${(m.created / maxCreated) * 100}%` }} title={`${t("Dossiers")}: ${m.created}`} />
                    <div className="w-1/3 bg-[#2e9a57]" style={{ height: `${(m.sold / maxCreated) * 100}%` }} title={`${t("Vendus")}: ${m.sold}`} />
                  </div>
                  <div className="text-[11px] text-[#1e3a50] font-semibold capitalize">{monthName(m.month)}</div>
                  <div className="text-[10px] text-[#5a7086] tabular-nums">{money(m.gross)}</div>
                </div>
              ))}
            </div>
            <div className="flex gap-4 text-[11px] text-[#1e3a50] mt-2 px-2">
              <span><span className="inline-block w-3 h-3 bg-[#9cc9ea] align-middle mr-1" />{t("Dossiers créés")}</span>
              <span><span className="inline-block w-3 h-3 bg-[#2e9a57] align-middle mr-1" />{t("Vendus")}</span>
              <span className="ml-auto">{t("Profit brut par mois")} · max {money(maxGross)}</span>
            </div>
          </Panel>
        </div>

        {/* Deal mix */}
        <Panel title={t("Répartition des dossiers")}>
          <div className="flex items-center gap-4">
            <div
              className="w-28 h-28 rounded-full shrink-0 relative"
              style={{ background: typeTotal ? `conic-gradient(${donut})` : "#e3e3e3" }}
            >
              <div className="absolute inset-4 rounded-full bg-[#e9eff4] flex flex-col items-center justify-center">
                <div className="text-[20px] font-bold text-[#00263d]">{num(T.deals)}</div>
                <div className="text-[10px] text-[#5a7086]">{t("dossiers")}</div>
              </div>
            </div>
            <div className="space-y-1 text-[13px] flex-1">
              {(["finance", "lease", "cash"] as const).map((k) => (
                <div key={k} className="flex items-center gap-2">
                  <span className="w-3 h-3 inline-block" style={{ background: TYPE_COLOR[k] }} />
                  <span className="flex-1 text-[#1e3a50]">{t(TYPE_LABEL[k])}</span>
                  <b className="tabular-nums">{data.byType[k] ?? 0}</b>
                </div>
              ))}
            </div>
          </div>
          <div className="mt-4 space-y-1.5">
            {(["open", "pending", "sold", "lost"] as const).map((k) => (
              <div key={k} className="flex items-center gap-2 text-[12px]">
                <span className="w-20 text-[#1e3a50]">{t(STATUS_LABEL[k])}</span>
                <div className="flex-1 h-3 bg-[#e3e3e3]">
                  <div className="h-full" style={{ width: `${((data.status[k] ?? 0) / statusTotal) * 100}%`, background: STATUS_COLOR[k] }} />
                </div>
                <span className="w-6 text-right tabular-nums font-semibold">{data.status[k] ?? 0}</span>
              </div>
            ))}
          </div>
        </Panel>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
        {/* Recent deals */}
        <div className="xl:col-span-2">
          <Panel title={t("Dossiers récents")} action={<Link href="/deals" className="text-[12px] text-[#cfe3f2] hover:text-white">{t("Voir tout")} →</Link>}>
            <div className="overflow-x-auto -m-3">
              <table className="grid-table w-full text-left">
                <thead>
                  <tr>
                    <th>#</th>
                    <th>{t("Client")}</th>
                    <th>{t("Véhicule")}</th>
                    <th>{t("Type")}</th>
                    <th className="text-right">{t("Paiement")}</th>
                    <th className="text-right">{t("Profit brut")}</th>
                    <th>{t("Statut")}</th>
                  </tr>
                </thead>
                <tbody>
                  {data.recent.length === 0 && (
                    <tr>
                      <td colSpan={7} className="text-center py-6 text-[#003a5d]">{t("Aucun dossier pour l'instant.")}</td>
                    </tr>
                  )}
                  {data.recent.map((r) => (
                    <tr key={r.id} className="hover:bg-white cursor-pointer" onClick={() => router.push(`/deals/${r.id}`)}>
                      <td className="font-mono text-[12px]">{r.dealNumber}</td>
                      <td>{r.customer || <em className="text-slate-500">{t("(sans nom)")}</em>}</td>
                      <td className="max-w-[220px] truncate">{r.vehicle || "—"}</td>
                      <td>{t(TYPE_LABEL[r.type] ?? r.type)}</td>
                      <td className="text-right tabular-nums">
                        {money(r.payment, 2)}
                        {r.type !== "cash" && <span className="text-[10px] text-[#5a7086]"> / {t(FREQ_LABEL_FR[r.frequency])}</span>}
                      </td>
                      <td className={`text-right tabular-nums font-semibold ${r.gross < 0 ? "text-red-700" : "text-green-800"}`}>{money(r.gross)}</td>
                      <td>
                        <span className="text-[11px] px-1.5 py-0.5 text-white" style={{ background: STATUS_COLOR[r.status] ?? "#5a7086" }}>
                          {t(STATUS_LABEL[r.status] ?? r.status)}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Panel>
        </div>

        {/* Gross summary + lenders */}
        <div className="space-y-4">
          <Panel title={t("Profit des ventes conclues")}>
            <div className="space-y-1.5 text-[13px]">
              <div className="flex justify-between"><span className="text-[#1e3a50]">{t("Profit avant (Front)")}</span><b className="tabular-nums">{money(T.front)}</b></div>
              <div className="flex justify-between"><span className="text-[#1e3a50]">{t("Profit arrière (Back / F&A)")}</span><b className="tabular-nums">{money(T.back)}</b></div>
              <div className="flex justify-between border-t border-[#bccbd8] pt-1.5"><span className="text-[#005a96] font-bold">{t("PROFIT BRUT TOTAL")}</span><b className="tabular-nums text-[#005a96]">{money(T.grossSold)}</b></div>
            </div>
          </Panel>
          <Panel title={t("Prêteurs les plus utilisés")}>
            {data.lenders.length === 0 ? (
              <div className="text-[12px] text-[#003a5d]">{t("Aucun dossier de financement ou de location.")}</div>
            ) : (
              <div className="space-y-1.5">
                {data.lenders.map((l) => (
                  <div key={l.name} className="flex items-center gap-2 text-[12px]">
                    <span className="w-24 truncate text-[#1e3a50] font-semibold">{l.name}</span>
                    <div className="flex-1 h-3 bg-[#e3e3e3]"><div className="h-full bg-[#0071bc]" style={{ width: `${(l.count / maxLender) * 100}%` }} /></div>
                    <span className="w-6 text-right tabular-nums">{l.count}</span>
                  </div>
                ))}
              </div>
            )}
          </Panel>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
        {/* Inventory aging */}
        <div className="xl:col-span-2">
          <Panel title={t("Inventaire — véhicules les plus anciens")} action={<Link href="/inventory" className="text-[12px] text-[#cfe3f2] hover:text-white">{t("Voir tout")} →</Link>}>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mb-3">
              {[
                [t("Disponibles"), num(data.inventory.count)],
                [t("Neufs / Usagés"), `${data.inventory.newCount} / ${data.inventory.usedCount}`],
                [t("Jours moyens en stock"), data.inventory.avgDays.toFixed(0)],
                [t("Plus de 60 jours"), num(data.inventory.over60)],
              ].map(([l, v]) => (
                <div key={l} className="bg-white border border-[#ccd8e3] px-2 py-1.5">
                  <div className="text-[10px] uppercase tracking-wider text-[#5a7086]">{l}</div>
                  <div className="text-[17px] font-bold text-[#00263d] tabular-nums">{v}</div>
                </div>
              ))}
            </div>
            {data.inventory.oldest.length === 0 ? (
              <div className="text-[12px] text-[#003a5d]">{t("Aucun véhicule. Collez une liste ci-dessus pour remplir l'inventaire.")}</div>
            ) : (
              <table className="grid-table w-full text-left -mx-0">
                <thead>
                  <tr>
                    <th>{t("# Stock")}</th>
                    <th>{t("Véhicule")}</th>
                    <th className="text-right">{t("Km")}</th>
                    <th className="text-right">{t("Prix")}</th>
                    <th className="text-right">{t("Jours")}</th>
                  </tr>
                </thead>
                <tbody>
                  {data.inventory.oldest.map((v) => (
                    <tr key={v.id}>
                      <td className="font-mono font-semibold">{v.stock || "—"}</td>
                      <td>{v.label}</td>
                      <td className="text-right tabular-nums">{num(v.kms)}</td>
                      <td className="text-right tabular-nums">{money(v.price)}</td>
                      <td className={`text-right tabular-nums font-semibold ${v.days > 60 ? "text-red-700" : v.days > 30 ? "text-amber-700" : "text-green-800"}`}>{v.days}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </Panel>
        </div>

        {/* Salespeople */}
        <Panel title={t("Classement des vendeurs")}>
          {data.people.length === 0 ? (
            <div className="text-[12px] text-[#003a5d]">{t("Aucun dossier pour l'instant.")}</div>
          ) : (
            <table className="w-full text-[13px]">
              <thead>
                <tr className="text-[11px] uppercase tracking-wider text-[#5a7086]">
                  <th className="text-left pb-1">{t("Vendeur")}</th>
                  <th className="text-right pb-1">{t("Dossiers")}</th>
                  <th className="text-right pb-1">{t("Vendus")}</th>
                  <th className="text-right pb-1">{t("Profit brut")}</th>
                </tr>
              </thead>
              <tbody>
                {data.people.map((p, i) => (
                  <tr key={p.name} className="border-t border-[#ccd8e3]">
                    <td className="py-1"><span className="text-[#5a7086] mr-1">{i + 1}.</span>{p.name}</td>
                    <td className="text-right tabular-nums">{p.deals}</td>
                    <td className="text-right tabular-nums">{p.sold}</td>
                    <td className="text-right tabular-nums font-semibold">{money(p.gross)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </Panel>
      </div>
    </div>
  );
}
