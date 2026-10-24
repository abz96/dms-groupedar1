"use client";

import { useLang, useT } from "@/lib/i18n";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import {
  availableTerms,
  computeDeal,
  leaseConfig,
  productGroups,
  NO_POD,
  type PayOnDelivery,
  lenderRate,
  applyOptDefaults,
  DEFAULT_PRODUCTS,
  fmtDesk,
  customerLabel,
  FREQ_LABEL_FR,
  PROVINCES,
  type DealCalc,
  type DealData,
  type DealerSettings,
  type DealType,
  type Frequency,
  type Lender,
} from "@/lib/deal";
import TopNav from "./TopNav";
import { NumField, R, SecHead, TextField } from "./fields";
import ClientTab from "./ClientTab";
import ProfitTab from "./ProfitTab";
import InventoryPicker from "./InventoryPicker";
import AccessoriesModal from "./AccessoriesModal";
import RollbackPanel from "./RollbackPanel";
import ClientPicker from "./ClientPicker";
import StaffSelect from "./StaffSelect";
import IncentivesModal from "./IncentivesModal";
import ProductTermModal from "./ProductTermModal";
import PlanPicker from "./PlanPicker";
import ManagerCodeModal from "./ManagerCodeModal";
import CreditStatusBanner from "./CreditStatusBanner";
import { DOCS, docHref } from "./PrintToolbar";
import { applyVehicleToDeal, type InventoryVehicle } from "@/lib/inventory";

export interface DeskProps {
  data: DealData;
  upd: (fn: (d: DealData) => void) => void;
  calc: DealCalc;
  lenders: Lender[];
  settings: DealerSettings;
}

type SaveStatus = "saved" | "dirty" | "saving" | "error";

function lendersFor(lenders: Lender[], type: DealType) {
  return lenders.filter((l) => l.active && (type === "lease" ? l.allowLease : l.allowFinance));
}

/** Default lender from Settings (if valid for this deal type), otherwise the first valid one */
function preferredLenderId(lenders: Lender[], type: DealType, settings: DealerSettings): number | null {
  const valid = lendersFor(lenders, type);
  const pref = type === "lease" ? settings.defaultLeaseLenderId : settings.defaultFinanceLenderId;
  return valid.find((l) => l.id === pref)?.id ?? valid[0]?.id ?? null;
}

/** Apply lender grid (rate, residual, fees) to an option */
function applyLender(d: DealData, idx: number, lenders: Lender[], lenderId: number | null, term?: number, dealTerms?: number[]) {
  const o = d.options[idx];
  const l = lenders.find((x) => x.id === lenderId) ?? null;
  o.lenderId = l?.id ?? null;
  if (!l) return;
  const terms = availableTerms(l, d.dealType, dealTerms);
  let t = term ?? o.term;
  if (terms.length && !terms.includes(t)) {
    t = terms.reduce((a, b) => (Math.abs(b - t) < Math.abs(a - t) ? b : a), terms[0]);
  }
  o.term = t;
  const rate = lenderRate(l, d.dealType, t);
  // keep any applied manufacturer rate reduction (standard rate − reduction)
  const cut = d.incentivesApplied.find((x) => x.kind === "rate")?.rate ?? 0;
  if (rate !== null) o.rate = Math.round(Math.max(0, rate - cut) * 100) / 100;
  // Residual is resolved automatically from the Settings grid (term × km) unless typed manually
  if (d.dealType === "lease") o.residualManual = false;
  o.registrationFee = Number(l.registrationFee) || 0;
}

