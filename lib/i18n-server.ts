import { EN } from "./i18n-dict";

/** Server-safe translation (French source → English). */
export function translate(lang: "fr" | "en", fr: string): string {
  return lang === "fr" ? fr : (EN[fr] ?? fr);
}
