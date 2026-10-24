import { and, asc, desc, eq, gte, ilike, lte, or } from "drizzle-orm";
import { db } from "@/db";
import { customers, deals, followups, quotes } from "@/db/schema";
import { aiEnabled, openaiResponses, outputText, type OutputItem } from "@/lib/ai";
import { getProvince, type DealType, type Frequency } from "@/lib/deal";
import { estimatePayment } from "@/lib/deal-engine";
import { ensureSchema, getInventory, getLenders, getSessionUser, getSettings } from "@/lib/server";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

type Msg = { role: "user" | "assistant"; content: string };

/* ---------------------------------------------------------------- tools (live dealership data) */

async function runTool(name: string, args: Record<string, unknown>) {
  const s = await getSettings();
  const lenders = await getLenders();
  const now = new Date();
  switch (name) {
    case "search_inventory": {
      const q = String(args.query ?? "").toLowerCase();
      const inv = await getInventory();
      const words = q.split(/\s+/).filter((w) => w.length > 1);
      return inv
        .filter((v) => v.status !== "sold" && v.status !== "employee")
        .filter((v) => !words.length || words.every((w) => `${v.year} ${v.make} ${v.model} ${v.trim} ${v.extColor} ${v.stock}`.toLowerCase().includes(w)))
        .slice(0, 25)
        .map((v) => ({ stock: v.stock, year: v.year, make: v.make, model: v.model, trim: v.trim, price: v.price, kms: v.kms, color: v.extColor, condition: v.condition }));
    }
    case "list_followups": {
      const range = String(args.range ?? "upcoming");
      const start = new Date(now);
      start.setHours(0, 0, 0, 0);
      const end = new Date(start);
      const conds = [eq(followups.done, false)];
      if (range === "today") {
        end.setDate(end.getDate() + 1);
        conds.push(gte(followups.dueAt, start), lte(followups.dueAt, end));
      } else if (range === "week") {
        end.setDate(end.getDate() + 7);
        conds.push(gte(followups.dueAt, start), lte(followups.dueAt, end));
      } else if (range === "overdue") conds.push(lte(followups.dueAt, now));
      const rows = await db
        .select({ dueAt: followups.dueAt, kind: followups.kind, notes: followups.notes, assignedTo: followups.assignedTo, first: customers.firstName, last: customers.lastName, phone: customers.mobile })
        .from(followups)
        .leftJoin(customers, eq(customers.id, followups.customerId))
        .where(and(...conds))
        .orderBy(asc(followups.dueAt))
        .limit(50);
      return rows.map((r) => ({ when: r.dueAt.toISOString(), type: r.kind, client: `${r.first ?? ""} ${r.last ?? ""}`.trim(), phone: r.phone, notes: r.notes, assignedTo: r.assignedTo }));
    }
    case "search_clients": {
      const q = `%${String(args.query ?? "")}%`;
      const rows = await db
        .select()
        .from(customers)
        .where(or(ilike(customers.firstName, q), ilike(customers.lastName, q), ilike(customers.email, q), ilike(customers.mobile, q), ilike(customers.interestVehicle, q)))
        .limit(15);
      return rows.map((c) => ({
        name: `${c.firstName} ${c.lastName}`.trim(), phone: c.mobile || c.homePhone, email: c.email, city: c.city, stage: c.stage,
        lookingFor: c.interestVehicle, budget: Number(c.budgetPrice) || null, desiredPayment: Number(c.desiredPayment) || null,
        frequency: c.paymentFrequency, dealType: c.dealTypePref, notes: c.notes,
      }));
    }
    case "calculate_payment": {
      return estimatePayment(
        {
          price: Number(args.price) || 0,
          dealType: (["finance", "lease", "cash"].includes(String(args.dealType)) ? args.dealType : "finance") as DealType,
          term: args.term ? Number(args.term) : undefined,
          frequency: (["monthly", "biweekly", "weekly"].includes(String(args.frequency)) ? args.frequency : "monthly") as Frequency,
          rate: args.rate !== undefined && args.rate !== null ? Number(args.rate) : undefined,
          residualPct: args.residualPct ? Number(args.residualPct) : undefined,
          cashDown: args.cashDown ? Number(args.cashDown) : undefined,
          kmPerYear: args.kmPerYear ? Number(args.kmPerYear) : undefined,
        },
        lenders,
        s,
      );
    }
    case "list_lenders":
      return lenders.filter((l) => l.active).map((l) => ({ name: l.name, lease: l.allowLease, financeRates: l.financeRates, leaseRates: l.allowLease ? l.leaseRates : undefined }));
    case "list_quotes": {
      const st = String(args.status ?? "pending");
      const rows = await db.select().from(quotes).where(st === "all" ? undefined : eq(quotes.status, st)).orderBy(desc(quotes.createdAt)).limit(20);
      return rows.map((q) => ({ id: q.id, quoteNumber: q.quoteNumber, status: q.status, summary: q.summary, createdBy: q.createdBy, createdAt: q.createdAt }));
    }
    case "recent_deals": {
      const rows = await db.select({ n: deals.dealNumber, c: deals.customerName, v: deals.vehicleLabel, t: deals.dealType, st: deals.status, u: deals.updatedAt }).from(deals).orderBy(desc(deals.updatedAt)).limit(15);
      return rows;
    }
    default:
      return { error: "unknown tool" };
  }
}