export default function DealDesk({
  id,
  dealNumber,
  initial,
  lenders,
  settings,
  updatedAt,
}: {
  id: number;
  dealNumber: string;
  initial: DealData;
  lenders: Lender[];
  settings: DealerSettings;
  updatedAt: string;
}) {
  const { t, lang } = useLang();
  const [data, setData] = useState<DealData>(initial);
  const [tab, setTab] = useState<"achat" | "client" | "profit">("achat");
  const [clientPicker, setClientPicker] = useState(false);

  const [status, setStatus] = useState<SaveStatus>("saved");
  const [savedAt, setSavedAt] = useState<Date>(new Date(updatedAt));
  const dataRef = useRef(data);
  const lastSaved = useRef(JSON.stringify({ data: initial }));
  const first = useRef(true);

  const upd = useCallback((fn: (d: DealData) => void) => {
    setData((prev) => {
      const n = structuredClone(prev);
      fn(n);
      return n;
    });
  }, []);

  const save = useCallback(
    async (keepalive = false) => {
      const payload = JSON.stringify({ data: dataRef.current });
      if (payload === lastSaved.current) {
        setStatus("saved");
        return;
      }
      setStatus("saving");
      try {
        const res = await fetch(`/api/deals/${id}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: payload,
          keepalive,
        });
        if (!res.ok) throw new Error("save failed");
        lastSaved.current = payload;
        const j = (await res.json().catch(() => ({}))) as { customerId?: number | null };
        if (j.customerId && dataRef.current.customer.id !== j.customerId) {
          const cid = j.customerId;
          setData((prev) => ({ ...prev, customer: { ...prev.customer, id: cid } }));
        }
        setSavedAt(new Date());
        setStatus("saved");
      } catch {
        setStatus("error");
      }
    },
    [id],
  );

  // Automatic save (debounced) on every change
  useEffect(() => {
    dataRef.current = data;
    if (first.current) {
      first.current = false;
      return;
    }
    setStatus("dirty");
    const t = setTimeout(() => void save(), 600);
    return () => clearTimeout(t);
  }, [data, save]);

  useEffect(() => {
    const flush = () => void save(true);
    window.addEventListener("pagehide", flush);
    const vis = () => document.visibilityState === "hidden" && flush();
    document.addEventListener("visibilitychange", vis);
    return () => {
      window.removeEventListener("pagehide", flush);
      document.removeEventListener("visibilitychange", vis);
    };
  }, [save]);

  // Auto-pick a lender for options without one
  useEffect(() => {
    if (data.dealType === "cash") return;
    const valid = lendersFor(lenders, data.dealType);
    const needs = data.options.some((o) => !valid.find((l) => l.id === o.lenderId));
    if (needs && valid.length) {
      upd((d) => {
        d.options.forEach((o, i) => {
          if (!valid.find((l) => l.id === o.lenderId)) applyLender(d, i, lenders, preferredLenderId(lenders, d.dealType, settings), undefined, settings.dealTerms);
        });
      });
    }
  }, [data.dealType, data.options, lenders, upd, settings]);

  const calc = useMemo(() => computeDeal(data, lenders, settings.excessKmCharge, leaseConfig(settings)), [data, lenders, settings]);
  const props: DeskProps = { data, upd, calc, lenders, settings };

  const [docsOpen, setDocsOpen] = useState(false);
  async function openDoc(key: string, auto = false) {
    setDocsOpen(false);
    const w = window.open("about:blank", "_blank");
    await save();
    const url = docHref(id, key, lang, auto);
    if (w) w.location.href = url;
    else window.location.href = url;
  }

  async function printSheet() {
    const w = window.open("about:blank", "_blank");
    await save();
    const url = `/deals/${id}/print?lang=${lang}`;
    if (w) w.location.href = url;
    else window.location.href = url;
  }

  async function duplicate() {
    await save();
    const res = await fetch("/api/deals", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ duplicateOf: id }),
    });
    const j = await res.json();
    window.location.href = `/deals/${j.id}`;
  }

  const statusText =
    status === "saved"
      ? `✓ ${t("Sauvegardé")} ${savedAt.toLocaleTimeString("fr-CA")}`
      : status === "saving"
        ? t("Sauvegarde…")
        : status === "dirty"
          ? t("Modifications…")
          : t("Erreur de sauvegarde");

  return (
    <div className="dms-bg">
      <TopNav
        active="deals"
        title={`${t("Dossier")} #${dealNumber}${data.quoteNumber ? ` · ${t("Offre")} ${data.quoteNumber}` : ""}${customerLabel(data) ? " — " + customerLabel(data) : ""}`}
        right={
          <>
            <span className={`text-xs mr-2 ${status === "error" ? "text-red-100 font-semibold" : "text-[#ececec]"}`}>{statusText}</span>
            <button className="btn" onClick={duplicate}>{t("Dupliquer")}</button>
            <button className="btn !font-semibold" onClick={printSheet}>{t("Imprimer la feuille")}</button>
            <div className="relative">
              <button className="btn !font-semibold" onClick={() => setDocsOpen((o) => !o)}>{t("Documents")} ▾</button>
              {docsOpen && (
                <>
                  <div className="fixed inset-0 z-40" onClick={() => setDocsOpen(false)} />
                  <div className="absolute right-0 mt-1 z-50 w-72 bg-white border border-[#a9bccb] shadow-lg text-[#00263d]">
                    <div className="px-3 py-1.5 text-[11px] font-semibold uppercase tracking-wider text-[#5a7086] border-b border-[#e1e9f0]">{t("Documents du dossier")}</div>
                    <a
                      className="w-full flex items-center gap-2 px-3 py-2 text-[12.5px] text-left border-b border-[#e1e9f0] text-[#005a96] hover:bg-[#e6f1fa]"
                      href={`/credit?dealId=${id}`}
                      onClick={() => setDocsOpen(false)}
                    >
                      + {t("Remplir une demande de crédit pour ce dossier")}
                    </a>
                    <button
                      className="w-full flex items-center gap-2 px-3 py-2.5 text-[13px] text-left font-semibold bg-[#0071bc] text-white hover:bg-[#005a96]"
                      onClick={() => void openDoc("all", true)}
                    >
                      <span className="flex-1">{t("Imprimer tous les documents")}</span>
                    </button>
                    {DOCS.map((x) => {
                      const has =
                        x.key === "warranty"
                          ? data.products.some((p) => p.price > 0 && (p.id === "warranty" || settings.protectionPlans.find((pl) => pl.code === p.code)?.section === "warranty"))
                          : x.key === "tire-rim"
                            ? data.products.some((p) => p.price > 0 && (p.id === "tireRim" || settings.protectionPlans.find((pl) => pl.code === p.code)?.section === "tireRim"))
                            : x.key === "accessories"
                              ? data.pricing.accessories > 0
                              : x.key === "fi-products"
                                ? data.products.some((p) => p.price > 0 && p.id !== "warranty" && p.id !== "tireRim" && !["warranty", "tireRim"].includes(settings.protectionPlans.find((pl) => pl.code === p.code)?.section ?? ""))
                                : x.key === "credit-application" || x.key === "credit-approval"
                                  ? data.dealType !== "cash"
                                  : x.key === "lease-agreement"
                                  ? data.dealType === "lease"
                                  : x.key === "finance-agreement"
                                    ? data.dealType === "finance"
                                    : true;
                      return (
                        <button
                          key={x.key}
                          className="w-full flex items-center gap-2 px-3 py-2 text-[13px] text-left hover:bg-[#e6f1fa]"
                          onClick={() => void openDoc(x.key)}
                        >
                          <span className="flex-1">{t(x.label)}</span>
                          {has ? <span className="text-[10px] text-green-700">●</span> : <span className="text-[10px] text-[#a9bccb]">{t("vide")}</span>}
                        </button>
                      );
                    })}
                  </div>
                </>
              )}
            </div>
          </>
        }
      />

      <div className="p-3 max-w-[1500px] mx-auto">
        {/* Client strip */}
        <div className="win mb-3 px-3 py-2 flex flex-wrap items-center gap-x-4 gap-y-2">
          <Link href="/deals" className="btn">{t("← Dossiers")}</Link>
          <span className="lbl">{t("Dossier")}</span>
          <span className="fld ro !w-auto flex items-center font-semibold">{dealNumber}</span>
          {data.quoteNumber && (
            <span className="text-[11px] font-semibold px-2 py-1 bg-[#e6f1fa] text-[#005a96] border border-[#9cc6e6]" title={t("Converti d'une offre AI")}>{t("Offre")} {data.quoteNumber}</span>
          )}
          <span className="lbl">{t("Client")}</span>
          <TextField className="!w-36" placeholder={t("Prénom")} value={data.customer.firstName} onChange={(v) => upd((d) => void (d.customer.firstName = v))} />
          <TextField className="!w-40" placeholder={t("Nom")} value={data.customer.lastName} onChange={(v) => upd((d) => void (d.customer.lastName = v))} />
          <button className="dots" title={t("Choisir un client existant")} onClick={() => setClientPicker(true)}>...</button>
          {data.customer.id ? (
            <Link href="/crm" className="text-[11px] text-green-800 font-semibold" title={t("Lié à la base de données clients")}>● {t("Client lié")}</Link>
          ) : null}
          <span className="lbl">{t("Vendeur")}</span>
          <StaffSelect className="!w-60" value={data.salesperson} onChange={(v) => upd((d) => void (d.salesperson = v))} />
          <span className="lbl">{t("Statut")}</span>
          <select className="fld !w-32" value={data.status} onChange={(e) => upd((d) => void (d.status = e.target.value))}>
            <option value="open">{t("Ouvert")}</option>
            <option value="pending">{t("En attente")}</option>
            <option value="sold">{t("Vendu")}</option>
            <option value="lost">{t("Perdu")}</option>
          </select>
        </div>

        <CreditStatusBanner dealId={id} />
        {clientPicker && (
          <ClientPicker
            onClose={() => setClientPicker(false)}
            onPick={(c) => {
              upd((d) => {
                d.customer = {
                  ...d.customer,
                  id: c.id,
                  firstName: c.firstName,
                  lastName: c.lastName,
                  email: c.email,
                  homePhone: c.homePhone,
                  mobile: c.mobile,
                  address: c.address,
                  city: c.city,
                  province: c.province || d.customer.province,
                  postal: c.postal,
                };
              });
              setClientPicker(false);
            }}
          />
        )}
        <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,1fr)_520px] gap-3 items-start">
          <div>
            <div className="flex pl-1">
              <button className={`tabbtn ${tab === "achat" ? "active" : ""}`} onClick={() => setTab("achat")}>{t("Achat")}</button>
              <button className={`tabbtn ${tab === "client" ? "active" : ""}`} onClick={() => setTab("client")}>{t("Client / Véhicule")}</button>
              <button className={`tabbtn ${tab === "profit" ? "active" : ""}`} onClick={() => setTab("profit")}>{t("Analyse de profit")}</button>
            </div>
            {tab === "achat" && <AchatPanel {...props} />}
            {tab === "client" && <ClientTab {...props} />}
            {tab === "profit" && <ProfitTab {...props} />}
          </div>
          <ComparaisonPanel {...props} />
        </div>

        <div className="win mt-3 px-3 py-1 text-xs text-[#003a5d] flex gap-6">
          <span>{t("Dossier")} #{dealNumber}</span>
          <span>{customerLabel(data) || t("Client non défini")}</span>
          <span>{t("Taxation")} : {calc.prov.name}</span>
          <span className="ml-auto">{t("Sauvegarde automatique activée")}</span>
        </div>
      </div>
    </div>
  );
}

/* ======================= ACHAT PANEL (replica) ======================= */

function AchatPanel({ data, upd, calc, settings }: DeskProps) {
  const t = useT();
  const p = data.pricing;
  const [showFI, setShowFI] = useState(false);
  const [showTrade, setShowTrade] = useState(false);
  const [picker, setPicker] = useState(false);
  const [showAcc, setShowAcc] = useState(false);
  const warrantyIdx = data.products.findIndex((x) => x.id === "warranty");
  const tireIdx = data.products.findIndex((x) => x.id === "tireRim");
  const [termPicker, setTermPicker] = useState<null | "warranty" | "tireRim">(null);
  const [fiPlans, setFiPlans] = useState(false);
  const [showInc, setShowInc] = useState(false);
  const pick = (v: InventoryVehicle) => {
    upd((d) => applyVehicleToDeal(d, v));
    setPicker(false);
  };
  async function lookupStock(stock: string) {
    const s = stock.trim().toUpperCase();
    if (!s) return;
    const r = await fetch("/api/inventory");
    const list = (await r.json()) as InventoryVehicle[];
    const hit = list.find((v) => v.stock.toUpperCase() === s);
    if (hit && (hit.make !== data.vehicle.make || hit.model !== data.vehicle.model || Number(hit.price) !== data.pricing.basePrice)) {
      upd((d) => applyVehicleToDeal(d, hit));
    }
  }
  const setP = (k: keyof DealData["pricing"]) => (n: number) => upd((d) => void (d.pricing[k] = n));
  const showRed = data.showReduction !== false;
  const maxPct = settings.maxDiscountPct ?? 3;
  const redPct = calc.msrp > 0 ? (p.reduction / calc.msrp) * 100 : 0;
  const [pendingRed, setPendingRed] = useState<number | null>(null);
  const requestReduction = (n: number) => {
    const pct = calc.msrp > 0 ? (n / calc.msrp) * 100 : 0;
    if (pct > maxPct + 1e-9 && n > (data.reductionApproved ?? 0) + 0.005) {
      setPendingRed(n);
      return;
    }
    upd((d) => void (d.pricing.reduction = n));
  };
  const setC = (k: keyof DealData["cash"]) => (n: number) => upd((d) => void (d.cash[k] = n));

  // Federal luxury tax is automatic (vehicles over $100,000) — see computeDeal
  const luxOver = Math.max(0, calc.luxuryBase - 100000);

  return (
    <div className="win">
      <div className="win-title h-7 text-right pr-4 text-[15px] leading-7">{t("Comparaison")}</div>
      {picker && <InventoryPicker onPick={pick} onClose={() => setPicker(false)} />}
      {pendingRed !== null && (
        <ManagerCodeModal
          amount={pendingRed}
          pct={calc.msrp > 0 ? (pendingRed / calc.msrp) * 100 : 0}
          maxPct={maxPct}
          onCancel={() => setPendingRed(null)}
          onApproved={() => {
            const v = pendingRed;
            upd((d) => {
              d.pricing.reduction = v;
              d.reductionApproved = v;
            });
            setPendingRed(null);
          }}
        />
      )}
      {termPicker && (
        <ProductTermModal
          kind={termPicker}
          vehiclePrice={calc.profit.vehiclePrice}
          settings={settings}
          current={data.products.find((x) => x.id === termPicker)}
          onClose={() => setTermPicker(null)}
          onPick={(term, price) =>
            upd((d) => {
              const sp = settings.products.find((x) => x.id === termPicker) ?? DEFAULT_PRODUCTS.find((x) => x.id === termPicker)!;
              let idx = d.products.findIndex((x) => x.id === termPicker);
              if (idx < 0) {
                d.products.push({ ...sp, price: 0 });
                idx = d.products.length - 1;
              }
              d.products[idx] = { ...d.products[idx], name: sp.name, pct: sp.pct, code: undefined, price, term: term ?? undefined };
            })
          }
          onPickPlan={(plan, term, price) =>
            upd((d) => {
              const sp = settings.products.find((x) => x.id === termPicker) ?? DEFAULT_PRODUCTS.find((x) => x.id === termPicker)!;
              let idx = d.products.findIndex((x) => x.id === termPicker);
              if (idx < 0) {
                d.products.push({ ...sp, price: 0 });
                idx = d.products.length - 1;
              }
              d.products[idx] = { ...d.products[idx], name: plan.name, code: plan.code, pct: settings.planMargin, price, term, group: "back" };
            })
          }
        />
      )}
      {fiPlans && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-start justify-center pt-16 px-4" onClick={() => setFiPlans(false)}>
          <div className="win w-full max-w-[680px] max-h-[85vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <div className="win-title flex items-center h-9 px-3">
              <span>{t("Plans de protection — Produits F&A")}</span>
              <button className="ml-auto text-white/80 hover:text-white" onClick={() => setFiPlans(false)}>✕</button>
            </div>
            <div className="p-3 space-y-3">
              <PlanPicker
                sections={["fi"]}
                vehiclePrice={calc.profit.vehiclePrice}
                settings={settings}
                onAdd={(plan, term, price) =>
                  upd((d) => {
                    const pid = `plan:${plan.code}`;
                    const row = { id: pid, name: plan.name, code: plan.code, price, term, pct: settings.planMargin, commission: 10, group: "back" as const };
                    const i = d.products.findIndex((x) => x.id === pid);
                    if (i >= 0) d.products[i] = { ...d.products[i], ...row };
                    else d.products.push(row);
                  })
                }
              />
              <div className="text-[11px] text-[#5a7086]">{t("Les plans « Garantie » et « Pneus & jantes » se choisissent avec le bouton … de chaque ligne; les plans « Accessoires » dans la liste des accessoires.")}</div>
              <div className="flex"><button className="btn btn-primary ml-auto" onClick={() => setFiPlans(false)}>OK</button></div>
            </div>
          </div>
        </div>
      )}
      {showInc && <IncentivesModal data={data} upd={upd} settings={settings} onClose={() => setShowInc(false)} />}
      {showAcc && <AccessoriesModal data={data} upd={upd} settings={settings} onClose={() => setShowAcc(false)} />}

      {/* Achat header row */}
      <div className="flex items-center gap-2 py-1 pr-2">
        <div className="sec-tab w-[150px] text-center !py-[6px]">{t("Achat")}</div>
        <select className="fld !w-[150px]" value={data.vehicle.condition} onChange={(e) => upd((d) => void (d.vehicle.condition = e.target.value))}>
          <option value="NEUF">{t("NEUF")}</option>
          <option value="USAGÉ">{t("USAGÉ")}</option>
          <option value="DÉMO">{t("DÉMO")}</option>
        </select>
        <button className="dots" title={t("Choisir dans l'inventaire")} onClick={() => setPicker(true)}>...</button>
        <input
          className="fld flex-1"
          placeholder={t("2026 MODÈLE")}
          value={[data.vehicle.year, data.vehicle.make, data.vehicle.model].filter(Boolean).join(" ")}
          onChange={(e) => {
            const parts = e.target.value.split(" ");
            upd((d) => {
              d.vehicle.year = parts[0] ?? "";
              d.vehicle.make = parts[1] ?? "";
              d.vehicle.model = parts.slice(2).join(" ");
            });
          }}
        />
        <input className="fld !w-[190px]" placeholder={t("COULEUR / VERSION")} value={data.vehicle.trim} onChange={(e) => upd((d) => void (d.vehicle.trim = e.target.value.toUpperCase()))} />
        <button className="dots text-base" title={t("Nouveau dossier")} onClick={() => (window.location.href = "/deals")}>+</button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-x-6 px-3 pb-1">
        <div>
          <R label={t("# Stock")} dots onDots={() => setPicker(true)}>
            <input
              className="fld"
              value={data.vehicle.stock}
              onChange={(e) => upd((d) => void (d.vehicle.stock = e.target.value.toUpperCase()))}
              onBlur={(e) => void lookupStock(e.target.value)}
            />
          </R>
          <R label={t("Livraison")} dots dotsLabel="⌄">
            <TextField type="date" value={data.vehicle.delivery} onChange={(v) => upd((d) => void (d.vehicle.delivery = v))} />
          </R>
        </div>
        <div>
          <R label={t("Version Liste")} fieldWidth="w-[230px]">
            <TextField value={data.vehicle.versionListe} onChange={(v) => upd((d) => void (d.vehicle.versionListe = v))} className="ro" />
          </R>
          <R label={t("Taxation")} dots onDots={() => alert(`${calc.prov.name}: ${calc.prov.hst ? `HST ${calc.prov.hst}%` : `TPS/GST ${calc.prov.gst}%` + (calc.prov.pst ? ` + ${calc.prov.pstLabel} ${calc.prov.pst}%` : "")}`)}>
            <select className="fld" value={data.taxProvince} onChange={(e) => upd((d) => void (d.taxProvince = e.target.value))}>
              {PROVINCES.map((pr) => (
                <option key={pr.code} value={pr.code}>{pr.name}</option>
              ))}
            </select>
          </R>
        </div>
      </div>

      {/* Pricing */}
      <div className="sec grid grid-cols-1 lg:grid-cols-2 gap-x-6 px-3 py-1">
        <div>
          <R label={t("Prix De Base")} dots onDots={() => {}}><NumField value={p.basePrice} onChange={setP("basePrice")} /></R>
          <R label={t("Options")} dots onDots={() => {}}><NumField value={p.options} onChange={setP("options")} /></R>
          <R label={t("Frais")} dots onDots={() => {}}><NumField value={p.freight} onChange={setP("freight")} /></R>
          <R label={t("Sous-Total")}><NumField value={calc.leftSubtotal} readOnly className="!bg-white" /></R>
          <R label={t("R.M. (Non Tax.)")} dots onDots={() => setShowInc(true)}>
            <NumField value={p.rmNonTax} onChange={setP("rmNonTax")} className={data.incentivesApplied.some((x) => x.kind === "cash") ? "!bg-[#e7f5ea]" : ""} />
          </R>
          {data.incentivesApplied.length > 0 && (
            <div className="text-[11px] text-green-800 -mt-1 mb-1 pl-1">
              {data.incentivesApplied.map((x) => `${x.name} (${x.kind === "cash" ? fmtDesk(x.amount) : "− " + x.rate.toFixed(2) + " %"})`).join(" · ")}
            </div>
          )}
        </div>
        <div>
          <R label={t("Frais")} dots onDots={() => {}}><NumField value={p.adminFees} onChange={setP("adminFees")} /></R>
          <R label={t("Accessoires")} dots onDots={() => setShowAcc(true)}>
            {data.accessoryItems.length ? (
              <button type="button" className="fld num !bg-white text-right" title={t("Liste des accessoires")} onClick={() => setShowAcc(true)}>
                {fmtDesk(p.accessories)}
              </button>
            ) : (
              <NumField value={p.accessories} onChange={setP("accessories")} />
            )}
          </R>
          <R
            label={
              <span className="inline-flex items-center gap-1.5">
                {t("Réduction")}
                <button
                  type="button"
                  className="text-[10px] font-semibold px-1.5 py-0 border border-[#9fb3c4] rounded-sm text-[#003a5d] bg-white hover:border-[#0071bc]"
                  title={showRed ? t("Masquer la réduction") : t("Afficher la réduction")}
                  onClick={() => upd((d) => void (d.showReduction = !showRed))}
                >
                  {showRed ? t("Masquer") : t("Afficher")}
                </button>
              </span>
            }
            fieldWidth="w-[300px]"
          >
            {showRed ? (
              <>
                <div
                  title={t("% de rabais sur le PDSF")}
                  className={`fld num ro !w-[105px] flex items-center justify-end shrink-0 ${redPct > maxPct ? "!text-red-700 font-semibold" : ""}`}
                >
                  {redPct.toFixed(2)} %
                </div>
                <NumField value={p.reduction} commitOnBlur onChange={requestReduction} className={redPct > maxPct ? "!border-amber-500" : ""} />
              </>
            ) : (
              <div className="fld ro flex items-center justify-center text-[#93a8ba] tracking-[0.3em] w-full">••••••</div>
            )}
          </R>
          {showRed && redPct > maxPct && (
            <div className="text-[10.5px] text-amber-800 -mt-1 mb-1 pl-1">
              {t("Rabais supérieur à")} {maxPct} % — {t("approuvé par le gestionnaire")}
            </div>
          )}
          <R label={t("Taxe de Luxe")} fieldWidth="w-[300px]">
            <div
              title={t("Montant excédant 100 000 $ (assujetti à la taxe de luxe fédérale)")}
              className="fld num ro !w-[105px] flex items-center justify-end shrink-0"
            >
              {fmtDesk(luxOver)}
            </div>
            <NumField value={calc.luxuryTax} readOnly />
          </R>
          {data.vehicle.condition !== "NEUF" && calc.luxuryBase > 100000 && (
            <div className="text-[10.5px] text-[#5a7086] -mt-1 mb-1 pl-1">{t("Taxe de luxe : véhicules neufs seulement (usagé exempté)")}</div>
          )}
          <R label={t("Sous-Total")}><NumField value={calc.rightSubtotal} readOnly className="!bg-white" /></R>
        </div>
      </div>

      {/* F&A */}
      <div className="sec grid grid-cols-1 lg:grid-cols-2 gap-x-6 px-3 py-1">
        <div>
          <R
            label={
              <>
                {t("Gar. Prol.")}
                {warrantyIdx >= 0 && data.products[warrantyIdx].term && data.products[warrantyIdx].price > 0 ? (
                  <span className="text-[11px] text-[#5a7086]"> ({data.products[warrantyIdx].term} {t("an(s)")})</span>
                ) : null}
              </>
            }
            dots
            onDots={() => setTermPicker("warranty")}
          >
            {warrantyIdx >= 0 ? (
              <NumField value={data.products[warrantyIdx].price} onChange={(n) => upd((d) => void (d.products[warrantyIdx].price = n))} />
            ) : (
              <button type="button" className="fld num !bg-white text-right" onClick={() => setTermPicker("warranty")}>{fmtDesk(0)}</button>
            )}
          </R>
          <R
            label={
              <>
                {t("Pneus & jantes")}
                {tireIdx >= 0 && data.products[tireIdx].term && data.products[tireIdx].price > 0 ? (
                  <span className="text-[11px] text-[#5a7086]"> ({data.products[tireIdx].term} {t("an(s)")})</span>
                ) : null}
              </>
            }
            dots
            onDots={() => setTermPicker("tireRim")}
          >
            {tireIdx >= 0 ? (
              <NumField value={data.products[tireIdx].price} onChange={(n) => upd((d) => void (d.products[tireIdx].price = n))} />
            ) : (
              <button type="button" className="fld num !bg-white text-right" onClick={() => setTermPicker("tireRim")}>{fmtDesk(0)}</button>
            )}
          </R>
          <R label={t("Autres produits F&A")} dots onDots={() => setShowFI((s) => !s)}>
            <button type="button" className="fld num !bg-white text-right" onClick={() => setShowFI((s) => !s)}>
              {fmtDesk(
                calc.fiSubtotal - (warrantyIdx >= 0 ? data.products[warrantyIdx].price : 0) - (tireIdx >= 0 ? data.products[tireIdx].price : 0),
              )}
            </button>
          </R>
        </div>
        <div>
          <R label={t("Sous-Total F&A")}><NumField value={calc.fiSubtotal} readOnly /></R>
          <R label={t("Achat Total")}><NumField value={calc.achatTotal} readOnly className="!bg-white" /></R>
        </div>
        {showFI && (
          <div className="lg:col-span-2 my-1 border border-[#a9bccb] bg-[#f2f6f9] p-2">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-x-6">
              {data.products.map((x, i) => (
                <R
                  key={x.id}
                  label={<>{t(x.name)} <span className="text-[10px] text-[#5a7086]">({x.group === "front" ? t("avant") : t("arrière")})</span></>}
                  dots
                  dotsLabel="✕"
                  onDots={() => upd((d) => void d.products.splice(i, 1))}
                >
                  {(x.id === "warranty" || x.id === "tireRim") && (
                    <button type="button" className="dots" title={t("Choisir le terme")} onClick={() => setTermPicker(x.id as "warranty" | "tireRim")}>
                      {x.term && x.price > 0 ? `${x.term}${t("a")}` : "…"}
                    </button>
                  )}
                  <NumField value={x.price} onChange={(n) => upd((d) => void (d.products[i].price = n))} />
                </R>
              ))}
            </div>
            <div className="flex flex-wrap items-center gap-2 mt-1">
              {(settings.products ?? [])
                .filter((sp) => !data.products.some((x) => x.id === sp.id))
                .map((sp) => (
                  <button key={sp.id} className="btn !py-0.5" onClick={() => upd((d) => void d.products.push({ ...sp, price: 0 }))}>
                    + {t(sp.name)}
                  </button>
                ))}
              <button className="btn btn-primary !py-0.5" onClick={() => setFiPlans(true)}>+ {t("Plan de protection")}</button>
              <span className="text-xs text-[#003a5d] ml-auto">{t("Les produits et leurs % se gèrent dans les Paramètres.")}</span>
            </div>
          </div>
        )}
      </div>

      {/* Échange */}
      <SecHead title={t("Échange")}>
        <input
          className="fld ro flex-1"
          placeholder=""
          value={data.trade.description}
          onChange={(e) => upd((d) => void (d.trade.description = e.target.value))}
        />
        <button className="dots text-base" onClick={() => setShowTrade((s) => !s)}>+</button>
      </SecHead>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-x-6 px-3 py-1">
        <div>
          <R label={t("Valeur Échange")} dots onDots={() => setShowTrade((s) => !s)}>
            <NumField value={data.trade.value} onChange={(n) => upd((d) => void (d.trade.value = n))} />
          </R>
          <R label={t("+ Éco. Taxes")} dots onDots={() => {}}>
            <NumField value={data.trade.ecoTax} onChange={(n) => upd((d) => void (d.trade.ecoTax = n))} />
          </R>
        </div>
        <div>
          <R label={t("Solde Dû")}><NumField value={data.trade.lien} onChange={(n) => upd((d) => void (d.trade.lien = n))} /></R>
          <R label={t("Valeur Nette")}><NumField value={calc.tradeNet} readOnly className="!bg-white" /></R>
        </div>
        {showTrade && (
          <div className="lg:col-span-2 my-1 border border-[#a9bccb] bg-[#f2f6f9] p-2 grid grid-cols-1 lg:grid-cols-2 gap-x-6 gap-y-1">
            <R label={t("Année Marque Modèle")} fieldWidth="w-[230px]"><TextField value={data.trade.description} onChange={(v) => upd((d) => void (d.trade.description = v))} /></R>
            <R label={t("NIV / VIN")} fieldWidth="w-[230px]"><TextField value={data.trade.vin} onChange={(v) => upd((d) => void (d.trade.vin = v.toUpperCase()))} /></R>
            <R label={t("Kilométrage")} fieldWidth="w-[230px]"><TextField value={data.trade.kms} onChange={(v) => upd((d) => void (d.trade.kms = v))} /></R>
            <R label={t("Couleur")} fieldWidth="w-[230px]"><TextField value={data.trade.colour} onChange={(v) => upd((d) => void (d.trade.colour = v))} /></R>
            <R label={t("Créancier (Lien)")} fieldWidth="w-[230px]"><TextField value={data.trade.lienHolder} onChange={(v) => upd((d) => void (d.trade.lienHolder = v))} /></R>
          </div>
        )}
      </div>

      {/* Comptant */}
      <SecHead title={t("Comptant Et Remise En Argent")} />
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-x-6 px-3 py-1">
        <div>
          <R label={t("Compt. Sans Taxes")} dots onDots={() => {}}><NumField value={data.cash.cashDownPreTax} onChange={setC("cashDownPreTax")} /></R>
          <R label={t("R.A. Sans Taxes")} dots onDots={() => {}}><NumField value={data.cash.rebatePreTax} onChange={setC("rebatePreTax")} blankZero /></R>
          <R label={t("Acompte Remb.")}><NumField value={data.cash.deposit} onChange={setC("deposit")} className="!bg-[#e3eaf1]" /></R>
        </div>
        <div>
          <R label={t("Compt. Taxes Incl.")} dots><NumField value={data.cash.cashDownTaxIncl} onChange={setC("cashDownTaxIncl")} blankZero /></R>
          <R label={t("R.A. Taxes Incl.")} dots><NumField value={data.cash.rebateTaxIncl} onChange={setC("rebateTaxIncl")} blankZero /></R>
          <R label={t("Frais À La Livraison")}><NumField value={data.cash.deliveryFees} onChange={setC("deliveryFees")} blankZero className="!bg-[#e3eaf1]" /></R>
        </div>
      </div>
      <div className="sec grid grid-cols-1 lg:grid-cols-2 gap-x-6 px-3 py-1">
        <div className="flex items-center text-xs text-[#003a5d] gap-4">
          <span>Taxes : {calc.prov.hst ? `TVH ${calc.hst.toFixed(2)}` : `TPS ${calc.gst.toFixed(2)} · ${calc.prov.pstLabel === "QST" ? "TVQ" : calc.prov.pstLabel} ${calc.pst.toFixed(2)}`}</span>
          <span>Total taxes incl. : {calc.cashTotal.toFixed(2)}</span>
        </div>
        <div>
          <R label={data.dealType === "lease" ? "Solde (Loc)" : "Solde Dû"} dots onDots={() => {}}>
            <NumField value={data.dealType === "lease" ? calc.options[0].capCost : calc.soldeDu} readOnly />
          </R>
        </div>
      </div>
    </div>
  );
}

