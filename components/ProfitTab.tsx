"use client";

import { useT } from "@/lib/i18n";
import type { DeskProps } from "./DealDesk";
import { NumField, SecHead } from "./fields";
import { DEFAULT_SETTINGS, fmtDesk, type DealData, type ProfitRow } from "@/lib/deal";

/** pct / commission setters per row kind */
function setPct(d: DealData, r: ProfitRow, n: number) {
  if (r.kind === "vehicle") d.profit.pct.vehicle = n;
  else if (r.kind === "accessories") d.profit.pct.accessories = n;
  else if (r.kind === "product" && r.productIndex !== undefined) d.products[r.productIndex].pct = n;
}
function setCom(d: DealData, r: ProfitRow, n: number) {
  if (r.kind === "vehicle") d.profit.commission.vehicle = n;
  else if (r.kind === "accessories") d.profit.commission.accessories = n;
  else if (r.kind === "fees") d.profit.commission.fees = n;
  else if (r.productIndex !== undefined) d.products[r.productIndex].commission = n;
}

export default function ProfitTab({ data, upd, calc, settings }: DeskProps) {
  const t = useT();
  const pf = calc.profit;
  const maxGross = Math.max(1, ...pf.rows.map((r) => Math.abs(r.gross)));
  const defaults = { ...DEFAULT_SETTINGS.profitPct, ...(settings.profitPct ?? {}) };
  const veh = pf.rows.find((r) => r.key === "vehicle")!;

  return (
    <div className="win">
      <div className="win-title h-7 text-right pr-4 text-[15px] leading-7">{t("Analyse de profit")}</div>

      {/* Vehicle summary — cost always = MSRP − % */}
      <SecHead title={t("Profit véhicule")}>
        <span className="text-xs text-[#1e3a50]">{t("Coût")} = {t("PDSF / MSRP")} − {veh.pct}% · Profit = {t("Prix de vente")} − {t("Coût")} ({t("calcul automatique")})</span>
      </SecHead>
      <div className="grid grid-cols-2 md:grid-cols-6 gap-2 p-3 items-end">
        <div>
          <div className="lbl text-xs">{t("PDSF / MSRP")}</div>
          <NumField value={veh.base} readOnly />
        </div>
        <div>
          <div className="lbl text-xs">{t("% sous PDSF")}</div>
          <NumField value={veh.pct} onChange={(n) => upd((d) => void (d.profit.pct.vehicle = n))} suffix=" %" className="!bg-[#fffbe0] font-semibold" />
        </div>
        <div>
          <div className="lbl text-xs">{t("Coût véhicule")}</div>
          <NumField value={veh.cost} readOnly />
        </div>
        <div>
          <div className="lbl text-xs">{t("Réduction")}</div>
          <NumField
            value={data.pricing.reduction}
            commitOnBlur
            onChange={(n) => {
              const max = (calc.msrp * (settings.maxDiscountPct ?? 3)) / 100;
              if (n > max + 0.005 && n > (data.reductionApproved ?? 0) + 0.005) {
                alert(t("Rabais supérieur à la limite — modifiez-le dans l'onglet Achat pour obtenir l'approbation du gestionnaire."));
                return;
              }
              upd((d) => void (d.pricing.reduction = n));
            }}
          />
        </div>
        <div>
          <div className="lbl text-xs">{t("Prix de vente")}</div>
          <NumField value={veh.price} readOnly />
        </div>
        <div>
          <div className="lbl text-xs font-bold">{t("Profit véhicule")}</div>
          <NumField value={veh.gross} readOnly hl className="font-bold" />
        </div>
      </div>

      <SecHead title={t("Profit par produit")}>
        <span className="text-xs text-[#1e3a50]">{t("Coût = Base − %. Modifiez le % (jaune) — le coût et le profit se recalculent.")}</span>
      </SecHead>
      <div className="p-3 overflow-x-auto">
        <table className="w-full min-w-[880px] text-[13px]">
          <thead>
            <tr className="text-white text-left">
              {["Produit", "Base", "Montant base", "%", "Coût", "Prix de vente", "Profit brut", "Comm. %", "Comm. $"].map((h, i) => (
                <th key={i} className="sec-tab !text-[12px] !px-2 !py-1 font-medium">{t(h)}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {pf.rows.map((r) => (
              <tr key={r.key} className="border-b border-[#ccd8e3]">
                <td className="lbl py-1 pr-2 font-semibold">
                  {t(r.label)}
                  <div className="text-[10px] font-normal text-[#5a7086]">
                    {r.group === "front" ? t("Profit avant") : r.group === "back" ? t("Profit arrière") : t("Frais de concession")}
                  </div>
                </td>
                <td className="text-[12px] text-[#1e3a50] px-1">{t(r.baseLabel)}</td>
                <td className="w-[115px] px-1"><NumField value={r.base} readOnly /></td>
                <td className="w-[90px] px-1">
                  {r.kind === "fees" ? (
                    <NumField value={100} readOnly suffix=" %" />
                  ) : (
                    <NumField value={r.pct} onChange={(n) => upd((d) => setPct(d, r, n))} suffix=" %" className="!bg-[#fffbe0] font-semibold" />
                  )}
                </td>
                <td className="w-[115px] px-1"><NumField value={r.cost} readOnly /></td>
                <td className="w-[115px] px-1">
                  <NumField value={r.price} readOnly />
                  {r.addition ? <div className="text-[10px] text-green-800">+ holdback {fmtDesk(r.addition)}</div> : null}
                </td>
                <td className="w-[115px] px-1">
                  <NumField value={r.gross} readOnly className={`font-semibold ${r.gross < 0 ? "!text-red-700" : "!text-green-800"}`} />
                </td>
                <td className="w-[80px] px-1">
                  <NumField value={r.commissionPct} onChange={(n) => upd((d) => setCom(d, r, n))} suffix=" %" />
                </td>
                <td className="w-[100px] px-1"><NumField value={r.commission} readOnly /></td>
              </tr>
            ))}
          </tbody>
        </table>

        <div className="mt-3 flex flex-wrap items-center gap-x-5 gap-y-2">
          <span className="lbl">{t("Holdback / Rétention fabricant (optionnel)")}</span>
          <div className="w-[130px]">
            <NumField value={data.profit.holdback} onChange={(n) => upd((d) => void (d.profit.holdback = n))} />
          </div>
          <button
            className="btn"
            onClick={() =>
              upd((d) => {
                d.profit.pct = { ...defaults };
                d.products.forEach((x) => {
                  const sp = settings.products.find((y) => y.id === x.id);
                  if (sp) {
                    x.pct = sp.pct;
                    x.commission = sp.commission;
                    x.group = sp.group;
                    x.name = sp.name;
                  }
                });
              })
            }
          >
            {t("Réinitialiser aux % des Paramètres")}
          </button>
        </div>
      </div>

      <SecHead title={t("Sommaire")} />
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 p-3">
        <div className="space-y-1">
          {[
            ["Profit avant (Front)", pf.front],
            ["Profit arrière (Back / F&A)", pf.back],
            ["Frais de concession", pf.fees],
            ["PROFIT BRUT TOTAL", pf.total],
            ["Commissions totales", pf.totalCommission],
            ["Profit net concession", pf.total - pf.totalCommission],
          ].map(([l, v], i) => (
            <div key={String(l)} className="flex items-center gap-2">
              <span className={`lbl flex-1 ${i === 3 ? "font-bold" : ""}`}>{t(String(l))}</span>
              <div className="w-[160px]"><NumField value={Number(v)} readOnly hl={i === 3} className={i === 3 ? "font-bold" : ""} /></div>
            </div>
          ))}
        </div>
        <div className="space-y-1">
          {[...pf.rows.map((r) => ({ l: r.label, g: r.gross, f: r.front, k: r.kind }))].map((r) => (
            <div key={r.l} className="flex items-center gap-2 text-xs">
              <span className="w-[160px] text-[#003a5d] truncate">{t(r.l)}</span>
              <div className="flex-1 h-4 bg-[#e3e3e3] border border-[#c2c2c2]">
                <div
                  className={`h-full ${r.g < 0 ? "bg-red-500" : r.k === "fees" ? "bg-[#e0a100]" : r.f ? "bg-[#0071bc]" : "bg-[#3a9a5b]"}`}
                  style={{ width: `${(Math.abs(r.g) / maxGross) * 100}%` }}
                />
              </div>
              <span className="w-[80px] text-right tabular-nums">{fmtDesk(r.g)}</span>
            </div>
          ))}
          <div className="text-[11px] text-[#003a5d] pt-1">{t("■ bleu = avant · ■ vert = arrière (F&A)")} · <span className="text-[#b07d00]">■</span> {t("Frais de concession")}</div>
        </div>
      </div>
    </div>
  );
}
