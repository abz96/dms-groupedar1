import type { DealData } from "./deal";

export interface InventoryVehicle {
  id?: number;
  year: string;
  make: string;
  model: string;
  trim: string;
  stock: string;
  vin: string;
  price: number;
  kms: number;
  extColor: string;
  condition: string;
  status?: string;
  /** when status = "employee" */
  employeeName?: string;
}

export interface ParsedRow extends InventoryVehicle {
  dedupeKey: string;
  duplicate: "none" | "list" | "inventory";
  existingId?: number;
  raw?: string;
}

/* ---------------------------------------------------------------- dictionaries */

const MAKES: [string, string][] = [
  ["Mercedes-Benz", "Mercedes-Benz"], ["Mercedes Benz", "Mercedes-Benz"], ["Mercedes-AMG", "Mercedes-Benz"], ["Mercedes", "Mercedes-Benz"],
  ["Land Rover", "Land Rover"], ["Range Rover", "Land Rover"], ["Alfa Romeo", "Alfa Romeo"], ["Aston Martin", "Aston Martin"],
  ["Rolls-Royce", "Rolls-Royce"], ["Rolls Royce", "Rolls-Royce"], ["Lamborghini", "Lamborghini"], ["Ferrari", "Ferrari"],
  ["Porsche", "Porsche"], ["Bentley", "Bentley"], ["Maserati", "Maserati"], ["McLaren", "McLaren"], ["Bugatti", "Bugatti"],
  ["Lotus", "Lotus"], ["Maybach", "Maybach"], ["Acura", "Acura"], ["Audi", "Audi"], ["BMW", "BMW"], ["Buick", "Buick"],
  ["Cadillac", "Cadillac"], ["Chevrolet", "Chevrolet"], ["Chevy", "Chevrolet"], ["Chrysler", "Chrysler"], ["Dodge", "Dodge"],
  ["Fiat", "Fiat"], ["Fisker", "Fisker"], ["Ford", "Ford"], ["Genesis", "Genesis"], ["GMC", "GMC"], ["Honda", "Honda"],
  ["Hummer", "Hummer"], ["Hyundai", "Hyundai"], ["Infiniti", "Infiniti"], ["Jaguar", "Jaguar"], ["Jeep", "Jeep"], ["Kia", "Kia"],
  ["Lexus", "Lexus"], ["Lincoln", "Lincoln"], ["Lucid", "Lucid"], ["Mazda", "Mazda"], ["MINI", "MINI"], ["Mitsubishi", "Mitsubishi"],
  ["Nissan", "Nissan"], ["Polestar", "Polestar"], ["Pontiac", "Pontiac"], ["Ram", "Ram"], ["Rivian", "Rivian"], ["Smart", "Smart"],
  ["Subaru", "Subaru"], ["Suzuki", "Suzuki"], ["Tesla", "Tesla"], ["Toyota", "Toyota"], ["Volkswagen", "Volkswagen"], ["VW", "Volkswagen"],
  ["Volvo", "Volvo"], ["Scion", "Scion"], ["Saab", "Saab"],
];

const COLORS = new Set(
  (
    "black white grey gray silver blue red green brown beige orange yellow gold purple violet burgundy bronze tan charcoal maroon " +
    "pearl metallic midnight graphite gunmetal champagne copper titanium platinum ivory cream navy teal lime magenta pink " +
    "noir blanc gris bleu rouge argent vert brun jaune or mauve bordeaux nardo chalk obsidian magnetite selenite polar alpine " +
    "jet onyx carbon crayon frozen matte satin arctic glacier snow ebony sapphire emerald ruby crimson blood sonic lunar " +
    "cosmos iridium mineral portofino rosso bianco nero grigio blu giallo verde arancio"
  ).split(" "),
);

const STOP = new Set(
  (
    "gasoline gas diesel electric hybrid plug-in phev essence électrique electrique hybride automatic automatique manual manuelle " +
    "awd fwd rwd 4x4 4wd 2wd passengers passagers doors portes interior intérieur interieur int stock vin new used certified " +
    "previous next view details compare price prix your sale km kms seats places transmission cylinders cyl"
  ).split(" "),
);

const NOISE = [
  /new arrival/gi, /nouvel arrivage/gi, /\bprevious\b/gi, /\bnext\b/gi, /\bprécédent\b/gi, /\bsuivant\b/gi,
  /\b(?:your|sale|our|special|internet|asking|selling)\s+price\b/gi, /\bprix(?:\s+de\s+vente)?\b/gi, /\bprice\b/gi,
  /\bview details\b/gi, /\bcompare\b/gi, /\bcertified pre-owned\b/gi, /\bpre-owned\b/gi, /\bd'occasion\b/gi,
  /\bfinancing available\b/gi, /\bvoir détails\b/gi,
];

