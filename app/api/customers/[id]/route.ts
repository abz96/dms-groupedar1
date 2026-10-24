import { asc, desc, eq, sql } from "drizzle-orm";
import { db } from "@/db";
import { customers, deals, followups, quotes } from "@/db/schema";
import { normalizeDeal } from "@/lib/deal";
import { customerValues, ensureSchema } from "@/lib/server";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_req: Request, { params }: Ctx) {
  await ensureSchema();
  const { id } = await params;
  const rows = await db.select().from(customers).where(eq(customers.id, Number(id)));
  if (!rows[0]) return Response.json({ error: "Not found" }, { status: 404 });
  const ds = await db
    .select({
      id: deals.id,
      dealNumber: deals.dealNumber,
      vehicleLabel: deals.vehicleLabel,
      dealType: deals.dealType,
      status: deals.status,
      updatedAt: deals.updatedAt,
    })
    .from(deals)
    .where(sql`${deals.data}->'customer'->>'id' = ${String(id)}`)
    .orderBy(desc(deals.updatedAt));
  const fus = await db.select().from(followups).where(eq(followups.customerId, Number(id))).orderBy(asc(followups.done), asc(followups.dueAt));
  const qs = await db
    .select({ id: quotes.id, quoteNumber: quotes.quoteNumber, status: quotes.status, dealType: quotes.dealType, summary: quotes.summary, createdAt: quotes.createdAt })
    .from(quotes)
    .where(eq(quotes.customerId, Number(id)))
    .orderBy(desc(quotes.createdAt));
  return Response.json({ ...rows[0], deals: ds, followups: fus, quotes: qs });
}

/** Update client; linked deals get the new contact info too. */
export async function PUT(req: Request, { params }: Ctx) {
  await ensureSchema();
  const { id } = await params;
  const b = (await req.json()) as Record<string, unknown>;
  const values = customerValues(b);
  const [row] = await db
    .update(customers)
    .set({ ...values, updatedAt: new Date() })
    .where(eq(customers.id, Number(id)))
    .returning();
  if (!row) return Response.json({ error: "Not found" }, { status: 404 });

  const linked = await db
    .select({ id: deals.id, data: deals.data })
    .from(deals)
    .where(sql`${deals.data}->'customer'->>'id' = ${String(id)}`);
  for (const l of linked) {
    const d = normalizeDeal(l.data);
    const contact = {
      firstName: values.firstName, lastName: values.lastName, email: values.email, homePhone: values.homePhone,
      mobile: values.mobile, address: values.address, city: values.city, province: values.province, postal: values.postal,
    };
    d.customer = { ...d.customer, ...contact, province: contact.province || d.customer.province, id: Number(id) };
    await db
      .update(deals)
      .set({ data: d, customerName: `${values.firstName} ${values.lastName}`.trim() })
      .where(eq(deals.id, l.id));
  }
  return Response.json(row);
}

/** Delete client (deals are kept, just unlinked). */
export async function DELETE(_req: Request, { params }: Ctx) {
  await ensureSchema();
  const { id } = await params;
  const linked = await db
    .select({ id: deals.id, data: deals.data })
    .from(deals)
    .where(sql`${deals.data}->'customer'->>'id' = ${String(id)}`);
  for (const l of linked) {
    const d = normalizeDeal(l.data);
    d.customer.id = null;
    await db.update(deals).set({ data: d }).where(eq(deals.id, l.id));
  }
  await db.delete(followups).where(eq(followups.customerId, Number(id)));
  await db.delete(customers).where(eq(customers.id, Number(id)));
  return Response.json({ ok: true });
}