const FUNCTIONS = [
  { name: "search_inventory", description: "Search the dealership's live vehicle inventory (year, make, model, trim, stock #, price, km, colour).", parameters: { type: "object", properties: { query: { type: "string", description: "e.g. 'urus', '2022 audi a7', or empty for all" } }, required: ["query"] } },
  { name: "list_followups", description: "List open CRM follow-ups / appointments.", parameters: { type: "object", properties: { range: { type: "string", enum: ["today", "week", "overdue", "upcoming"] } }, required: ["range"] } },
  { name: "search_clients", description: "Search CRM clients by name, phone, email or vehicle of interest.", parameters: { type: "object", properties: { query: { type: "string" } }, required: ["query"] } },
  {
    name: "calculate_payment",
    description:
      "Compute an exact payment with the dealership's real calculator (province taxes, freight, dealer fees, tire tax, lender rates, residual table, km tiers). Use the vehicle's MSRP/price in CAD. Leave rate/residual empty to use dealership defaults.",
    parameters: {
      type: "object",
      properties: {
        price: { type: "number" },
        dealType: { type: "string", enum: ["finance", "lease", "cash"] },
        term: { type: "number", description: "months" },
        frequency: { type: "string", enum: ["monthly", "biweekly", "weekly"] },
        rate: { type: "number", description: "annual % (optional)" },
        residualPct: { type: "number", description: "lease residual % (optional)" },
        cashDown: { type: "number" },
        kmPerYear: { type: "number" },
      },
      required: ["price", "dealType"],
    },
  },
  { name: "list_lenders", description: "List the dealership's lenders with their rates by term.", parameters: { type: "object", properties: {}, required: [] } },
  { name: "list_quotes", description: "List AI quotes by status.", parameters: { type: "object", properties: { status: { type: "string", enum: ["pending", "approved", "declined", "all"] } }, required: ["status"] } },
  { name: "recent_deals", description: "List the most recent deals.", parameters: { type: "object", properties: {}, required: [] } },
];

/* ---------------------------------------------------------------- location */

function dealerLocation(address: string, provCode: string) {
  const prov = getProvince(provCode);
  const parts = address.split(",").map((x) => x.trim());
  const city = parts.length >= 3 ? parts[parts.length - 3] : parts[1] ?? "";
  return { city, region: prov.name, provCode: prov.code, prov };
}

/* ---------------------------------------------------------------- fallback (no API key) */

