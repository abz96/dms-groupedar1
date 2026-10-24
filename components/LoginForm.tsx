"use client";

import { useState } from "react";
import { useLang } from "@/lib/i18n";

export default function LoginForm({ next }: { next: string }) {
  const { lang, setLang, t } = useLang();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    const r = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username, password }),
    });
    if (r.ok) {
      window.location.href = next;
    } else {
      setError(t("Nom d'utilisateur ou mot de passe invalide."));
      setBusy(false);
    }
  }

  return (
    <div className="min-h-screen flex bg-[#00263d]">
      <div className="hidden lg:flex flex-1 flex-col justify-between p-12 bg-gradient-to-br from-[#0a4a73] via-[#003a5d] to-[#00263d] text-white">
        <div className="flex items-center gap-3">
          <span className="inline-flex h-10 w-10 items-center justify-center rounded bg-white text-white !bg-[#0071bc] text-base font-black">GD</span>
          <span className="text-2xl font-bold tracking-wide">Groupe Dar <span className="font-light text-[#6fc0f5]">DMS</span></span>
        </div>
        <div>
          <h1 className="text-4xl font-light leading-tight max-w-lg">
            {t("Structurez vos transactions — comptant, financement et location — en quelques secondes.")}
          </h1>
          <ul className="mt-8 space-y-2 text-[#cfe3f2] text-sm">
            <li>✓ {t("Prêteurs canadiens et financement maison")}</li>
            <li>✓ {t("Analyse de profit et rollback de paiement")}</li>
            <li>✓ {t("Inventaire AI et feuilles d'offre imprimables")}</li>
          </ul>
        </div>
        <div className="text-xs text-white/60">© {new Date().getFullYear()} Groupe Dar DMS</div>
      </div>

      <div className="flex-1 flex items-center justify-center p-6 bg-[#f4f7fa]">
        <form onSubmit={submit} className="win w-full max-w-sm" data-enter-submit>
          <div className="win-title h-10 px-4 flex items-center">
            <span>{t("Connexion")}</span>
            <div className="ml-auto flex border border-white/40 rounded-sm overflow-hidden">
              {(["fr", "en"] as const).map((l) => (
                <button
                  type="button"
                  key={l}
                  onClick={() => setLang(l)}
                  className={`px-2 py-0.5 text-xs font-semibold ${lang === l ? "bg-white text-[#005a96]" : "text-[#cfe3f2]"}`}
                >
                  {l.toUpperCase()}
                </button>
              ))}
            </div>
          </div>
          <div className="p-5 space-y-4">
            <label className="block">
              <span className="lbl text-[13px]">{t("Nom d'utilisateur")}</span>
              <input className="fld mt-1 !h-9" autoFocus autoComplete="username" value={username} onChange={(e) => setUsername(e.target.value)} />
            </label>
            <label className="block">
              <span className="lbl text-[13px]">{t("Mot de passe")}</span>
              <input
                className="fld mt-1 !h-9"
                type="password"
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </label>
            {error && <div className="text-[13px] text-red-700 bg-red-50 border border-red-200 px-2 py-1">{error}</div>}
            <button className="btn btn-primary w-full !py-2 !text-sm" disabled={busy || !username || !password}>
              {busy ? t("Connexion…") : t("Se connecter")}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
