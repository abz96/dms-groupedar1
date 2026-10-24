import type { QuoteParams } from "./deal-engine";
import type { DealType, Frequency } from "./deal";

export const AI_MODEL = process.env.OPENAI_MODEL || "gpt-4.1-mini";
export const aiEnabled = () => Boolean(process.env.OPENAI_API_KEY);

/** Call the OpenAI Responses API. */
export async function openaiResponses(body: Record<string, unknown>) {
  const res = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${process.env.OPENAI_API_KEY}` },
    body: JSON.stringify({ model: AI_MODEL, ...body }),
  });
  const j = await res.json();
  if (!res.ok) throw new Error(j?.error?.message ?? `OpenAI error ${res.status}`);
  return j as { id: string; output: OutputItem[] };
}

export type OutputItem =
  | { type: "message"; content: { type: string; text?: string; annotations?: { type: string; url?: string; title?: string }[] }[] }
  | { type: "function_call"; call_id: string; name: string; arguments: string }
  | { type: string; [k: string]: unknown };

export function outputText(out: OutputItem[]): { text: string; sources: { url: string; title: string }[] } {
  let text = "";
  const sources: { url: string; title: string }[] = [];
  for (const o of out) {
    if (o.type !== "message") continue;
    for (const c of (o as Extract<OutputItem, { type: "message" }>).content ?? []) {
      if (c.text) text += c.text;
      for (const a of c.annotations ?? []) if (a.type === "url_citation" && a.url) sources.push({ url: a.url, title: a.title ?? a.url });
    }
  }
  return { text, sources };
}

/* ---------------------------------------------------------------- quote request parsing */

const num = (s: string) => Number(s.replace(/[\s,$]/g, "").replace(/(\d)\.(\d{3})\b/, "$1$2")) || 0;

/** Heuristic French/English parser for a free-text quote request. */
export function parseQuoteRequestRules(text: string, makes: string[]): Partial<QuoteParams> {
  const t = text.toLowerCase();
  const out: Partial<QuoteParams> = {};
  if (/\b(lease|location|louer|loc)\b/.test(t)) out.dealType = "lease";
  else if (/\b(cash|comptant|cheque|chèque)\b/.test(t)) out.dealType = "cash";
  else if (/\b(financ\w*|loan|prêt|pret)\b/.test(t)) out.dealType = "finance";
  if (/(bi-?weekly|aux? ?2 ?semaines|bi-?hebdo|biweekly|2 sem)/.test(t)) out.frequency = "biweekly";
  else if (/(weekly|hebdo|par semaine|\/sem|per week)/.test(t)) out.frequency = "weekly";
  else if (/(monthly|mensuel|par mois|\/mois|per month|\/mo)/.test(t)) out.frequency = "monthly";
  const term = t.match(/(\d{2})\s*(mois|months?|mo)\b/);
  if (term) out.term = Number(term[1]);
  const pay =
    t.match(/(\d[\d\s,.]*)\s*\$?\s*(?:par|\/|per|a|by)\s*(mois|month|mo|semaine|week|sem|2\s*sem)/) ??
    t.match(/(?:payment|paiement|budget)\D{0,15}(\d[\d\s,.]*)/);
  if (pay) out.targetPayment = num(pay[1]);
  const max = t.match(/(?:max(?:imum)?|under|moins de|budget de|jusqu'?à)\s*\$?\s*(\d[\d\s,.]{3,})/);
  if (max && num(max[1]) > 5000) out.maxPrice = num(max[1]);
  const down = t.match(/(\d[\d\s,.]*)\s*\$?\s*(?:down|comptant|cash down|mise de fonds|d'?acompte)/);
  if (down) out.cashDown = num(down[1]);
  const w = t.match(/(?:garantie|warranty)[^\d]{0,20}(\d)\s*(?:ans?|years?|yrs?)/) ?? t.match(/(\d)\s*(?:ans?|years?|yrs?)[^\d]{0,15}(?:garantie|warranty)/);
  if (w) out.warrantyYears = Number(w[1]);
  else if (/(garantie|warranty)/.test(t)) out.warrantyYears = 1;
  const tr = t.match(/(?:pneus?|tire|jantes?|rim)[^\d]{0,25}(\d)\s*(?:ans?|years?|yrs?)/);
  if (tr) out.tireRimYears = Number(tr[1]);
  else if (/(pneus? (et|&) jantes?|tire (and|&) rim|tire&rim)/.test(t)) out.tireRimYears = 1;
  // vehicle words: known makes + following word(s) and model-ish tokens
  const words: string[] = [];
  for (const m of makes) {
    const i = t.indexOf(m.toLowerCase());
    if (i >= 0) {
      words.push(m);
      const after = t.slice(i + m.length).trim().split(/\s+/)[0];
      if (after && /^[a-z0-9-]{2,}$/i.test(after) && !/^(en|in|for|pour|lease|location|financ\w*|cash|comptant|avec|with|a|à|de)$/.test(after)) words.push(after);
    }
  }
  const year = t.match(/\b(20[1-4]\d)\b/);
  if (year) words.unshift(year[1]);
  if (words.length) out.vehicleQuery = words.join(" ");
  return out;
}

/** Use OpenAI (if configured) to turn a free-text request into quote parameters. */
export async function parseQuoteRequest(text: string, makes: string[]): Promise<Partial<QuoteParams>> {
  const rules = parseQuoteRequestRules(text, makes);
  if (!aiEnabled() || !text.trim()) return rules;
  try {
    const r = await openaiResponses({
      instructions:
        "Extract car-dealer quote parameters from the request (French or English). Reply ONLY with compact JSON with optional keys: " +
        'dealType ("finance"|"lease"|"cash"), frequency ("monthly"|"biweekly"|"weekly"), term (months), targetPayment (number, taxes incl.), ' +
        "maxPrice, cashDown, vehicleQuery (year/make/model words that exist in dealer inventory), warrantyYears (1-6), tireRimYears (1-6), " +
        "accessories ([{name, price}]). Known makes in inventory: " +
        makes.join(", "),
      input: text,
    });
    const raw = outputText(r.output).text.replace(/```json|```/g, "").trim();
    const j = JSON.parse(raw) as Partial<QuoteParams> & { dealType?: DealType; frequency?: Frequency };
    return { ...rules, ...Object.fromEntries(Object.entries(j).filter(([, v]) => v !== null && v !== "" && v !== undefined)) };
  } catch {
    return rules;
  }
}