async function fallback(q: string, lang: "fr" | "en"): Promise<string> {
  const t = q.toLowerCase();
  const fr = lang === "fr";
  const money = (n: number | null | undefined) => (n ?? 0).toLocaleString(fr ? "fr-CA" : "en-CA", { style: "currency", currency: "CAD" });
  if (/(suivi|follow|rendez|appointment|rdv|rappel)/.test(t)) {
    const range = /(aujourd|today)/.test(t) ? "today" : /(retard|overdue)/.test(t) ? "overdue" : /(semaine|week)/.test(t) ? "week" : "upcoming";
    const rows = (await runTool("list_followups", { range })) as { when: string; type: string; client: string; phone: string; notes: string }[];
    if (!rows.length) return fr ? "Aucun suivi ouvert pour cette période." : "No open follow-ups for that period.";
    const KIND: Record<string, [string, string]> = { call: ["Appel", "Call"], sms: ["Texto", "Text"], email: ["Courriel", "Email"], appointment: ["Rendez-vous", "Appointment"], test_drive: ["Essai routier", "Test drive"], delivery: ["Livraison", "Delivery"] };
    return (fr ? `**${rows.length} suivi(s) :**\n` : `**${rows.length} follow-up(s):**\n`) + rows.map((r) => `• ${new Date(r.when).toLocaleString(fr ? "fr-CA" : "en-CA", { dateStyle: "medium", timeStyle: "short", timeZone: "America/Toronto" })} — ${KIND[r.type]?.[fr ? 0 : 1] ?? r.type} — **${r.client}** ${r.phone ? `(${r.phone})` : ""}${r.notes ? ` — ${r.notes}` : ""}`).join("\n");
  }
  const months = t.match(/(\d{2})\s*(mois|months?|mo)/);
  const isLease = /(lease|location|louer)/.test(t);
  const isFin = /(financ|loan|prêt)/.test(t);
  const inv = (await runTool("search_inventory", { query: "" })) as { stock: string; year: string; make: string; model: string; trim: string; price: number; kms: number; color: string }[];
  const hit = inv.find((v) => t.includes(v.model.toLowerCase()) && v.model.length > 1) ?? inv.find((v) => t.includes(v.make.toLowerCase()));
  const priceM = t.match(/\$\s?(\d[\d\s,]{3,})|(\d[\d\s,]{3,})\s?\$/);
  const price = priceM ? Number((priceM[1] ?? priceM[2]).replace(/[\s,]/g, "")) : hit?.price;
  if ((isLease || isFin) && price) {
    const r = await runTool("calculate_payment", { price, dealType: isLease ? "lease" : "finance", term: months ? Number(months[1]) : 48, frequency: /bi-?weekly|2 sem/.test(t) ? "biweekly" : /weekly|hebdo/.test(t) ? "weekly" : "monthly" }) as ReturnType<typeof estimatePayment>;
    const veh = hit && !priceM ? `${hit.year} ${hit.make} ${hit.model} ${hit.trim} (stock ${hit.stock})` : money(price);
    return (fr
      ? `**${isLease ? "Location" : "Financement"} — ${veh}**\n• Prix : ${money(price)}\n• Prêteur : ${r.lender ?? "—"} · ${r.term} mois à ${r.ratePct}%\n${isLease ? `• Résiduel : ${r.residualPct}% (${money(r.residualValue)}) · ${r.kmPerYear?.toLocaleString("fr-CA")} km/an\n` : ""}• Paiement : **${money(r.paymentWithTax)}** taxes incl. (${money(r.paymentBeforeTax)} avant taxes, ${r.province} ${r.taxRatePct}%)\n• Dû à la livraison : ${money(r.dueOnDelivery)}${r.luxuryTax ? `\n• Taxe de luxe incluse : ${money(r.luxuryTax)}` : ""}`
      : `**${isLease ? "Lease" : "Finance"} — ${veh}**\n• Price: ${money(price)}\n• Lender: ${r.lender ?? "—"} · ${r.term} months at ${r.ratePct}%\n${isLease ? `• Residual: ${r.residualPct}% (${money(r.residualValue)}) · ${r.kmPerYear?.toLocaleString("en-CA")} km/yr\n` : ""}• Payment: **${money(r.paymentWithTax)}** tax incl. (${money(r.paymentBeforeTax)} before tax, ${r.province} ${r.taxRatePct}%)\n• Due on delivery: ${money(r.dueOnDelivery)}${r.luxuryTax ? `\n• Luxury tax included: ${money(r.luxuryTax)}` : ""}`);
  }
  if ((isLease || isFin) && !price) {
    return fr
      ? "Ce véhicule n'est pas dans l'inventaire. Indiquez le prix (ex. « location 48 mois Lamborghini Urus 2026 à 330 000 $ ») et je calcule le paiement exact. Pour obtenir automatiquement le PDSF canadien actuel, ajoutez une clé OPENAI_API_KEY (recherche Web)."
      : "That vehicle isn't in inventory. Give me the price (e.g. “lease 48 months 2026 Lamborghini Urus at $330,000”) and I'll compute the exact payment. To look up current Canadian MSRP automatically, add an OPENAI_API_KEY (web search).";
  }
  if (/(inventaire|inventory|stock|en stock|disponible|available)/.test(t) || hit) {
    const words = t.replace(/[^a-z0-9à-ÿ\s]/g, " ").split(/\s+/).filter((w) => inv.some((v) => `${v.make} ${v.model}`.toLowerCase().includes(w)) && w.length > 2);
    const list = words.length ? inv.filter((v) => words.some((w) => `${v.make} ${v.model}`.toLowerCase().includes(w))) : inv;
    if (!list.length) return fr ? "Aucun véhicule correspondant en inventaire." : "No matching vehicle in inventory.";
    return (fr ? `**${list.length} véhicule(s) en inventaire :**\n` : `**${list.length} vehicle(s) in inventory:**\n`) + list.slice(0, 15).map((v) => `• ${v.year} ${v.make} ${v.model} ${v.trim} — ${money(v.price)} — ${v.kms.toLocaleString()} km — ${v.color} (#${v.stock})`).join("\n");
  }
  if (/(offre|quote|soumission)/.test(t)) {
    const rows = (await runTool("list_quotes", { status: "pending" })) as { id: number; quoteNumber: string; summary: string }[];
    return rows.length ? (fr ? "**Offres en attente d'approbation :**\n" : "**Quotes awaiting approval:**\n") + rows.map((r) => `• ${r.quoteNumber || "#" + r.id} — ${r.summary}`).join("\n") : fr ? "Aucune offre en attente." : "No pending quotes.";
  }
  return fr
    ? "Je peux répondre maintenant aux questions sur **vos suivis, votre inventaire, vos clients, vos offres** et **calculer des paiements** (ex. « location 48 mois Urus »). Pour les questions générales (ex. prix de pneus d'hiver pour une Audi A7, PDSF d'un nouveau modèle), ajoutez une clé **OPENAI_API_KEY** dans les variables d'environnement : l'assistant utilisera alors l'IA avec recherche Web localisée."
    : "Right now I can answer about **your follow-ups, inventory, clients, quotes** and **calculate payments** (e.g. “lease 48 months Urus”). For general questions (e.g. winter tire prices for an Audi A7, MSRP of a new model), add an **OPENAI_API_KEY** environment variable — the assistant will then use AI with location-aware web search.";
}

