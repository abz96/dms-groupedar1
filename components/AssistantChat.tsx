"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { useLang } from "@/lib/i18n";

type Msg = { role: "user" | "assistant"; content: string; sources?: { url: string; title: string }[]; tools?: string[] };

const STORE = "dms-assistant-chat";

/** Minimal markdown: **bold**, _italic_, bullet lines, links. */
function render(text: string): ReactNode {
  return text.split("\n").map((line, i) => {
    const bullet = /^\s*([•\-*]|\d+\.)\s+/.test(line);
    const body = line.replace(/^\s*([•\-*])\s+/, "");
    const parts: ReactNode[] = [];
    const re = /(\*\*[^*]+\*\*|_[^_]+_|\[[^\]]+\]\([^)]+\)|https?:\/\/\S+)/g;
    let last = 0;
    let m: RegExpExecArray | null;
    let k = 0;
    while ((m = re.exec(body))) {
      if (m.index > last) parts.push(body.slice(last, m.index));
      const tok = m[0];
      if (tok.startsWith("**")) parts.push(<b key={k++}>{tok.slice(2, -2)}</b>);
      else if (tok.startsWith("_")) parts.push(<i key={k++}>{tok.slice(1, -1)}</i>);
      else if (tok.startsWith("[")) {
        const mm = tok.match(/\[([^\]]+)\]\(([^)]+)\)/)!;
        parts.push(<a key={k++} href={mm[2]} target="_blank" rel="noreferrer" className="text-[#0071bc] underline">{mm[1]}</a>);
      } else parts.push(<a key={k++} href={tok} target="_blank" rel="noreferrer" className="text-[#0071bc] underline break-all">{tok}</a>);
      last = m.index + tok.length;
    }
    if (last < body.length) parts.push(body.slice(last));
    return (
      <div key={i} className={bullet ? "pl-4 -indent-3" : line.trim() ? "" : "h-2"}>
        {bullet && "• "}
        {parts}
      </div>
    );
  });
}

export default function AssistantChat({ aiEnabled }: { aiEnabled: boolean }) {
  const { t, lang } = useLang();
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    try {
      const s = localStorage.getItem(STORE);
      if (s) setMsgs(JSON.parse(s));
    } catch {
      /* ignore */
    }
  }, []);
  useEffect(() => {
    try {
      localStorage.setItem(STORE, JSON.stringify(msgs.slice(-40)));
    } catch {
      /* ignore */
    }
    endRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [msgs]);

  async function send(text?: string) {
    const q = (text ?? input).trim();
    if (!q || busy) return;
    const next: Msg[] = [...msgs, { role: "user", content: q }];
    setMsgs(next);
    setInput("");
    setBusy(true);
    try {
      const r = await fetch("/api/assistant", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: next.map(({ role, content }) => ({ role, content })), lang }),
      });
      const j = await r.json();
      setMsgs((m) => [...m, { role: "assistant", content: j.reply ?? j.error ?? "…", sources: j.sources, tools: j.tools }]);
    } catch (e) {
      setMsgs((m) => [...m, { role: "assistant", content: `${String(e)}` }]);
    }
    setBusy(false);
  }

  const suggestions = [
    t("Quels sont mes suivis aujourd'hui ?"),
    t("Quels véhicules avons-nous en inventaire ?"),
    t("Paiement de location 48 mois pour une Lamborghini Urus 2026 neuve ?"),
    t("Combien coûtent des pneus d'hiver pour une Audi A7 ?"),
    t("Quelles offres attendent mon approbation ?"),
  ];

  return (
    <div className="win flex flex-col h-[calc(100vh-110px)]">
      <div className="win-title flex items-center px-3 h-9 shrink-0">
        <span>{t("Assistant AI")}</span>
        <span className="ml-auto text-xs text-[#cfe3f2]">
          {aiEnabled ? t("IA + recherche Web localisée + données de la concession") : t("Mode local — données de la concession")}
        </span>
        {msgs.length > 0 && (
          <button className="ml-3 text-xs text-[#cfe3f2] hover:text-white underline" onClick={() => setMsgs([])}>{t("Nouvelle conversation")}</button>
        )}
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-[#f2f6f9]">
        {msgs.length === 0 && (
          <div className="max-w-2xl mx-auto text-center pt-8">
            <div className="text-[22px] font-semibold text-[#00263d]">{t("Comment puis-je vous aider ?")}</div>
            <div className="text-[13px] text-[#5a7086] mt-1">
              {t("Posez une question sur vos clients, suivis, inventaire, offres, paiements — ou toute autre question.")}
            </div>
            {!aiEnabled && (
              <div className="mt-3 text-[12px] text-amber-800 bg-amber-50 border border-amber-200 px-3 py-2 text-left">
                {t("Pour les questions générales (prix de pièces, PDSF de modèles absents de l'inventaire…), ajoutez la variable OPENAI_API_KEY. Les questions sur vos données et les calculs de paiement fonctionnent déjà.")}
              </div>
            )}
            <div className="flex flex-wrap justify-center gap-2 mt-5">
              {suggestions.map((s) => (
                <button key={s} className="btn !py-1.5 !px-3 !text-[12.5px] !rounded-full" onClick={() => void send(s)}>{s}</button>
              ))}
            </div>
          </div>
        )}
        {msgs.map((m, i) => (
          <div key={i} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
            <div
              className={`max-w-[85%] px-3 py-2 text-[14px] leading-relaxed shadow-sm ${
                m.role === "user" ? "bg-[#0071bc] text-white rounded-l-lg rounded-tr-lg" : "bg-white text-[#14254a] border border-[#ccd8e3] rounded-r-lg rounded-tl-lg"
              }`}
            >
              {m.role === "user" ? m.content : render(m.content)}
              {m.sources && m.sources.length > 0 && (
                <div className="mt-2 pt-1 border-t border-[#e1e6ef] text-[11px] text-[#5a7086]">
                  {t("Sources")} :{" "}
                  {m.sources.slice(0, 5).map((s, k) => (
                    <a key={k} href={s.url} target="_blank" rel="noreferrer" className="underline mr-2 text-[#0071bc]">{s.title.slice(0, 40)}</a>
                  ))}
                </div>
              )}
            </div>
          </div>
        ))}
        {busy && (
          <div className="flex justify-start">
            <div className="bg-white border border-[#ccd8e3] px-3 py-2 text-[13px] text-[#5a7086] rounded-lg animate-pulse">{t("Réflexion…")}</div>
          </div>
        )}
        <div ref={endRef} />
      </div>

      <form
        data-enter-submit
        className="shrink-0 p-3 border-t border-[#bccbd8] flex gap-2 bg-[#e9eff4]"
        onSubmit={(e) => {
          e.preventDefault();
          void send();
        }}
      >
        <input
          className="fld !h-10 !text-[14px] !tracking-normal"
          autoFocus
          placeholder={t("Écrivez votre question…")}
          value={input}
          onChange={(e) => setInput(e.target.value)}
        />
        <button className="btn btn-primary !px-5" disabled={busy || !input.trim()}>{t("Envoyer")}</button>
      </form>
    </div>
  );
}