const esc = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const MAKE_ALT = [...MAKES].sort((a, b) => b[0].length - a[0].length).map(([m]) => esc(m).replace(/[ -]/g, "[ -]?")).join("|");
const ANCHOR = new RegExp(`\\b((?:19[5-9]|20[0-4])\\d)\\s+(${MAKE_ALT})\\b`, "gi");

function canonicalMake(m: string): string {
  const norm = m.toLowerCase().replace(/[ -]/g, "");
  const hit = MAKES.find(([k]) => k.toLowerCase().replace(/[ -]/g, "") === norm);
  return hit ? hit[1] : m;
}

const NUM = String.raw`(\d{1,3}(?:,\d{3})+|\d{1,3}(?:[ \u00a0]\d{3})+|\d+)`;
const toNum = (s: string | undefined) => (s ? Number(s.replace(/[^\d.]/g, "")) || 0 : 0);
const titleCase = (s: string) => s.replace(/\b([a-zà-ÿ])([a-zà-ÿ]*)/gi, (_, a: string, b: string) => a.toUpperCase() + b.toLowerCase());

function isStockToken(t: string): boolean {
  if (!/^[A-Z0-9-]{4,12}$/i.test(t)) return false;
  const digits = (t.match(/\d/g) ?? []).length;
  const letters = (t.match(/[A-Z]/gi) ?? []).length;
  if (/^(?:19|20)\d{2}$/.test(t)) return false;
  if (letters === 0) return digits >= 4;
  return digits >= 3 && letters <= 3 && /^[A-Z]{0,3}\d{3,}[A-Z]{0,3}(?:-\d+)?$/i.test(t);
}

export function dedupeKey(v: Pick<InventoryVehicle, "stock" | "vin" | "year" | "make" | "model" | "trim" | "kms" | "price">): string {
  if (v.stock.trim()) return "S:" + v.stock.trim().toUpperCase();
  if (v.vin.trim()) return "V:" + v.vin.trim().toUpperCase();
  return "K:" + [v.year, v.make, v.model, v.trim, Math.round(v.kms), Math.round(v.price)].join("|").toLowerCase().replace(/\s+/g, " ");
}

/* ---------------------------------------------------------------- website text */

