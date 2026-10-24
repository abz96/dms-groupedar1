"use client";

import { createContext, useCallback, useContext, useState, type ReactNode } from "react";
import { EN } from "./i18n-dict";

export type Lang = "fr" | "en";

interface LangCtx {
  lang: Lang;
  setLang: (l: Lang) => void;
  t: (fr: string) => string;
}

/** French is the source language; English comes from the dictionary (falls back to French). */
export function translate(lang: Lang, fr: string): string {
  if (lang === "fr") return fr;
  return EN[fr] ?? fr;
}

const Ctx = createContext<LangCtx>({ lang: "fr", setLang: () => {}, t: (s) => s });

export function LangProvider({ initial, children }: { initial: Lang; children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>(initial);
  const setLang = useCallback((l: Lang) => {
    setLangState(l);
    document.cookie = `lang=${l}; path=/; max-age=31536000; samesite=lax`;
    document.documentElement.lang = l === "fr" ? "fr-CA" : "en-CA";
  }, []);
  const t = useCallback((fr: string) => translate(lang, fr), [lang]);
  return <Ctx.Provider value={{ lang, setLang, t }}>{children}</Ctx.Provider>;
}

export function useLang() {
  return useContext(Ctx);
}

export function useT() {
  return useContext(Ctx).t;
}
