"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";
import { useLang } from "@/lib/i18n";
import { useSessionUser } from "@/lib/session-context";

type Key = "dashboard" | "deals" | "clients" | "inventory" | "lenders" | "settings" | "staff" | "quotes" | "assistant" | "appointments" | "warranty" | "credit" | "equifax";

const I = {
  dashboard: "M3 13h8V3H3v10zm0 8h8v-6H3v6zm10 0h8V11h-8v10zm0-18v6h8V3h-8z",
  deals: "M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8l-6-6zm4 18H6V4h7v5h5v11zM8 12h8v2H8v-2zm0 4h8v2H8v-2z",
  plus: "M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z",
  clients: "M16 11c1.66 0 2.99-1.34 2.99-3S17.66 5 16 5s-3 1.34-3 3 1.34 3 3 3zm-8 0c1.66 0 2.99-1.34 2.99-3S9.66 5 8 5 5 6.34 5 8s1.34 3 3 3zm0 2c-2.33 0-7 1.17-7 3.5V19h14v-2.5C15 14.17 10.33 13 8 13zm8 0c-.29 0-.62.02-.97.05 1.16.84 1.97 1.97 1.97 3.45V19h6v-2.5c0-2.33-4.67-3.5-7-3.5z",
  inventory: "M18.9 6c-.2-.6-.8-1-1.4-1h-11c-.7 0-1.2.4-1.4 1L3 12v8c0 .6.4 1 1 1h1c.6 0 1-.4 1-1v-1h12v1c0 .6.4 1 1 1h1c.6 0 1-.4 1-1v-8l-2.1-6zM6.5 16c-.8 0-1.5-.7-1.5-1.5S5.7 13 6.5 13s1.5.7 1.5 1.5S7.3 16 6.5 16zm11 0c-.8 0-1.5-.7-1.5-1.5s.7-1.5 1.5-1.5 1.5.7 1.5 1.5-.7 1.5-1.5 1.5zM5 11l1.5-4.5h11L19 11H5z",
  lenders: "M4 10v7h3v-7H4zm6 0v7h3v-7h-3zM2 22h19v-3H2v3zm14-12v7h3v-7h-3zM11.5 1L2 6v2h19V6l-9.5-5z",
  settings:
    "M19.1 12.9a7 7 0 000-1.8l2-1.6c.2-.1.2-.4.1-.6l-1.9-3.3c-.1-.2-.4-.3-.6-.2l-2.4 1a7 7 0 00-1.6-.9l-.4-2.5c0-.3-.2-.4-.5-.4h-3.8c-.2 0-.4.2-.5.4l-.4 2.5c-.6.2-1.1.6-1.6.9l-2.4-1c-.2-.1-.5 0-.6.2L2.7 8.9c-.1.2 0 .5.1.6l2 1.6a7 7 0 000 1.8l-2 1.6c-.2.1-.2.4-.1.6l1.9 3.3c.1.2.4.3.6.2l2.4-1c.5.4 1 .7 1.6.9l.4 2.5c0 .2.2.4.5.4h3.8c.2 0 .4-.2.5-.4l.4-2.5c.6-.2 1.1-.6 1.6-.9l2.4 1c.2.1.5 0 .6-.2l1.9-3.3c.1-.2.1-.5-.1-.6l-2-1.6zM12 15.5a3.5 3.5 0 110-7 3.5 3.5 0 010 7z",
  staff: "M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4zm7-6V6h-2v2h-2v2h2v2h2v-2h2V8h-2z",
  quotes: "M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm-7 14l-5-5 1.41-1.41L12 14.17l4.59-4.58L18 11l-6 6z",
  assistant: "M12 2a2 2 0 012 2c0 .74-.4 1.39-1 1.73V7h1a7 7 0 017 7h1a1 1 0 011 1v3a1 1 0 01-1 1h-1v1a2 2 0 01-2 2H5a2 2 0 01-2-2v-1H2a1 1 0 01-1-1v-3a1 1 0 011-1h1a7 7 0 017-7h1V5.73A2 2 0 0112 2zM7.5 13a1.5 1.5 0 100 3 1.5 1.5 0 000-3zm9 0a1.5 1.5 0 100 3 1.5 1.5 0 000-3z",
  calendar: "M19 4h-1V2h-2v2H8V2H6v2H5a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2V6a2 2 0 00-2-2zm0 16H5V10h14v10zm0-12H5V6h14v2zM7 12h5v5H7z",
  shield: "M12 1L3 5v6c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V5l-9-4zm-2 16l-4-4 1.41-1.41L10 14.17l6.59-6.59L18 9l-8 8z",
  credit: "M20 4H4c-1.11 0-1.99.89-1.99 2L2 18c0 1.11.89 2 2 2h16c1.11 0 2-.89 2-2V6c0-1.11-.89-2-2-2zm0 14H4v-6h16v6zm0-10H4V6h16v2z",
  equifax: "M3 13h2v8H3v-8zm4-6h2v14H7V7zm4 3h2v11h-2V10zm4-7h2v18h-2V3zm4 9h2v9h-2v-9z",
  logout: "M10 17l1.4-1.4L8.8 13H20v-2H8.8l2.6-2.6L10 7l-5 5 5 5zM4 5h8V3H4a2 2 0 00-2 2v14a2 2 0 002 2h8v-2H4V5z",
  menu: "M3 18h18v-2H3v2zm0-5h18v-2H3v2zm0-7v2h18V6H3z",
  chevron: "M15.4 7.4L14 6l-6 6 6 6 1.4-1.4L10.8 12z",
};

