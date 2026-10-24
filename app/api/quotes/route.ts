import { desc, eq } from "drizzle-orm";
import { db } from "@/db";
import { customers, quotes } from "@/db/schema";
import { parseQuoteRequest } from "@/lib/ai";
import { generateQuotes, type QuoteParams } from "@/lib/deal-engine";
import type { DealType, Frequency } from "@/lib/deal";
import { ensureSchema, getInventory, getLenders, getSessionUser, getSettings } from "@/lib/server";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  await ensureSchema();
  const status = new URL(req.url).searchParams.get("status");
  const rows = await db
    .select({
      id: quotes.id,
      quoteNumber: quotes.quoteNumber,
      customerId: quotes.customerId,
      inventoryId: quotes.inventoryId,
      status: quotes.status,
      dealType: quotes.dealType,
      summary: quotes.summary,
      request: quotes.request,
      data: quotes.data,
      createdBy: quotes.createdBy,
      decidedBy: quotes.decidedBy,
      decisionNote: quotes.decisionNote,
      decidedAt: quotes.decidedAt,
      dealId: quotes.dealId,
      createdAt: quotes.createdAt,
      firstName: customers.firstName,
      lastName: customers.lastName,
    })
    .from(quotes)
    .leftJoin(customers, eq(customers.id, quotes.customerId))
    .where(status && status !== "all" ? eq(quotes.status, status) : undefined)
    .orderBy(desc(quotes.createdAt))
    .limit(300);
  // send only the result summary (not the full deal) to the list
  return Response.json(rows.map(({ data, ...r }) => ({ ...r, result: (data as { result?: unknown })?.result ?? null })));
}

/** Generate quotes (preview) or save selected ones for manager approval. */
export async function POST(req: Request) {
  await ensureSchema();
  const me = await getSessionUser();
  const b = (await req.json().catch(() => ({}))) as {
    mode?: "preview" | "save";
    request?: string;
    params?: Partial<QuoteParams>;
    customerId?: number | null;
    selected?: number[];
  };
  const [inv, lenders, s] = await Promise.all([getInventory(), getLenders(), getSettings()]);
  const makes = Array.from(new Set(inv.map((v) => v.make).filter(Boolean)));
  const ai = await parseQuoteRequest(b.request ?? "", makes);
  const clean = Object.fromEntries(Object.entries(b.params ?? {}).filter(([, v]) => v !== null && v !== "" && v !== undefined && v !== 0));
  const params: QuoteParams = {
    dealType: "finance" as DealType,
    frequency: "monthly" as Frequency,
    count: 3,
    ...ai,
    ...clean,
  } as QuoteParams;

  const results = generateQuotes(inv, params, lenders, s);
  if (b.mode !== "save") {
    return Response.json({ params, results: results.map(({ deal: _d, ...r }) => (void _d, r)) });
  }

  // customer link
  let cust: { firstName: string; lastName: string; email: string; mobile: string; homePhone: string; address: string; city: string; province: string; postal: string; id: number } | null = null;
  if (b.customerId) {
    const r = await db.select().from(customers).where(eq(customers.id, Number(b.customerId)));
    cust = r[0] ?? null;
  }
  const pick = b.selected?.length ? results.filter((_, i) => b.selected!.includes(i)) : results;
  const saved = [];
  for (const r of pick) {
    if (cust) {
      r.deal.customer = {
        ...r.deal.customer,
        id: cust.id,
        firstName: cust.firstName,
        lastName: cust.lastName,
        email: cust.email,
        mobile: cust.mobile,
        homePhone: cust.homePhone,
        address: cust.address,
        city: cust.city,
        province: cust.province || r.deal.customer.province,
        postal: cust.postal,
      };
    }
    if (me?.staffId) r.deal.salesperson = me.name;
    const { deal, ...result } = r;
    const summary = `${r.vehicle.year} ${r.vehicle.make} ${r.vehicle.model}${r.vehicle.trim ? " " + r.vehicle.trim : ""} — ${r.payment.toFixed(2)} $`;
    const [row] = await db
      .insert(quotes)
      .values({
        customerId: cust?.id ?? null,
        inventoryId: r.vehicle.id,
        status: "pending",
        dealType: params.dealType,
        summary,
        request: b.request ?? "",
        data: { deal, result, params },
        createdBy: me?.name ?? "",
      })
      .returning({ id: quotes.id });
    const quoteNumber = `QT-${100000 + row.id}`;
    await db.update(quotes).set({ quoteNumber }).where(eq(quotes.id, row.id));
    saved.push({ id: row.id, quoteNumber });
  }
  return Response.json({ saved });
}
