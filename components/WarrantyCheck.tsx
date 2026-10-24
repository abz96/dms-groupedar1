"use client";

import Link from "next/link";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import { fmtDesk, planDescription, planPrice, type DealerSettings, type PlanCategory, type ProtectionPlan } from "@/lib/deal";
import { useLang } from "@/lib/i18n";
import { NumField } from "./fields";
import { CATEGORY_COLOR, CATEGORY_LABEL } from "./PlanPicker";

interface Coverage {
  label: string;
  years: number;
  km: number | null;
  expiresOn: string;
  active: boolean;
  expiredBy: "time" | "km" | null;
  daysLeft: number;
  kmLeft: number | null;
}
interface Registered {
  dealId: number;
  dealNumber: string;
  dealStatus: string;
  customer: string;
  name: string;
  code: string | null;
  kind: string;
  term: number | null;
  price: number;
  purchased: string;
  expiresOn: string | null;
  active: boolean | null;
}
interface Result {
  vin: string;
  checkDigitValid: boolean;
  vehicle: { make: string; model: string; year: number | null; trim: string; body: string; engine: string; fuel: string; drive: string; plant: string; source: string };
  km: number | null;
  kmSource: "input" | "database" | null;
  inService: string | null;
  inServiceSource: "input" | "database" | "estimated";
  oem: { note?: string } | null;
  coverages: Coverage[];
  inventory: { id: number; stock: string; price: number; kms: number; status: string } | null;
  registered: Registered[];
  history: { dealId: number; dealNumber: string; role: "vehicle" | "trade"; customer: string; status: string; date: string }[];
}

const KIND: Record<string, string> = { warranty: "Garantie prolongée", tireRim: "Protection pneus & jantes", accessory: "Accessoire / protection", fi: "Produit F&A" };
const EXAMPLES = ["5YJYGDEE5RF987654", "2T3RWRFV8RW123456"];

const Shield = ({ className = "" }: { className?: string }) => (
  <svg viewBox="0 0 24 24" className={className} fill="currentColor" aria-hidden>
    <path d="M12 1L3 5v6c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V5l-9-4zm-2 16l-4-4 1.41-1.41L10 14.17l6.59-6.59L18 9l-8 8z" />
  </svg>
);

function StatusPill({ ok, warn, label }: { ok: boolean; warn?: boolean; label: string }) {
  const cls = ok ? "bg-emerald-50 text-emerald-700 ring-emerald-600/30" : warn ? "bg-amber-50 text-amber-800 ring-amber-600/30" : "bg-red-50 text-red-700 ring-red-600/30";
  const dot = ok ? "bg-emerald-500" : warn ? "bg-amber-500" : "bg-red-500";
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[11px] font-bold tracking-wide ring-1 ring-inset ${cls}`}>
      <span className={`h-1.5 w-1.5 rounded-full ${dot}`} />
      {label}
    </span>
  );
}

function Card({ title, icon, right, children, className = "" }: { title: string; icon?: ReactNode; right?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <section className={`bg-white rounded-md border border-[#cbd8e3] shadow-[0_1px_3px_rgba(0,38,61,0.08)] ${className}`}>
      <header className="flex items-center gap-2 px-4 py-2.5 border-b border-[#e3eaf1]">
        {icon && <span className="text-[#0071bc]">{icon}</span>}
        <h3 className="text-[13px] font-bold uppercase tracking-wider text-[#00263d]">{title}</h3>
        <div className="ml-auto">{right}</div>
      </header>
      <div className="p-4">{children}</div>
    </section>
  );
}

function Bar({ pct, ok }: { pct: number; ok: boolean }) {
  const p = Math.max(0, Math.min(100, pct));
  return (
    <div className="h-2 rounded-full bg-[#e3eaf1] overflow-hidden">
      <div className={`h-full rounded-full ${ok ? (p > 80 ? "bg-amber-500" : "bg-emerald-500") : "bg-red-500"}`} style={{ width: `${p}%` }} />
    </div>
  );
}