/* ======================= COMPARAISON PANEL ======================= */

function ComparaisonPanel({ data, upd, calc, lenders, settings }: DeskProps) {
  const t = useT();
  const type = data.dealType;
  const valid = lendersFor(lenders, type);
  const setType = (t: DealType) =>
    upd((d) => {
      if (t !== d.dealType) applyOptDefaults(d, settings, t);
      d.dealType = t;
      if (t !== "cash") {
        const v = lendersFor(lenders, t);
        d.options.forEach((o, i) => {
          const keep = v.find((l) => l.id === o.lenderId);
          applyLender(d, i, lenders, keep ? keep.id : preferredLenderId(lenders, t, settings), d.options[i].term, settings.dealTerms);
        });
      }
    });

  const groups = productGroups(data);
  const pod = { ...NO_POD, ...(data.payOnDelivery ?? {}) };
  const podItems: { k: keyof PayOnDelivery; label: string; amount: number }[] = (
    [
      { k: "warranty", label: t("Garantie prolongée"), amount: groups.warranty },
      { k: "tireRim", label: t("Pneus & jantes"), amount: groups.tireRim },
      { k: "accessories", label: t("Accessoires"), amount: groups.accessories },
      { k: "fi", label: t("Autres produits F&A"), amount: groups.fi },
    ] as { k: keyof PayOnDelivery; label: string; amount: number }[]
  ).filter((x) => x.amount > 0);
  const podRow =
    podItems.length > 0 ? (
      <tr>
        <td className="lbl py-[3px] pr-2 align-top">{t("Payer à la livraison")}</td>
        <td colSpan={2} className="py-[3px] px-1">
          <div className="border border-[#9fb3c4] bg-[#f4f8fb] px-2 py-1">
            <div className="text-[10.5px] text-[#5a7086] mb-0.5">{t("Cochez ce que le client paie à la livraison (retiré du financement) :")}</div>
            <div className="flex flex-wrap gap-x-3 gap-y-0.5">
              {podItems.map((x) => (
                <label key={x.k} className={`flex items-center gap-1 text-[12px] ${pod[x.k] ? "text-[#005a96] font-semibold" : "text-[#1e3a50]"}`}>
                  <input type="checkbox" checked={pod[x.k]} onChange={(e) => upd((d) => void (d.payOnDelivery = { ...NO_POD, ...(d.payOnDelivery ?? {}), [x.k]: e.target.checked }))} />
                  {x.label} <span className="tabular-nums">({fmtDesk(x.amount)} $ + {t("taxes")})</span>
                </label>
              ))}
            </div>
          </div>
        </td>
      </tr>
    ) : null;
  const deliveryBreakdown = (i: 0 | 1) => {
    const o = calc.options[i];
    const line = (label: string, v: number, neg = false, strong = false) =>
      v ? (
        <div className={`flex justify-between gap-2 ${strong ? "font-semibold text-[#005a96]" : ""}`}>
          <span>{label}</span>
          <span className="tabular-nums">{neg ? "− " : ""}{fmtDesk(v)}</span>
        </div>
      ) : null;
    return (
      <div className="text-[10.5px] text-[#1e3a50] leading-[14px] pr-1">
        {line(t("Dépôt sécurité"), o.deliverySecurityDeposit)}
        {line(t("Frais RDPRM/PPSA"), o.deliveryRegistration)}
        {line(t("Taxe pneus"), o.deliveryTireTax)}
        {line(t("Comptant"), o.deliveryCashDown)}
        {line(t("Produits payés à la livraison (taxes incl.)"), o.deliveryProducts, false, true)}
        {line(t("Moins acompte remboursable"), o.depositApplied, true)}
        {line(t("1er paiement (premier mois)"), o.deliveryFirstPayment)}
      </div>
    );
  };

  const row = (label: string, cells: [ReactNode, ReactNode], strong = false) => (
    <tr className={strong ? "font-semibold" : ""}>
      <td className="lbl py-[3px] pr-2">{label}</td>
      <td className="py-[3px] px-1">{cells[0]}</td>
      <td className="py-[3px] px-1">{cells[1]}</td>
    </tr>
  );
  const both = (fn: (i: 0 | 1) => ReactNode): [ReactNode, ReactNode] => [fn(0), fn(1)];
  const setO = (i: number, fn: (o: DealData["options"][number]) => void) => upd((d) => fn(d.options[i]));

  return (
    <div className="win">
      <div className="win-title h-7 px-3 text-[15px] leading-7 flex">
        <span>{t("Comparaison")}</span>
        <span className="ml-auto text-xs text-[#cfe3f2]">{calc.prov.name}</span>
      </div>
      <div className="flex gap-1 p-2 border-b border-[#bccbd8]">
        {(["cash", "finance", "lease"] as DealType[]).map((tp) => (
          <button
            key={tp}
            className={`flex-1 py-2 text-sm border ${type === tp ? "bg-[#0071bc] text-white border-[#123e95] font-semibold" : "bg-gradient-to-b from-white to-[#dfe5ef] text-[#1e3a50] border-[#93a8ba]"}`}
            onClick={() => setType(tp)}
          >
            {tp === "cash" ? t("Comptant") : tp === "finance" ? t("Financement") : t("Location")}
          </button>
        ))}
      </div>

      {type === "cash" ? (
        <div className="p-3">
          <table className="w-full">
            <tbody>
              {[
                ...(calc.luxuryTax ? [["dont Taxe de luxe", calc.luxuryTax]] : []),
                ["dont Taxe pneus", data.pricing.tireTax],
                ["Achat Total", calc.achatTotal],
                ["Moins échange", -calc.tradeCredit],
                ["Moins R.A. sans taxes", -data.cash.rebatePreTax],
                ["Montant taxable", calc.taxable],
                ...(calc.prov.hst
                  ? [[`TVH / HST ${calc.prov.hst}%`, calc.hst]]
                  : [[`TPS / GST ${calc.prov.gst}%`, calc.gst], ...(calc.prov.pst ? [[`${calc.prov.pstLabel === "QST" ? "TVQ / QST" : calc.prov.pstLabel} ${calc.prov.pst}%`, calc.pst]] : [])]),
                ["Prix total taxes incl.", calc.cashTotal],
                ["+ Solde dû échange", data.trade.lien],
                ["Moins comptant", -calc.cashPaid],
                ["Moins R.A. taxes incl. / R.M.", -(data.cash.rebateTaxIncl + data.pricing.rmNonTax)],
                ["Moins acompte", -data.cash.deposit],
                ["+ Frais à la livraison", data.cash.deliveryFees],
              ].map(([l, v]) => (
                <tr key={String(l)}>
                  <td className="lbl py-[3px]">{t(String(l))}</td>
                  <td className="w-[180px] py-[3px]"><NumField value={Number(v)} readOnly /></td>
                </tr>
              ))}
              <tr>
                <td className="lbl py-2 font-bold text-base">{t("SOLDE À PAYER")}</td>
                <td className="py-2"><NumField value={calc.soldeDu} readOnly hl className="!text-base !h-9 font-bold" /></td>
              </tr>
            </tbody>
          </table>
        </div>
      ) : (
        <div className="p-2">
          <table className="w-full table-fixed">
            <colgroup>
              <col className="w-[150px]" />
              <col />
              <col />
            </colgroup>
            <thead>
              <tr>
                <th />
                <th className="sec-tab !px-2 !py-1 text-center text-sm">{t("OPT 1")}</th>
                <th className="sec-tab !px-2 !py-1 text-center text-sm">{t("OPT 2")}</th>
              </tr>
            </thead>
            <tbody>
              {row(t("Prêteur"), both((i) => (
                <select
                  className="fld !text-[12px]"
                  value={data.options[i].lenderId ?? ""}
                  onChange={(e) => upd((d) => applyLender(d, i, lenders, Number(e.target.value) || null, undefined, settings.dealTerms))}
                >
                  {valid.map((l) => (
                    <option key={l.id} value={l.id} title={l.name}>{l.name}</option>
                  ))}
                </select>
              )))}
              {row(t("Terme (mois)"), both((i) => {
                const o = data.options[i];
                const terms = availableTerms(calc.options[i].lender, type, settings.dealTerms);
                const list = terms.includes(o.term) ? terms : [...terms, o.term].sort((a, b) => a - b);
                return (
                  <select className="fld" value={o.term} onChange={(e) => upd((d) => applyLender(d, i, lenders, d.options[i].lenderId, Number(e.target.value), settings.dealTerms))}>
                    {list.map((t) => <option key={t} value={t}>{t}</option>)}
                  </select>
                );
              }))}
              {row(t("Fréquence"), both((i) => (
                <select className="fld" value={data.options[i].frequency} onChange={(e) => setO(i, (o) => void (o.frequency = e.target.value as Frequency))}>
                  {(Object.keys(FREQ_LABEL_FR) as Frequency[]).map((f) => <option key={f} value={f}>{t(FREQ_LABEL_FR[f])}</option>)}
                </select>
              )))}
              {row(t("Taux d'intérêt %"), both((i) => (
                <NumField value={data.options[i].rate} onChange={(n) => setO(i, (x) => void (x.rate = n))} suffix=" %" className="font-semibold" />
              )))}
              {type === "lease" && row(t("Km / année"), both((i) => {
                const o = data.options[i];
                const tierKms = settings.kmTiers.map((x) => x.km).sort((a, b) => a - b);
                const kms = tierKms.includes(o.kmPerYear) ? tierKms : [...tierKms, o.kmPerYear].sort((a, b) => a - b);
                return (
                  <select
                    className="fld"
                    value={o.kmPerYear}
                    onChange={(e) => setO(i, (x) => { x.kmPerYear = Number(e.target.value); x.residualManual = false; })}
                  >
                    {kms.map((k) => (
                      <option key={k} value={k}>{k.toLocaleString("en-CA")} km</option>
                    ))}
                  </select>
                );
              }))}
              {type === "lease" && row(t("Résiduel %"), both((i) => {
                const o = data.options[i];
                return (
                  <div className="flex gap-1 items-center">
                    <NumField
                      value={calc.options[i].residualPct}
                      onChange={(n) => setO(i, (x) => { x.residualPct = n; x.residualManual = true; })}
                      suffix=" %"
                      className={o.residualManual ? "!bg-[#fff1d6]" : ""}
                    />
                    {o.residualManual ? (
                      <button type="button" className="dots !w-9 !text-[10px]" title={t("Revenir au résiduel automatique (Paramètres)")} onClick={() => setO(i, (x) => void (x.residualManual = false))}>{t("AUTO")}</button>
                    ) : (
                      <span className="text-[10px] text-[#003a5d] w-9 text-center" title={t("Résiduel tiré de la grille des Paramètres")}>{t("auto")}</span>
                    )}
                  </div>
                );
              }))}
              {type === "lease" && row(t("Dépôt sécurité"), both((i) => (
                <div className="flex gap-1">
                  <NumField value={data.options[i].securityDeposit} onChange={(n) => setO(i, (o) => void (o.securityDeposit = n))} className="!bg-[#fffbe0]" />
                  <select
                    className="fld !w-7 !px-0 !bg-none text-center"
                    title={t("Montants rapides")}
                    value=""
                    onChange={(e) => setO(i, (o) => void (o.securityDeposit = Number(e.target.value)))}
                  >
                    <option value="" disabled>▾</option>
                    {[0, 250, 500, 750, 1000, 1500, 2000].map((v) => <option key={v} value={v}>{v.toLocaleString("en-CA")} $</option>)}
                  </select>
                </div>
              )))}
              {row(t("Frais RDPRM/PPSA"), both((i) => <NumField value={data.options[i].registrationFee} onChange={(n) => setO(i, (o) => void (o.registrationFee = n))} />))}
              {row(t("Taxe pneus"), both((i) => (
                <NumField
                  value={data.options[i].tireTax}
                  onChange={(n) =>
                    upd((d) => {
                      d.options[i].tireTax = n;
                      if (i === 0) d.pricing.tireTax = n; // OPT 1 drives the Achat / price disclosure
                    })
                  }
                />
              )))}

              <tr><td colSpan={3} className="pt-2"><div className="h-px bg-[#bccbd8]" /></td></tr>

              {type === "lease" ? (
                <>
                  {row(t("Coût capitalisé"), both((i) => <NumField value={calc.options[i].capCost} readOnly />))}
                  {row(t("Valeur résiduelle"), both((i) => <NumField value={calc.options[i].residual} readOnly />))}
                  {row(t("Paiement"), both((i) => <NumField value={calc.options[i].payment} readOnly />))}
                  {row(t("Taxes"), both((i) => <NumField value={calc.options[i].taxOnPayment} readOnly />))}
                  {row(t("PAIEMENT TOTAL"), both((i) => <NumField value={calc.options[i].totalPayment} readOnly hl className="font-bold" />), true)}
                  {podRow}
                  {row(t("Payable à la livraison"), both((i) => deliveryBreakdown(i)))}
                  {row(t("Dû à la livraison"), both((i) => <NumField value={calc.options[i].dueOnDelivery} readOnly className="font-semibold" />), true)}
                  {row(t("Frais fin. implicites"), both((i) => <NumField value={calc.options[i].costOfBorrowing} readOnly />))}
                  {row(t("Coût total location"), both((i) => <NumField value={calc.options[i].totalLeaseCost} readOnly />))}
                </>
              ) : (
                <>
                  {row(t("Montant financé"), both((i) => <NumField value={calc.options[i].amountFinanced} readOnly />))}
                  {row(t("Nb. paiements"), both((i) => <NumField value={calc.options[i].n} decimals={0} readOnly />))}
                  {row(t("PAIEMENT"), both((i) => <NumField value={calc.options[i].payment} readOnly hl className="font-bold" />), true)}
                  {row(t("Coût d'emprunt"), both((i) => <NumField value={calc.options[i].costOfBorrowing} readOnly />))}
                  {row(t("Obligation totale"), both((i) => <NumField value={calc.options[i].totalObligation} readOnly />))}
                  {podRow}
                  {row(t("Payable à la livraison"), both((i) => deliveryBreakdown(i)))}
                  {row(t("Dû à la livraison"), both((i) => <NumField value={calc.options[i].dueOnDelivery} readOnly className="font-semibold" />), true)}
                </>
              )}
            </tbody>
          </table>
          <RollbackPanel data={data} upd={upd} calc={calc} lenders={lenders} settings={settings} />
          {calc.options[0].lender?.notes && (
            <p className="mt-2 text-[11px] text-[#003a5d] border-t border-[#bccbd8] pt-1">
              <b>{calc.options[0].lender.shortName} :</b> {calc.options[0].lender.notes}
            </p>
          )}
        </div>
      )}

      <ProfitStrip calc={calc} />
    </div>
  );
}

