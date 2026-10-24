"use client";

import { useT } from "@/lib/i18n";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { PROVINCES, type DealerSettings, type Lender } from "@/lib/deal";
import { F, NumField, TextField } from "./fields";
import LeaseResidualEditor from "./LeaseResidualEditor";
import IncentivesEditor from "./IncentivesEditor";
import ProductsEditor from "./ProductsEditor";
import StaffSelect from "./StaffSelect";
import DivisorsEditor from "./DivisorsEditor";
import TermsDefaultsEditor from "./TermsDefaultsEditor";
import ProtectionPlansEditor from "./ProtectionPlansEditor";

export default function SettingsEditor({ initial, lenders }: { initial: DealerSettings; lenders: Lender[] }) {
  const t = useT();
  const [s, setS] = useState(initial);
  const [status, setStatus] = useState("");
  const first = useRef(true);

  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    setStatus("…");
    const t = setTimeout(async () => {
      const res = await fetch("/api/settings", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(s) });
      setStatus(res.ok ? "ok" : "err");
    }, 600);
    return () => clearTimeout(t);
  }, [s]);

  const txt = (k: keyof DealerSettings) => (v: string) => setS((x) => ({ ...x, [k]: v }));

  const sections: { group: string; items: { key: string; icon: string; title: string; desc: string }[] }[] = [
    {
      group: t("Concession"),
      items: [
        { key: "dealer", icon: "", title: t("Informations de la concession"), desc: t("Nom, adresse et numéros de taxes imprimés sur les feuilles et contrats.") },
        { key: "defaults", icon: "", title: t("Valeurs par défaut"), desc: t("Province, vendeur et frais appliqués à chaque nouveau dossier.") },
      ],
    },
    {
      group: t("Financement & location"),
      items: [
        { key: "lenders", icon: "", title: t("Prêteurs par défaut"), desc: t("Prêteur choisi automatiquement en financement et en location.") },
        { key: "terms", icon: "", title: t("Termes & structure OPT 1 / OPT 2"), desc: t("Termes offerts et structure par défaut des deux options.") },
        { key: "lease", icon: "", title: t("Résiduels & kilométrage"), desc: t("Résiduel par terme et frais mensuels selon le kilométrage.") },
        { key: "incentives", icon: "", title: t("Rabais manufacturiers"), desc: t("Remises (R.M. non taxables) et offres de taux réduit.") },
      ],
    },
    {
      group: t("Produits & profit"),
      items: [
        { key: "profit", icon: "", title: t("Profit par produit"), desc: t("Marges et commissions par produit, frais de concession.") },
        { key: "plans", icon: "", title: t("Plans de protection Sym-Tech"), desc: t("Catalogue, descriptions, paliers de prix, facteurs de terme et marge.") },
        { key: "divisors", icon: "", title: t("Diviseurs garantie & pneus"), desc: t("Prix rapide de garantie et de pneus & jantes selon le prix du véhicule.") },
      ],
    },
  ];
  const all = sections.flatMap((g) => g.items);
  const [active, setActive] = useState<string>("dealer");
  useEffect(() => {
    const h = window.location.hash.replace("#", "");
    if (h && ["dealer", "defaults", "lenders", "terms", "lease", "incentives", "profit", "plans", "divisors"].includes(h)) setActive(h);
  }, []);
  const cur = all.find((x) => x.key === active) ?? all[0];
  const go = (k: string) => {
    setActive(k);
    history.replaceState(null, "", `#${k}`);
  };
  const patch = (p: Partial<DealerSettings>) => setS((x) => ({ ...x, ...p }));

  const content: Record<string, ReactNode> = {
    dealer: (
      <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-2 p-3">
        <F label={t("Nom")}><TextField value={s.dealerName} onChange={txt("dealerName")} /></F>
        <F label={t("Raison sociale")}><TextField value={s.legalName} onChange={txt("legalName")} /></F>
        <F label={t("Adresse")} wide><TextField value={s.address} onChange={txt("address")} /></F>
        <F label={t("Téléphone")}><TextField value={s.tel} onChange={txt("tel")} /></F>
        <F label={t("Télécopieur")}><TextField value={s.fax} onChange={txt("fax")} /></F>
        <F label={t("# Concession")}><TextField value={s.dealerNumber} onChange={txt("dealerNumber")} /></F>
        <F label={t("Courriel")}><TextField value={s.email} onChange={txt("email")} /></F>
        <F label={t("# TPS/TVH")}><TextField value={s.gstNumber} onChange={txt("gstNumber")} /></F>
        <F label={t("# TVQ")}><TextField value={s.qstNumber} onChange={txt("qstNumber")} /></F>
      </div>
    ),
    defaults: (
      <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-2 p-3">
        <F label={t("Province / Taxation")}>
          <select className="fld" value={s.defaultProvince} onChange={(e) => txt("defaultProvince")(e.target.value)}>
            {PROVINCES.map((p) => <option key={p.code} value={p.code}>{p.name}</option>)}
          </select>
        </F>
        <F label={t("Vendeur par défaut")}><StaffSelect value={s.defaultSalesperson} onChange={txt("defaultSalesperson")} /></F>
        <F label={t("Transport & PDI")}><NumField value={s.defaultFreight} onChange={(n) => setS((x) => ({ ...x, defaultFreight: n }))} /></F>
        <F label={t("Frais de concession")}><NumField value={s.defaultAdminFees} onChange={(n) => setS((x) => ({ ...x, defaultAdminFees: n }))} /></F>
        <F label={t("Taxe pneus")}><NumField value={s.defaultTireTax} onChange={(n) => setS((x) => ({ ...x, defaultTireTax: n }))} /></F>
        <F label={t("Acompte remboursable")}><NumField value={s.defaultRefundableDeposit} onChange={(n) => setS((x) => ({ ...x, defaultRefundableDeposit: n }))} /></F>
        <F label={t("Dépôt sécurité")}><NumField value={s.defaultSecurityDeposit} onChange={(n) => setS((x) => ({ ...x, defaultSecurityDeposit: n }))} /></F>
        <F label={t("Rabais max. sans approbation (%)")}><NumField value={s.maxDiscountPct} onChange={(n) => setS((x) => ({ ...x, maxDiscountPct: n }))} suffix=" %" /></F>
        <F label={t("Code du gestionnaire")}>
          <input
            className="fld font-mono"
            type="password"
            autoComplete="new-password"
            placeholder={s.managerCode ? "" : t("(réservé aux administrateurs)")}
            value={s.managerCode}
            onChange={(e) => setS((x) => ({ ...x, managerCode: e.target.value.replace(/\s/g, "") }))}
          />
        </F>
        <F label={t("Km excéd. ($/km)")}><NumField value={s.excessKmCharge} onChange={(n) => setS((x) => ({ ...x, excessKmCharge: n }))} /></F>
      </div>
    ),
    lenders: (
      <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-2 p-3">
        <F label={t("Financement")}>
          <select
            className="fld"
            value={s.defaultFinanceLenderId ?? ""}
            onChange={(e) => setS((x) => ({ ...x, defaultFinanceLenderId: e.target.value ? Number(e.target.value) : null }))}
          >
            <option value="">{t("(premier de la liste)")}</option>
            {lenders.filter((l) => l.active && l.allowFinance).map((l) => (
              <option key={l.id} value={l.id}>{l.name}</option>
            ))}
          </select>
        </F>
        <F label={t("Location")}>
          <select
            className="fld"
            value={s.defaultLeaseLenderId ?? ""}
            onChange={(e) => setS((x) => ({ ...x, defaultLeaseLenderId: e.target.value ? Number(e.target.value) : null }))}
          >
            <option value="">{t("(premier de la liste)")}</option>
            {lenders.filter((l) => l.active && l.allowLease).map((l) => (
              <option key={l.id} value={l.id}>{l.name}</option>
            ))}
          </select>
        </F>
        <p className="md:col-span-2 text-xs text-[#003a5d]">
          {t("Le prêteur par défaut est sélectionné automatiquement sur chaque nouveau dossier et lorsque vous passez en Financement ou en Location.")}
        </p>
      </div>
    ),
    terms: <TermsDefaultsEditor s={s} onChange={patch} />,
    lease: <LeaseResidualEditor residualTerms={s.residualTerms} kmTiers={s.kmTiers} baseKm={s.baseKm} onChange={patch} />,
    incentives: <IncentivesEditor list={s.incentives} onChange={(incentives) => patch({ incentives })} />,
    profit: <ProductsEditor products={s.products} profitPct={s.profitPct} commission={s.commission} onChange={patch} />,
    plans: <ProtectionPlansEditor s={s} onChange={patch} />,
    divisors: <DivisorsEditor warrantyDivisors={s.warrantyDivisors} tireRimFormula={s.tireRimFormula} onChange={patch} />,
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[250px_minmax(0,1fr)] gap-4 items-start">
      {/* ---------- navigation ---------- */}
      <aside className="bg-white rounded-md border border-[#cbd8e3] shadow-[0_1px_3px_rgba(0,38,61,0.08)] overflow-hidden lg:sticky lg:top-[72px]">
        <div className="px-4 py-3 bg-gradient-to-r from-[#00263d] to-[#0a4a73] text-white">
          <div className="text-[15px] font-bold">{t("Paramètres")}</div>
          <div className="text-[11px] text-[#b9d2e5] flex items-center gap-1.5 mt-0.5">
            <span className={`h-1.5 w-1.5 rounded-full ${status === "err" ? "bg-red-400" : status === "…" ? "bg-amber-300 animate-pulse" : "bg-emerald-400"}`} />
            {status === "…" ? t("Sauvegarde…") : status === "err" ? t("Erreur") : t("Sauvegarde automatique")}
          </div>
        </div>
        <nav className="py-2">
          {sections.map((g) => (
            <div key={g.group} className="mb-1">
              <div className="px-4 pt-2 pb-1 text-[10px] font-bold uppercase tracking-[0.14em] text-[#0071bc]">{g.group}</div>
              {g.items.map((it) => (
                <button
                  key={it.key}
                  onClick={() => go(it.key)}
                  className={`w-full flex items-center gap-2.5 px-4 py-2 text-[13px] text-left border-l-[3px] transition-colors ${
                    active === it.key ? "border-[#0071bc] bg-[#e6f1fa] text-[#00263d] font-semibold" : "border-transparent text-[#1e3a50] hover:bg-[#f4f8fb]"
                  }`}
                >
                  <span className="truncate">{it.title}</span>
                </button>
              ))}
            </div>
          ))}
        </nav>
      </aside>

      {/* ---------- content ---------- */}
      <section className="bg-white rounded-md border border-[#cbd8e3] shadow-[0_1px_3px_rgba(0,38,61,0.08)] min-w-0">
        <header className="flex items-start gap-3 px-5 py-4 border-b border-[#e3eaf1]">
          <span className="h-10 w-1.5 shrink-0 rounded-full bg-[#0071bc]" />
          <div className="min-w-0">
            <h2 className="text-[18px] font-bold text-[#00263d] leading-tight">{cur.title}</h2>
            <p className="text-[12.5px] text-[#5a7086] mt-0.5">{cur.desc}</p>
          </div>
          <span
            className={`ml-auto shrink-0 text-[11px] font-semibold px-2.5 py-1 rounded-full ${
              status === "err" ? "bg-red-50 text-red-700" : status === "…" ? "bg-amber-50 text-amber-800" : status === "ok" ? "bg-emerald-50 text-emerald-700" : "bg-[#f4f7fa] text-[#5a7086]"
            }`}
          >
            {status === "…" ? t("Sauvegarde…") : status === "err" ? `${t("Erreur")}` : status === "ok" ? `✓ ${t("Sauvegardé")}` : t("À jour")}
          </span>
        </header>
        <div className="settings-body">{content[active]}</div>
      </section>
    </div>
  );
}