/* ---------------------------------------------------------------- handler */

export async function POST(req: Request) {
  await ensureSchema();
  const me = await getSessionUser();
  const { messages, lang = "fr" } = (await req.json().catch(() => ({}))) as { messages?: Msg[]; lang?: "fr" | "en" };
  const history = (messages ?? []).filter((m) => m.content?.trim()).slice(-20);
  const last = history[history.length - 1]?.content ?? "";
  if (!last) return Response.json({ reply: "", engine: "none" });

  if (!aiEnabled()) return Response.json({ reply: await fallback(last, lang), engine: "local" });

  const s = await getSettings();
  const loc = dealerLocation(s.address, s.defaultProvince);
  const instructions = [
    `You are the AI assistant of ${s.dealerName}, a car dealership located at ${s.address} (${loc.region}, Canada).`,
    `Today is ${new Date().toLocaleDateString("en-CA", { timeZone: "America/Toronto", weekday: "long", year: "numeric", month: "long", day: "numeric" })}.`,
    `The user is ${me?.name ?? "staff"} (${me?.position ?? ""}). Reply in ${lang === "fr" ? "French (Québec)" : "English"} unless asked otherwise. Be concise, use bullet points and CAD amounts.`,
    `Local sales tax: ${loc.prov.hst ? `HST ${loc.prov.hst}%` : `GST ${loc.prov.gst}%${loc.prov.pst ? ` + ${loc.prov.pstLabel} ${loc.prov.pst}%` : ""}`}. Federal luxury tax applies above $100,000.`,
    "For anything about the dealership (inventory, follow-ups/appointments, clients, quotes, deals, lenders) ALWAYS use the tools — never invent data.",
    "For any payment question ALWAYS call calculate_payment so taxes, fees, rates and residuals match the dealership's real desking. If the vehicle is not in inventory, use web search to find the current Canadian MSRP (prefer the manufacturer's Canadian site), state the source, then call calculate_payment with that price.",
    "For general market questions (tire prices, parts, specs, rebates…) use web search focused on Canadian sources near the dealership's location and give prices in CAD.",
  ].join("\n");

  const tools = [
    { type: "web_search", user_location: { type: "approximate", country: "CA", city: loc.city || undefined, region: loc.region } },
    ...FUNCTIONS.map((f) => ({ type: "function", ...f })),
  ];

  try {
    let r = await openaiResponses({ instructions, tools, input: history.map((m) => ({ role: m.role, content: m.content })) });
    const used: string[] = [];
    for (let i = 0; i < 6; i++) {
      const calls = r.output.filter((o): o is Extract<OutputItem, { type: "function_call" }> => o.type === "function_call");
      if (!calls.length) break;
      const outputs = [];
      for (const c of calls) {
        used.push(c.name);
        let result: unknown;
        try {
          result = await runTool(c.name, JSON.parse(c.arguments || "{}"));
        } catch (e) {
          result = { error: String(e) };
        }
        outputs.push({ type: "function_call_output", call_id: c.call_id, output: JSON.stringify(result) });
      }
      r = await openaiResponses({ instructions, tools, previous_response_id: r.id, input: outputs });
    }
    const { text, sources } = outputText(r.output);
    return Response.json({ reply: text || "…", sources, tools: used, engine: "ai" });
  } catch (e) {
    const fb = await fallback(last, lang);
    return Response.json({ reply: `${fb}\n\n_(${lang === "fr" ? "IA indisponible" : "AI unavailable"} : ${String((e as Error).message).slice(0, 160)})_`, engine: "local" });
  }
}
