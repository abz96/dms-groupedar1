import { eq } from "drizzle-orm";
import { db } from "@/db";
import { deals, quotes } from "@/db/schema";
import { customerLabel, normalizeDeal, vehicleLabel } from "@/lib/deal";
import { MAX_REBATE_PCT } from "@/lib/deal-engine";
import { ensureSchema, getSessionUser, syncCustomerFromDeal } from "@/lib/server";

export const dynamic = "force-dynamic";
type Ctx = { params: Promise<{ id: string }> };

/** Manager decision: approve (creates the deal) or decline. Admins only. */
export async function PUT(req: Request, { params }: Ctx) {
  await ensureSchema();
  const me = await getSessionUser();
  if (me?.role !== "admin") return Response.json({ error: "Seul un gestionnaire peut approuver ou refuser une offre." }, { status: 403 });
  const { id } = await params;
  const b = (await req.json().catch(() => ({}))) as { action?: "approve" | "decline"; note?: string };
  const rows = await db.select().from(quotes).where(eq(quotes.id, Number(id)));
  const q = rows[0];
  if (!q) return Response.json({ error: "Not found" }, { status: 404 });
  if (q.status !== "pending") return Response.json({ error: "Cette offre a déjà été traitée." }, { status: 409 });

  if (b.action === "decline") {
    await db
      .update(quotes)
      .set({ status: "declined", decidedBy: me.name, decisionNote: b.note ?? "", decidedAt: new Date() })
      .where(eq(quotes.id, q.id));
    return Response.json({ ok: true });
  }

  const data = normalizeDeal((q.data as { deal: unknown }).deal);
  const msrp = data.pricing.basePrice + data.pricing.options;
  if (msrp > 0 && data.pricing.reduction > msrp * (MAX_REBATE_PCT / 100) + 0.01) {
    return Response.json({ error: `Rabais supérieur à ${MAX_REBATE_PCT}% — offre refusée automatiquement.` }, { status: 400 });
  }
  data.status = "pending";
  data.quoteNumber = q.quoteNumber || `QT-${100000 + q.id}`;
  const [deal] = await db
    .insert(deals)
    .values({ dealNumber: "TMP", customerName: customerLabel(data), vehicleLabel: vehicleLabel(data), dealType: data.dealType, status: "pending", data })
    .returning({ id: deals.id });
  const dealNumber = String(39978000 + deal.id);
  const cid = await syncCustomerFromDeal(deal.id, data);
  if (cid) data.customer.id = cid;
  await db.update(deals).set({ dealNumber, data }).where(eq(deals.id, deal.id));
  await db
    .update(quotes)
    .set({ status: "approved", decidedBy: me.name, decisionNote: b.note ?? "", decidedAt: new Date(), dealId: deal.id })
    .where(eq(quotes.id, q.id));
  return Response.json({ ok: true, dealId: deal.id, dealNumber, quoteNumber: data.quoteNumber });
}

export async function DELETE(_req: Request, { params }: Ctx) {
  await ensureSchema();
  const me = await getSessionUser();
  if (me?.role !== "admin") return Response.json({ error: "Forbidden" }, { status: 403 });
  const { id } = await params;
  await db.delete(quotes).where(eq(quotes.id, Number(id)));
  return Response.json({ ok: true });
}