function Icon({ d, className = "" }: { d: string; className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={`w-[18px] h-[18px] shrink-0 fill-current ${className}`} aria-hidden>
      <path d={d} />
    </svg>
  );
}

export default function TopNav({ active, right, title }: { active?: Key; right?: ReactNode; title?: string }) {
  const { lang, setLang, t } = useLang();
  const user = useSessionUser();
  const router = useRouter();
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [now, setNow] = useState<Date | null>(null);

  useEffect(() => {
    setNow(new Date());
    const i = setInterval(() => setNow(new Date()), 60000);
    return () => clearInterval(i);
  }, []);
  useEffect(() => setMobileOpen(false), [pathname]);

  const toggleCollapse = () => {
    const c = document.documentElement.classList.toggle("sb-collapsed");
    document.cookie = `sb=${c ? 1 : 0}; path=/; max-age=31536000; samesite=lax`;
  };

  async function newDeal() {
    setCreating(true);
    const r = await fetch("/api/deals", { method: "POST", headers: { "Content-Type": "application/json" }, body: "{}" });
    const j = await r.json();
    router.push(`/deals/${j.id}`);
    setCreating(false);
  }

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    window.location.href = "/login";
  }

  const [creditSum, setCreditSum] = useState<{ conditional: number; declined: number } | null>(null);
  useEffect(() => {
    fetch("/api/credit?summary=1")
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => j && setCreditSum({ conditional: j.conditional ?? 0, declined: j.declined ?? 0 }))
      .catch(() => {});
  }, [pathname]);
  const creditBadge = creditSum && creditSum.conditional > 0 ? { n: creditSum.conditional, title: t("Approbation(s) conditionnelle(s) à traiter") } : undefined;
  const sections: { title: string; items: { key?: Key; href?: string; label: string; icon: string; onClick?: () => void; badge?: { n: number; title: string } }[] }[] = [
    { title: "", items: [{ key: "dashboard", href: "/", label: t("Tableau de bord"), icon: I.dashboard }] },
    {
      title: t("Ventes"),
      items: [
        { key: "deals", href: "/deals", label: t("Quotations"), icon: I.deals },
        { label: creating ? t("Création…") : t("Nouveau Quotation"), icon: I.plus, onClick: newDeal },
        { key: "clients", href: "/crm", label: t("CRM — Clients & suivis"), icon: I.clients },
        { key: "quotes", href: "/quotes", label: t("Offres AI"), icon: I.quotes },
      ],
    },
    {
      title: t("Crédit"),
      items: [
        { key: "credit", href: "/credit", label: t("Demandes de crédit"), icon: I.credit },
        { key: "equifax", href: "/equifax", label: t("Equifax — Approbation"), icon: I.equifax, badge: creditBadge },
      ],
    },
    { title: t("Service & protection"), items: [{ key: "warranty", href: "/warranty", label: t("Garantie & protection"), icon: I.shield }] },
    { title: t("Agenda"), items: [{ key: "appointments", href: "/appointments", label: t("Tous les rendez-vous"), icon: I.calendar }] },
    { title: t("Inventaire"), items: [{ key: "inventory", href: "/inventory", label: t("Inventaire"), icon: I.inventory }] },
    { title: t("Financement"), items: [{ key: "lenders", href: "/lenders", label: t("Prêteurs"), icon: I.lenders }] },
    {
      title: t("Administration"),
      items: [
        ...(user?.role === "admin" ? [{ key: "staff" as Key, href: "/staff", label: t("Personnel"), icon: I.staff }] : []),
        { key: "settings", href: "/settings", label: t("Paramètres"), icon: I.settings },
      ],
    },
  ];

  const pageTitle =
    title ??
    ({ dashboard: t("Tableau de bord"), deals: t("Quotations"), clients: t("CRM — Clients & suivis"), staff: t("Personnel"), quotes: t("Offres AI"), assistant: t("Assistant AI"), appointments: t("Tous les rendez-vous"), warranty: t("Vérification garantie & protection"), credit: t("Demandes de crédit"), equifax: t("Equifax — Approbation de crédit"), inventory: t("Inventaire"), lenders: t("Prêteurs"), settings: t("Paramètres") } as Record<Key, string>)[
      active ?? "dashboard"
    ];

  return (
    <>
      {/* ===== Sidebar ===== */}
      <aside className={`sidebar no-print ${mobileOpen ? "open" : ""}`}>
        <div className="sb-brand">
          <span className="inline-flex h-8 w-8 items-center justify-center rounded bg-white text-white text-[13px] font-black shrink-0 !bg-[#0071bc]">GD</span>
          <div className="sb-label leading-tight">
            <div className="text-[15px] font-bold tracking-wide text-white">Groupe Dar</div>
            <div className="text-[10px] uppercase tracking-[0.22em] text-[#6fc0f5] font-bold">DMS</div>
          </div>
        </div>

        <nav className="flex-1 overflow-y-auto py-2">
          {sections.map((s, si) => (
            <div key={si} className="mb-1">
              {s.title && <div className="sb-section sb-label">{s.title}</div>}
              {s.items.map((it) => {
                const cls = `sb-item ${active && it.key === active ? "active" : ""}`;
                const inner = (
                  <>
                    <Icon d={it.icon} />
                    <span className="sb-label truncate">{it.label}</span>
                    {it.badge && (
                      <span title={it.badge.title} className="sb-label ml-auto shrink-0 min-w-[20px] h-5 px-1.5 rounded-full bg-amber-500 text-white text-[11px] font-bold flex items-center justify-center">
                        {it.badge.n}
                      </span>
                    )}
                  </>
                );
                return it.href ? (
                  <Link key={it.label} href={it.href} className={cls} title={it.label}>
                    {inner}
                  </Link>
                ) : (
                  <button key={it.label} className={cls} onClick={it.onClick} disabled={creating} title={it.label}>
                    {inner}
                  </button>
                );
              })}
            </div>
          ))}
        </nav>

        <div className="border-t border-white/10 p-2 bg-[#001b2c]">
          <div className="flex items-center gap-2 px-2 py-2">
            <span className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-[#0071bc] text-white text-sm font-bold uppercase shrink-0">
              {(user?.name ?? "?").slice(0, 1)}
            </span>
            <div className="sb-label min-w-0">
              <div className="text-[13px] text-white font-semibold truncate">{user?.name ?? "—"}</div>
              <div className="text-[11px] text-[#a9bccb] truncate">{user?.position ? t(user.position) : t("Connecté")}</div>
            </div>
          </div>
          <button className="sb-item w-full" onClick={logout} title={t("Déconnexion")}>
            <Icon d={I.logout} />
            <span className="sb-label">{t("Déconnexion")}</span>
          </button>
          <button className="sb-item w-full hidden lg:flex" onClick={toggleCollapse} title={t("Réduire le menu")}>
            <Icon d={I.chevron} className="sb-chevron" />
            <span className="sb-label">{t("Réduire le menu")}</span>
          </button>
        </div>
      </aside>
      {mobileOpen && <div className="fixed inset-0 bg-black/40 z-30 lg:hidden no-print" onClick={() => setMobileOpen(false)} />}

      {/* ===== Top bar ===== */}
      <header className="topbar no-print">
        <button className="lg:hidden text-white mr-1" onClick={() => setMobileOpen(true)} aria-label="Menu">
          <Icon d={I.menu} className="!w-6 !h-6" />
        </button>
        <div className="min-w-0">
          <div className="text-[11px] uppercase tracking-wider text-[#6fc0f5] font-bold">Groupe Dar DMS</div>
          <div className="text-[16px] font-semibold text-white truncate leading-tight">{pageTitle}</div>
        </div>
        <div className="ml-auto flex items-center gap-2">
          {right}
          {now && (
            <span className="hidden md:inline text-[12px] text-[#ececec] ml-2">
              {now.toLocaleDateString(lang === "fr" ? "fr-CA" : "en-CA", { weekday: "short", day: "numeric", month: "short" })}
            </span>
          )}
          <div className="flex border border-white/60 rounded-sm overflow-hidden ml-2" title={t("Langue")}>
            {(["fr", "en"] as const).map((l) => (
              <button
                key={l}
                onClick={() => setLang(l)}
                className={`px-2 py-0.5 text-xs font-semibold ${lang === l ? "bg-white text-[#00263d]" : "text-white hover:bg-white/15"}`}
              >
                {l.toUpperCase()}
              </button>
            ))}
          </div>
        </div>
      </header>
    </>
  );
}