/** Bottom profit strip — hidden by default, click to reveal (incl. dealer net profit). */
function ProfitStrip({ calc }: { calc: DealCalc }) {
  const t = useT();
  const [open, setOpen] = useState(false);
  const pf = calc.profit;
  const net = pf.total - pf.totalCommission;
  const cell = (label: string, v: number, cls = "ro") => (
    <div>
      <div className="lbl text-xs">{label}</div>
      <div className={`fld ${cls} num flex items-center justify-end ${cls === "hl" ? "font-bold" : ""}`}>{fmtDesk(v)}</div>
    </div>
  );
  return (
    <div className="sec px-3 py-2">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center gap-2 text-left text-[13px] text-[#1e3a50] font-semibold hover:text-[#005a96]"
        title={open ? t("Masquer le profit") : t("Afficher le profit")}
      >
        <span className="inline-block w-4 text-center">{open ? "▾" : "▸"}</span>
        {open ? t("Masquer le profit") : t("Afficher le profit")}
        {!open && <span className="ml-auto tracking-[0.3em] text-[#9a9a9a]">••••••</span>}
      </button>
      {open && (
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 text-center mt-2">
          {cell(t("Profit avant"), pf.front)}
          {cell(t("Profit arrière"), pf.back)}
          {cell(t("Frais de concession"), pf.fees)}
          {cell(t("Profit total"), pf.total)}
          {cell(t("Profit net concession"), net, "hl")}
        </div>
      )}
    </div>
  );
}