export default function WarrantyCheck({ initialVin }: { initialVin: string }) {
  const { t, lang } = useLang();
  const loc = lang === "fr" ? "fr-CA" : "en-CA";
  const [tab, setTab] = useState<"check" | "products" | "catalogue">("check");
  const [vin, setVin] = useState(initialVin.toUpperCase());
  const [km, setKm] = useState("");
  const [inService, setInService] = useState("");
  const [res, setRes] = useState<Result | null>(null);
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const [settings, setSettings] = useState<DealerSettings | null>(null);
  const [quotePrice, setQuotePrice] = useState(45000);
  const [quoteVehicle, setQuoteVehicle] = useState("");

  useEffect(() => {
    fetch("/api/settings").then(async (r) => setSettings(await r.json()));
  }, []);
  useEffect(() => {
    if (initialVin) void check(initialVin);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const clean = vin.replace(/[^A-Za-z0-9]/g, "").toUpperCase();
  const fmtErr = clean.length && clean.length !== 17 ? t("Le NIV doit contenir 17 caractères.") : /[IOQ]/.test(clean) ? t("Le NIV ne peut pas contenir les lettres I, O ou Q.") : "";

  async function check(v = clean) {
    setBusy(true);
    setErr("");
    const qs = new URLSearchParams({ vin: v });
    if (km) qs.set("km", km);
    if (inService) qs.set("inService", inService);
    const r = await fetch(`/api/warranty-check?${qs}`);
    const j = await r.json();
    setBusy(false);
    if (!r.ok) {
      setErr(t(j.error ?? "Erreur"));
      setRes(null);
      return;
    }
    setRes(j);
    if (j.inventory?.price) setQuotePrice(j.inventory.price);
    setQuoteVehicle([j.vehicle.year, j.vehicle.make, j.vehicle.model, j.vehicle.trim].filter(Boolean).join(" "));
  }

  const plans = useMemo(
    () => (settings?.protectionPlans ?? []).filter((p) => p.active && (p.section === "warranty" || p.section === "tireRim")),
    [settings],
  );
  const allPlans = useMemo(() => (settings?.protectionPlans ?? []).filter((p) => p.active), [settings]);
  const years = useMemo(() => Object.keys(settings?.termFactors ?? {}).map(Number).sort((a, b) => a - b), [settings]);
  const dt = (d: string) => new Date(d + "T12:00:00").toLocaleDateString(loc, { year: "numeric", month: "short", day: "numeric" });
  const yr = (n: number) => `${n} ${n > 1 ? t("ans") : t("an")}`;

  const factoryActive = res?.coverages.filter((c) => c.active).length ?? 0;
  const factoryStatus = !res?.coverages.length ? null : factoryActive === res.coverages.length ? "all" : factoryActive > 0 ? "partial" : "none";
  const activePlans = res?.registered.filter((r) => r.active !== false).length ?? 0;
  const title = res ? [res.vehicle.year, res.vehicle.make, res.vehicle.model].filter(Boolean).join(" ") || t("Véhicule inconnu") : "";

  return (
    <div className="space-y-4">
      {/* ================= header + tabs ================= */}
      <div className="rounded-md overflow-hidden shadow-[0_2px_8px_rgba(0,38,61,0.18)] no-print">
        <div className="bg-gradient-to-r from-[#00263d] via-[#003a5d] to-[#0a5a8c] text-white px-6 pt-5 pb-4">
          <div className="flex items-start gap-4">
            <div className="h-12 w-12 shrink-0 rounded-lg bg-white/10 ring-1 ring-white/20 flex items-center justify-center">
              <Shield className="h-7 w-7 text-[#6fc0f5]" />
            </div>
            <div className="min-w-0">
              <h1 className="text-[22px] font-bold tracking-tight">{t("Vérification garantie & protection")}</h1>
              <p className="text-[13px] text-[#b9d2e5] max-w-3xl mt-0.5">
                {t("Recherche instantanée par NIV : garantie d'usine du fabricant (OEM), statut actif ou expiré, kilométrage et plans de protection Sym-Tech enregistrés dans notre base de données.")}
              </p>
            </div>
          </div>
          <div className="flex gap-1 mt-4">
            {(["check", "products", "catalogue"] as const).map((k) => (
              <button
                key={k}
                onClick={() => setTab(k)}
                className={`px-4 py-2 text-[13px] font-semibold rounded-t-md transition ${tab === k ? "bg-[#f4f7fa] text-[#00263d]" : "text-[#cfe3f2] hover:bg-white/10"}`}
              >
                {k === "check" ? `${t("Vérification NIV")}` : k === "products" ? `${t("Catalogue Sym-Tech")}` : `${t("Soumission garantie & pneus")}`}
              </button>
            ))}
          </div>
        </div>

        {tab === "check" && (
          <div className="bg-[#f4f7fa] px-6 py-5 border-t border-white/10">
            <form
              data-enter-submit
              className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_170px_180px_auto] gap-3 items-end"
              onSubmit={(e) => {
                e.preventDefault();
                if (!fmtErr && clean.length === 17) void check();
              }}
            >
              <label className="block">
                <span className="text-[11px] font-bold uppercase tracking-wider text-[#3c5266]">{t("NIV")}</span>
                <div className="relative mt-1">
                  <input
                    className="w-full h-12 rounded-md border border-[#9fb3c4] bg-white pl-4 pr-16 font-mono text-[18px] tracking-[0.22em] uppercase text-[#00263d] outline-none focus:border-[#0071bc] focus:ring-2 focus:ring-[#0071bc]/25"
                    maxLength={20}
                    placeholder="5YJYGDEE5RF987654"
                    value={vin}
                    onChange={(e) => setVin(e.target.value.toUpperCase())}
                    autoFocus
                  />
                  <span className={`absolute right-3 top-1/2 -translate-y-1/2 text-[12px] font-semibold tabular-nums ${clean.length === 17 && !fmtErr ? "text-emerald-600" : "text-[#93a8ba]"}`}>
                    {clean.length}/17
                  </span>
                </div>
              </label>
              <label className="block">
                <span className="text-[11px] font-bold uppercase tracking-wider text-[#3c5266]">{t("Kilométrage actuel")}</span>
                <input
                  className="mt-1 w-full h-12 rounded-md border border-[#9fb3c4] bg-white px-3 text-[14px] outline-none focus:border-[#0071bc] focus:ring-2 focus:ring-[#0071bc]/25"
                  inputMode="numeric"
                  placeholder={t("optionnel")}
                  value={km}
                  onChange={(e) => setKm(e.target.value.replace(/\D/g, ""))}
                />
              </label>
              <label className="block">
                <span className="text-[11px] font-bold uppercase tracking-wider text-[#3c5266]">{t("Mise en service")}</span>
                <input
                  className="mt-1 w-full h-12 rounded-md border border-[#9fb3c4] bg-white px-3 text-[14px] outline-none focus:border-[#0071bc] focus:ring-2 focus:ring-[#0071bc]/25"
                  type="date"
                  value={inService}
                  onChange={(e) => setInService(e.target.value)}
                />
              </label>
              <button
                className="h-12 rounded-md bg-[#0071bc] hover:bg-[#005a96] disabled:opacity-50 text-white font-bold px-7 text-[14px] shadow-sm flex items-center justify-center gap-2"
                disabled={busy || clean.length !== 17 || !!fmtErr}
              >
                <Shield className="h-4 w-4" />
                {busy ? t("Vérification…") : t("Vérifier la garantie")}
              </button>
            </form>
            <div className="flex flex-wrap items-center gap-2 mt-2.5 text-[12px] text-[#5a7086]">
              <span>{t("Entrez le NIV de 17 caractères")} — {t("ex.")}</span>
              {EXAMPLES.map((x) => (
                <button key={x} className="font-mono rounded bg-white border border-[#cbd8e3] px-2 py-0.5 text-[#0071bc] hover:border-[#0071bc]" onClick={() => setVin(x)}>
                  {x}
                </button>
              ))}
            </div>
            {(fmtErr || err) && <div className="mt-2 text-[13px] text-red-700 font-semibold">{fmtErr || err}</div>}
          </div>
        )}
      </div>

      {/* ================= results ================= */}
      {tab === "check" && !res && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          {[
            ["", t("Garantie d'usine (OEM)"), t("Couverture de base et groupe motopropulseur, avec dates et kilométrage limites.")],
            ["", t("Statut actif / expiré"), t("Temps et kilométrage restants calculés instantanément.")],
            ["", t("Plans Sym-Tech enregistrés"), t("Plans vendus sur ce NIV dans nos dossiers, avec leur échéance.")],
          ].map(([i, h, p]) => (
            <div key={h} className="bg-white rounded-md border border-[#cbd8e3] p-4">
              <div className="font-bold text-[#00263d] text-[14px] mt-1">{h}</div>
              <div className="text-[12px] text-[#5a7086] mt-0.5">{p}</div>
            </div>
          ))}
        </div>
      )}

      {tab === "check" && res && (
        <>
          {/* summary */}
          <div className="bg-white rounded-md border border-[#cbd8e3] shadow-[0_1px_3px_rgba(0,38,61,0.08)] p-4 flex flex-wrap items-center gap-4">
            <div className="min-w-0 flex-1">
              <div className="text-[11px] font-bold uppercase tracking-wider text-[#5a7086]">{t("Résultat de la vérification")}</div>
              <div className="text-[22px] font-bold text-[#00263d] leading-tight">{title}</div>
              <div className="flex flex-wrap items-center gap-2 mt-1">
                {res.vehicle.trim && <span className="text-[13px] text-[#3c5266]">{res.vehicle.trim}</span>}
                <span className="font-mono text-[12px] tracking-wider bg-[#eef3f7] border border-[#cbd8e3] rounded px-2 py-0.5 text-[#00263d]">{res.vin}</span>
                {!res.checkDigitValid && <StatusPill ok={false} warn label={t("Chiffre de contrôle à vérifier")} />}
                {res.inventory && <StatusPill ok label={`${t("En inventaire")} #${res.inventory.stock}`} />}
              </div>
            </div>
            <div className="grid grid-cols-3 gap-2 min-w-[420px]">
              {[
                {
                  k: t("Garantie d'usine"),
                  v: factoryStatus === "all" ? t("Active") : factoryStatus === "partial" ? t("Partielle") : factoryStatus === "none" ? t("Expirée") : "—",
                  c: factoryStatus === "all" ? "text-emerald-700" : factoryStatus === "partial" ? "text-amber-700" : factoryStatus === "none" ? "text-red-700" : "text-[#5a7086]",
                },
                { k: t("Plans actifs"), v: String(activePlans), c: activePlans ? "text-emerald-700" : "text-[#5a7086]" },
                { k: t("Kilométrage"), v: res.km !== null ? `${res.km.toLocaleString(loc)} km` : "—", c: "text-[#00263d]" },
              ].map((x) => (
                <div key={x.k} className="rounded-md bg-[#f4f7fa] border border-[#e3eaf1] px-3 py-2">
                  <div className="text-[10px] font-bold uppercase tracking-wider text-[#5a7086]">{x.k}</div>
                  <div className={`text-[18px] font-bold ${x.c}`}>{x.v}</div>
                </div>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,1.35fr)_minmax(0,1fr)] gap-4">
            {/* OEM coverage */}
            <Card title={t("Garantie d'usine (OEM)")} icon="" right={<span className="text-[11px] text-[#93a8ba]">{t("Fabricant")} : {res.vehicle.make || "—"}</span>}>
              {!res.oem ? (
                <div className="text-[13px] text-[#5a7086]">{t("Fabricant non reconnu — garantie d'usine non disponible.")}</div>
              ) : res.coverages.length === 0 ? (
                <div className="text-[13px] text-[#5a7086]">{t("Entrez la date de mise en service pour calculer le statut.")}</div>
              ) : (
                <div className="space-y-4">
                  {res.coverages.map((c) => {
                    const total = c.years * 365;
                    const used = total - c.daysLeft;
                    const timePct = (used / total) * 100;
                    const kmPct = c.km && res.km !== null ? (res.km / c.km) * 100 : null;
                    return (
                      <div key={c.label} className="rounded-md border border-[#e3eaf1] p-3">
                        <div className="flex items-center gap-2">
                          <div className="font-bold text-[14px] text-[#00263d]">{t(c.label)}</div>
                          <div className="ml-auto"><StatusPill ok={c.active} label={c.active ? t("ACTIVE") : t("EXPIRÉE")} /></div>
                        </div>
                        <div className="text-[12px] text-[#5a7086] mt-0.5">
                          {yr(c.years)} / {c.km === null ? t("km illimité") : `${c.km.toLocaleString(loc)} km`} · {t("Échéance")} {dt(c.expiresOn)}
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-2.5">
                          <div>
                            <div className="flex justify-between text-[11px] text-[#3c5266] mb-1">
                              <span>{t("Temps")}</span>
                              <span className="font-semibold">
                                {c.daysLeft > 0 ? `${Math.floor(c.daysLeft / 30)} ${t("mois")} ${t("restant")}` : `${t("Expirée depuis")} ${Math.abs(Math.floor(c.daysLeft / 30))} ${t("mois")}`}
                              </span>
                            </div>
                            <Bar pct={timePct} ok={c.daysLeft > 0} />
                          </div>
                          <div>
                            <div className="flex justify-between text-[11px] text-[#3c5266] mb-1">
                              <span>{t("Kilométrage")}</span>
                              <span className="font-semibold">
                                {c.km === null ? t("Illimité") : c.kmLeft === null ? t("Inconnu") : c.kmLeft > 0 ? `${c.kmLeft.toLocaleString(loc)} km ${t("restant")}` : t("Kilométrage dépassé")}
                              </span>
                            </div>
                            {kmPct === null ? <div className="h-2 rounded-full bg-[repeating-linear-gradient(45deg,#e3eaf1,#e3eaf1_6px,#f4f7fa_6px,#f4f7fa_12px)]" /> : <Bar pct={kmPct} ok={c.kmLeft === null || c.kmLeft > 0} />}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                  {res.oem?.note && <div className="text-[11px] text-[#5a7086]">{t(res.oem.note)}</div>}
                </div>
              )}
              <div className="text-[10px] text-[#93a8ba] mt-3">
                {t("Couverture standard du fabricant au Canada (véhicules neufs) — à confirmer auprès du fabricant.")}
                {res.inService && ` · ${t("Mise en service")} : ${dt(res.inService)} (${res.inServiceSource === "input" ? t("saisie") : res.inServiceSource === "database" ? t("notre base de données") : t("estimée selon l'année modèle")})`}
              </div>
            </Card>

            {/* vehicle specs */}
            <Card title={t("Fiche du véhicule")} icon="" right={<span className="text-[10px] text-[#93a8ba]">{res.vehicle.source === "nhtsa" ? "NHTSA vPIC" : t("Décodage local")}</span>}>
              <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1.5 text-[13px]">
                {(
                  [
                    [t("Année"), res.vehicle.year ? String(res.vehicle.year) : ""],
                    [t("Marque"), res.vehicle.make],
                    [t("Modèle"), res.vehicle.model],
                    [t("Version"), res.vehicle.trim],
                    [t("Carrosserie"), res.vehicle.body],
                    [t("Moteur"), res.vehicle.engine],
                    [t("Carburant"), res.vehicle.fuel],
                    [t("Traction"), res.vehicle.drive],
                    [t("Usine"), res.vehicle.plant],
                    [t("Kilométrage"), res.km !== null ? `${res.km.toLocaleString(loc)} km · ${res.kmSource === "input" ? t("saisi") : t("notre base de données")}` : t("Inconnu — entrez le kilométrage")],
                  ] as [string, string][]
                )
                  .filter(([, v]) => v)
                  .map(([k, v]) => (
                    <div key={k} className="contents">
                      <dt className="text-[#5a7086]">{k}</dt>
                      <dd className="font-semibold text-[#00263d]">{v}</dd>
                    </div>
                  ))}
              </dl>
              {res.inventory && (
                <div className="mt-3 rounded-md bg-[#e6f1fa] border border-[#b9d2e5] px-3 py-2 text-[12px] text-[#003a5d]">
                  {t("En inventaire")} — #{res.inventory.stock} · {fmtDesk(res.inventory.price)} $ · {res.inventory.kms.toLocaleString(loc)} km
                </div>
              )}
              {!res.checkDigitValid && (
                <div className="mt-3 rounded-md bg-amber-50 border border-amber-200 px-3 py-2 text-[11px] text-amber-800">
                  {t("Chiffre de contrôle (9e caractère) invalide — vérifiez le NIV. Les NIV européens peuvent ne pas l'utiliser.")}
                </div>
              )}
            </Card>
          </div>

          {/* Sym-Tech registry */}
          <Card
            title={t("Plans Sym-Tech enregistrés")}
            icon=""
            right={
              <button className="text-[12px] font-semibold text-[#0071bc] hover:underline" onClick={() => setTab("products")}>
                {t("Voir les plans offerts")} →
              </button>
            }
          >
            {res.registered.length === 0 ? (
              <div className="flex items-center gap-3 rounded-md border border-dashed border-[#9fb3c4] bg-[#f8fafc] px-4 py-4">
                <Shield className="h-8 w-8 text-[#9fb3c4]" />
                <div>
                  <div className="font-semibold text-[#00263d] text-[13px]">{t("Aucun plan de protection enregistré pour ce NIV dans notre base de données.")}</div>
                  <div className="text-[12px] text-[#5a7086]">{t("Proposez une garantie prolongée ou une protection pneus & jantes au client.")}</div>
                </div>
              </div>
            ) : (
              <div className="overflow-x-auto -mx-4 -my-4">
                <table className="w-full text-[13px]">
                  <thead>
                    <tr className="bg-[#f4f7fa] text-[11px] uppercase tracking-wider text-[#5a7086]">
                      <th className="text-left px-4 py-2 font-bold">{t("Plan")}</th>
                      <th className="text-left px-3 py-2 font-bold">{t("Type")}</th>
                      <th className="text-left px-3 py-2 font-bold">{t("Terme")}</th>
                      <th className="text-left px-3 py-2 font-bold">{t("Couverture")}</th>
                      <th className="text-right px-3 py-2 font-bold">{t("Prix")}</th>
                      <th className="text-left px-3 py-2 font-bold">{t("Client / dossier")}</th>
                      <th className="text-right px-4 py-2 font-bold">{t("Statut")}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {res.registered.map((r, i) => (
                      <tr key={i} className="border-t border-[#e3eaf1] hover:bg-[#f8fafc]">
                        <td className="px-4 py-2">
                          <div className="font-semibold text-[#00263d]">{t(r.name)}</div>
                          {r.code && <div className="font-mono text-[10px] text-[#5a7086]">{r.code}</div>}
                        </td>
                        <td className="px-3 py-2 text-[#3c5266]">{t(KIND[r.kind] ?? r.kind)}</td>
                        <td className="px-3 py-2">{r.term ? yr(r.term) : "—"}</td>
                        <td className="px-3 py-2 text-[12px] text-[#3c5266] whitespace-nowrap">{dt(r.purchased)}{r.expiresOn ? ` → ${dt(r.expiresOn)}` : ""}</td>
                        <td className="px-3 py-2 text-right tabular-nums font-semibold">{fmtDesk(r.price)} $</td>
                        <td className="px-3 py-2 text-[12px]">
                          <div>{r.customer || "—"}</div>
                          <Link className="text-[#0071bc] hover:underline" href={`/deals/${r.dealId}`}>{t("Dossier")} {r.dealNumber}</Link>
                          {r.dealStatus !== "sold" && <span className="text-amber-700"> · {t("dossier non vendu")}</span>}
                        </td>
                        <td className="px-4 py-2 text-right">{r.active === null ? "—" : <StatusPill ok={r.active} label={r.active ? t("ACTIVE") : t("EXPIRÉE")} />}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>

          {res.history.length > 0 && (
            <Card title={t("Historique dans nos dossiers")} icon="">
              <ol className="relative border-l-2 border-[#cbd8e3] ml-2 space-y-3">
                {res.history.map((h) => (
                  <li key={h.dealId} className="pl-4 relative">
                    <span className={`absolute -left-[7px] top-1 h-3 w-3 rounded-full ring-2 ring-white ${h.role === "trade" ? "bg-amber-500" : "bg-[#0071bc]"}`} />
                    <div className="text-[13px]">
                      <b className="text-[#00263d]">{h.role === "trade" ? t("Échange") : t("Véhicule vendu")}</b> · {h.customer || "—"}
                    </div>
                    <div className="text-[12px] text-[#5a7086]">
                      {new Date(h.date).toLocaleDateString(loc, { dateStyle: "medium" })} ·{" "}
                      <Link className="text-[#0071bc] hover:underline" href={`/deals/${h.dealId}`}>{t("Dossier")} {h.dealNumber}</Link>
                    </div>
                  </li>
                ))}
              </ol>
            </Card>
          )}
        </>
      )}

      {/* ================= Sym-Tech product catalogue (name + description) ================= */}
      {tab === "products" && (
        <div className="space-y-5 print-area">
          <div className="bg-white rounded-md border border-[#cbd8e3] shadow-[0_1px_3px_rgba(0,38,61,0.08)] px-5 py-4 flex flex-wrap items-center gap-3">
            <div className="flex-1 min-w-[260px]">
              <div className="text-[11px] font-bold uppercase tracking-wider text-[#5a7086]">{t("Catalogue des produits")}</div>
              <div className="text-[18px] font-bold text-[#00263d]">{t("Plans de protection Sym-Tech")}</div>
              <div className="text-[12px] text-[#5a7086]">{t("Description de chaque plan offert par la concession — à présenter au client.")}</div>
            </div>
            <span className="rounded-full bg-[#e6f1fa] text-[#003a5d] text-[12px] font-semibold px-3 py-1">{allPlans.length} {t("plan(s)")}</span>
            <button className="h-9 rounded-md border border-[#9fb3c4] bg-white hover:border-[#0071bc] text-[#00263d] font-semibold px-4 text-[13px] no-print" onClick={() => window.print()}>
              {t("Imprimer le catalogue")}
            </button>
          </div>
          {(["mechanical", "cosmetic", "antitheft", "financial"] as PlanCategory[]).map((cat) => {
            const list = allPlans.filter((p) => p.category === cat);
            if (!list.length) return null;
            return (
              <section key={cat}>
                <h2 className="flex items-center gap-2 mb-2">
                  <span className="h-5 w-1.5 rounded-full" style={{ background: CATEGORY_COLOR[cat] }} />
                  <span className="text-[13px] font-bold uppercase tracking-wider text-[#00263d]">{t(CATEGORY_LABEL[cat])}</span>
                  <span className="text-[11px] text-[#5a7086]">· {list.length}</span>
                </h2>
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
                  {list.map((p) => (
                    <article key={p.id} className="bg-white rounded-md border border-[#cbd8e3] shadow-[0_1px_3px_rgba(0,38,61,0.06)] p-4 border-l-4" style={{ borderLeftColor: CATEGORY_COLOR[cat] }}>
                      <div className="flex items-start gap-2">
                        <h3 className="text-[15px] font-bold text-[#00263d] leading-snug">{p.name}</h3>
                        <span className="ml-auto shrink-0 font-mono text-[10px] text-[#5a7086] bg-[#f4f7fa] border border-[#e3eaf1] rounded px-1.5 py-0.5">{p.code}</span>
                      </div>
                      <p className="text-[13px] text-[#3c5266] leading-relaxed mt-1.5">{planDescription(p, lang) || t("Aucune description — ajoutez-la dans Paramètres → Plans de protection.")}</p>
                    </article>
                  ))}
                </div>
              </section>
            );
          })}
          {settings && !allPlans.length && <div className="text-[13px] text-[#5a7086]">{t("Aucun plan actif.")}</div>}
        </div>
      )}

      {/* ================= catalogue & quote ================= */}
      {tab === "catalogue" && (
        <div className="space-y-4 print-area">
          <div className="bg-white rounded-md border border-[#cbd8e3] shadow-[0_1px_3px_rgba(0,38,61,0.08)] p-4">
            <div className="flex flex-wrap items-end gap-3">
              <div className="flex-1 min-w-[240px]">
                <div className="text-[11px] font-bold uppercase tracking-wider text-[#5a7086]">{t("Catalogue — Soumission garantie & pneus et jantes")}</div>
                <input
                  className="mt-1 w-full h-10 rounded-md border border-[#9fb3c4] px-3 text-[15px] font-semibold text-[#00263d] outline-none focus:border-[#0071bc]"
                  placeholder="ex. 2024 Audi Q5"
                  value={quoteVehicle}
                  onChange={(e) => setQuoteVehicle(e.target.value)}
                />
              </div>
              <label className="w-[200px]">
                <span className="text-[11px] font-bold uppercase tracking-wider text-[#5a7086]">{t("Prix de vente du véhicule")}</span>
                <NumField value={quotePrice} onChange={setQuotePrice} className="!h-10 !text-[15px] font-semibold mt-1" />
              </label>
              {settings && plans[0] && (
                <div className="rounded-md bg-[#e6f1fa] border border-[#b9d2e5] px-3 py-1.5">
                  <div className="text-[10px] font-bold uppercase tracking-wider text-[#5a7086]">{t("Palier du véhicule")}</div>
                  <div className="text-[13px] font-bold text-[#003a5d]">{planPrice(plans[0], 4, quotePrice, settings).tier?.label}</div>
                </div>
              )}
              <button className="h-10 rounded-md bg-[#0071bc] hover:bg-[#005a96] text-white font-semibold px-5 no-print" onClick={() => window.print()}>
                {t("Imprimer la soumission")}
              </button>
            </div>
            <div className="text-[11px] text-[#5a7086] mt-2">
              {t("Soumission seulement — aucun dossier créé")} · {t("Prix taxes en sus. Les prix et termes se gèrent dans Paramètres → Plans de protection.")}
            </div>
          </div>

          {(["warranty", "tireRim"] as const).map((sec) => {
            const list = plans.filter((p) => p.section === sec);
            if (!list.length || !settings) return null;
            return (
              <div key={sec}>
                <h2 className="text-[13px] font-bold uppercase tracking-wider text-[#00263d] mb-2 flex items-center gap-2">
                  {sec === "warranty" ? "" : ""} {sec === "warranty" ? t("Garantie prolongée") : t("Protection pneus & jantes")}
                  <span className="text-[11px] font-normal normal-case tracking-normal text-[#5a7086]">· {list.length} {t("plan(s)")}</span>
                </h2>
                <div className="grid grid-cols-1 lg:grid-cols-2 2xl:grid-cols-3 gap-3">
                  {list.map((p: ProtectionPlan) => (
                    <div key={p.id} className="bg-white rounded-md border border-[#cbd8e3] shadow-[0_1px_3px_rgba(0,38,61,0.06)] overflow-hidden">
                      <div className="px-4 py-3 border-b border-[#e3eaf1] flex items-start gap-2">
                        <div className="min-w-0">
                          <div className="font-bold text-[15px] text-[#00263d]">{p.name}</div>
                          <div className="text-[11px] text-[#5a7086]">
                            <span className="font-mono">{p.code}</span> · <span style={{ color: CATEGORY_COLOR[p.category] }}>{t(CATEGORY_LABEL[p.category])}</span>
                          </div>
                          <p className="text-[12px] text-[#3c5266] mt-1 line-clamp-2">{planDescription(p, lang)}</p>
                        </div>
                      </div>
                      <div className="grid grid-cols-3">
                        {years.map((y) => (
                          <div key={y} className="px-3 py-2 border-r border-b border-[#eef3f7] [&:nth-child(3n)]:border-r-0">
                            <div className="text-[10px] font-bold uppercase tracking-wider text-[#5a7086]">{yr(y)}</div>
                            <div className="text-[15px] font-bold text-[#0071bc] tabular-nums">{fmtDesk(planPrice(p, y, quotePrice, settings).retail)} $</div>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
          {settings && plans.length === 0 && <div className="text-[13px] text-[#5a7086]">{t("Aucun plan actif dans ces catégories.")}</div>}
        </div>
      )}
    </div>
  );
}