function parseChunk(chunk: string, year: string, makeRaw: string): (InventoryVehicle & { hasData: boolean; headerColor: string }) {
  const make = canonicalMake(makeRaw);
  let rest = chunk.slice(chunk.toLowerCase().indexOf(makeRaw.toLowerCase()) + makeRaw.length);

  const vin = (rest.match(/\b(?=[A-HJ-NPR-Z0-9]*\d)(?=[A-HJ-NPR-Z0-9]*[A-HJ-NPR-Z])([A-HJ-NPR-Z0-9]{17})\b/i)?.[1] ?? "").toUpperCase();
  if (vin) rest = rest.replace(new RegExp(`(?:vin|niv)?\\s*#?\\s*:?\\s*${vin}`, "i"), " ");

  let stock = "";
  const stockLabel = rest.match(/\b(?:stock|stk|inventaire|n[o°]\s*de\s*stock)\s*(?:#|no\.?|number|num[ée]ro)?\s*:?\s*#?\s*([A-Z0-9-]{3,15})/i);
  if (stockLabel) {
    stock = stockLabel[1].toUpperCase();
    rest = rest.replace(stockLabel[0], " ");
  }

  // price
  let price = 0;
  let priceIdx = -1;
  const pricePatterns = [
    new RegExp(String.raw`\$\s?` + NUM + String.raw`(?:\.\d{2})?`, "i"),
    new RegExp(NUM + String.raw`(?:[.,]\d{2})?\s?\$`, "i"),
    new RegExp(String.raw`(?:price|prix)\s*:?\s*` + NUM, "i"),
  ];
  for (const re of pricePatterns) {
    const m = rest.match(re);
    if (m && toNum(m[1]) >= 500) {
      price = toNum(m[1]);
      priceIdx = m.index ?? -1;
      break;
    }
  }

  // kilometres
  let kms = 0;
  let kmIdx = -1;
  let kmEnd = -1;
  const kmM =
    rest.match(new RegExp(NUM + String.raw`\s?(?:km|kms|kilom[eè]tres?)\b`, "i")) ??
    rest.match(new RegExp(String.raw`(?:mileage|odometer|odom[eè]tre|kilom[eé]trage)\s*:?\s*` + NUM, "i"));
  if (kmM) {
    kms = toNum(kmM[1]);
    kmIdx = kmM.index ?? -1;
    kmEnd = kmIdx + kmM[0].length;
  }

  // colour
  let extColor = "";
  const colLabel = rest.match(/\b(?:ext(?:erior)?\.?\s*colou?r|colou?r|couleur(?:\s+ext[ée]rieure)?)\s*:?\s*([A-Za-zÀ-ÿ][A-Za-zÀ-ÿ\- ]{1,30})/i);
  if (colLabel) {
    extColor = colLabel[1].split(/\s+/).filter((w) => w && !STOP.has(w.toLowerCase())).slice(0, 3).join(" ");
  } else if (kmEnd > 0) {
    const tail = rest.slice(kmEnd).trim().split(/\s+/);
    const words: string[] = [];
    for (const w of tail) {
      const lw = w.toLowerCase().replace(/[,.;]/g, "");
      if (!lw || STOP.has(lw) || /\d/.test(lw)) break;
      words.push(w.replace(/[,.;]/g, ""));
      if (words.length >= 3) break;
    }
    if (words.some((w) => COLORS.has(w.toLowerCase())) || (words.length > 0 && words.length <= 2)) extColor = words.join(" ");
  }

  // header-only colour fallback ("2022 Lamborghini Urus Grey")
  const allWords = rest.trim().split(/\s+/);
  const headerColor = allWords.filter((w) => COLORS.has(w.toLowerCase().replace(/[,.;]/g, ""))).slice(-1)[0] ?? "";

  // model / trim / stock = text between make and first data point
  const cut = [priceIdx, kmIdx].filter((i) => i >= 0);
  let pre = cut.length ? rest.slice(0, Math.min(...cut)) : rest;
  for (const re of NOISE) pre = pre.replace(re, " ");
  pre = pre.replace(/[|•·,:]/g, " ");
  let tokens = pre.split(/\s+/).filter(Boolean);
  if (!stock && tokens.length > 1 && isStockToken(tokens[tokens.length - 1])) stock = tokens.pop()!.toUpperCase();
  if (!cut.length) {
    // header line — drop trailing colour words
    while (tokens.length > 1 && COLORS.has(tokens[tokens.length - 1].toLowerCase())) tokens.pop();
  }
  tokens = tokens.filter((t) => !/^\$/.test(t));
  let model = tokens[0] ?? "";
  let trimTokens = tokens.slice(1);
  if (trimTokens[0] && /^(series|class|classe|série)$/i.test(trimTokens[0])) {
    model = `${model} ${trimTokens[0]}`;
    trimTokens = trimTokens.slice(1);
  }
  if (extColor) {
    const colorWords = new Set(extColor.toLowerCase().split(/\s+/));
    while (trimTokens.length && colorWords.has(trimTokens[trimTokens.length - 1].toLowerCase())) trimTokens.pop();
  }

  return {
    year,
    make,
    model,
    trim: trimTokens.join(" "),
    stock,
    vin,
    price,
    kms,
    extColor: extColor ? titleCase(extColor) : "",
    condition: kms <= 500 ? "NEUF" : "USAGÉ",
    hasData: price > 0 || kmIdx >= 0 || !!stock,
    headerColor: headerColor ? titleCase(headerColor) : "",
  };
}

function parseWebsiteText(text: string): InventoryVehicle[] {
  const flat = text.replace(/\u00a0/g, " ").replace(/×/g, "x").replace(/\s+/g, " ");
  const anchors = [...flat.matchAll(ANCHOR)];
  const out: InventoryVehicle[] = [];
  let header: { year: string; make: string; model: string; color: string } | null = null;
  anchors.forEach((a, i) => {
    const start = a.index ?? 0;
    const end = i + 1 < anchors.length ? (anchors[i + 1].index ?? flat.length) : flat.length;
    const chunk = flat.slice(start, end);
    const p = parseChunk(chunk, a[1], a[2]);
    if (!p.hasData) {
      header = { year: p.year, make: p.make, model: p.model, color: p.headerColor };
      return;
    }
    const h = header as { year: string; make: string; model: string; color: string } | null;
    if (!p.extColor && h && h.year === p.year && h.make === p.make) p.extColor = h.color;
    header = null;
    const { hasData: _h, headerColor: _c, ...v } = p;
    void _h;
    void _c;
    out.push(v);
  });
  return out;
}

/* ---------------------------------------------------------------- spreadsheet rows */

const COL_ALIASES: Record<keyof Omit<InventoryVehicle, "id" | "condition" | "status" | "employeeName">, RegExp> = {
  year: /^(year|ann[ée]e|yr)$/i,
  make: /^(make|marque|manufacturer)$/i,
  model: /^(model|mod[eè]le)$/i,
  trim: /^(trim|version|niveau|edition)$/i,
  stock: /^(stock|stock ?#|stock ?no|#|inventaire|stk)$/i,
  vin: /^(vin|niv)$/i,
  price: /^(price|prix|selling price|prix de vente|msrp|pdsf)$/i,
  kms: /^(km|kms|kilom[eè]tres?|kilom[ée]trage|mileage|odometer)$/i,
  extColor: /^(colou?r|couleur|ext(erior)? ?colou?r|couleur ext[ée]rieure|ext)$/i,
};
const DEFAULT_ORDER: (keyof typeof COL_ALIASES)[] = ["year", "make", "model", "trim", "stock", "price", "kms", "extColor"];

function parseTable(text: string): InventoryVehicle[] | null {
  const lines = text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  if (lines.length === 0) return null;
  const delim = lines.some((l) => l.includes("\t")) ? "\t" : lines.every((l) => (l.match(/;/g) ?? []).length >= 4) ? ";" : null;
  if (!delim) return null;
  let rows = lines.map((l) => l.split(delim).map((c) => c.trim()));
  let order: (keyof typeof COL_ALIASES | null)[] = DEFAULT_ORDER;
  const head = rows[0];
  const mapped = head.map((h) => (Object.keys(COL_ALIASES) as (keyof typeof COL_ALIASES)[]).find((k) => COL_ALIASES[k].test(h)) ?? null);
  if (mapped.filter(Boolean).length >= 3) {
    order = mapped;
    rows = rows.slice(1);
  }
  const out: InventoryVehicle[] = [];
  for (const r of rows) {
    const v: InventoryVehicle = { year: "", make: "", model: "", trim: "", stock: "", vin: "", price: 0, kms: 0, extColor: "", condition: "USAGÉ" };
    order.forEach((k, i) => {
      const c = r[i] ?? "";
      if (!k) return;
      if (k === "price" || k === "kms") v[k] = toNum(c);
      else v[k] = c;
    });
    if (!/^(19|20)\d{2}$/.test(v.year) || !v.make) continue;
    v.make = canonicalMake(v.make);
    v.stock = v.stock.toUpperCase();
    v.extColor = v.extColor ? titleCase(v.extColor) : "";
    v.condition = v.kms <= 500 ? "NEUF" : "USAGÉ";
    out.push(v);
  }
  return out.length ? out : null;
}

/** Extract vehicles from any pasted text (dealer website listing, spreadsheet, CSV with ; or tabs). */
export function parseInventoryText(text: string): InventoryVehicle[] {
  return parseTable(text) ?? parseWebsiteText(text);
}

/** Mark duplicates inside the list and against existing inventory keys. */
export function markDuplicates(
  list: InventoryVehicle[],
  existing: { id: number; dedupeKey: string; vin: string }[],
): ParsedRow[] {
  const byKey = new Map(existing.map((e) => [e.dedupeKey, e.id]));
  const byVin = new Map(existing.filter((e) => e.vin).map((e) => [e.vin.toUpperCase(), e.id]));
  const seen = new Set<string>();
  return list.map((v) => {
    const key = dedupeKey(v);
    const existingId = byKey.get(key) ?? (v.vin ? byVin.get(v.vin.toUpperCase()) : undefined);
    let duplicate: ParsedRow["duplicate"] = "none";
    if (existingId) duplicate = "inventory";
    else if (seen.has(key)) duplicate = "list";
    seen.add(key);
    return { ...v, dedupeKey: key, duplicate, existingId };
  });
}

/** Fill a deal with an inventory vehicle. */
export function applyVehicleToDeal(d: DealData, v: InventoryVehicle) {
  d.vehicle.year = v.year;
  d.vehicle.make = v.make;
  d.vehicle.model = v.model;
  d.vehicle.trim = v.trim.toUpperCase();
  d.vehicle.stock = v.stock;
  d.vehicle.vin = v.vin;
  d.vehicle.kms = String(Math.round(v.kms));
  d.vehicle.extColor = v.extColor;
  d.vehicle.condition = v.condition === "NEUF" ? "NEUF" : v.condition === "DÉMO" ? "DÉMO" : "USAGÉ";
  d.pricing.basePrice = Number(v.price) || 0;
  d.pricing.options = 0;
}
