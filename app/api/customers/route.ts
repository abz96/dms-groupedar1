import { desc, eq, sql } from "drizzle-orm";
import { db } from "@/db";
import { customers, deals, followups } from "@/db/schema";
import { customerValues, ensureSchema } from "@/lib/server";

export const dynamic = "force-dynamic";

export async function GET() {
  await ensureSchema();
  const rows = await db.select().from(customers).orderBy(desc(customers.updatedAt));
  const counts = await db
    .select({ cid: sql<string>`${deals.data}->'customer'->>'id'`, n: sql<number>`count(*)::int`, last: sql<string>`max(${deals.updatedAt})` })
    .from(deals)
    .groupBy(sql`${deals.data}->'customer'->>'id'`);
  const map = new Map(counts.filter((c) => c.cid).map((c) => [Number(c.cid), c]));
  const fu = await db
    .select({ cid: followups.customerId, next: sql<string>`min(${followups.dueAt})`, open: sql<number>`count(*)::int` })
    .from(followups)
    .where(eq(followups.done, false))
    .groupBy(followups.customerId);
  const fmap = new Map(fu.map((f) => [f.cid, f]));
  return Response.json(
    rows.map((r) => ({
      ...r,
      dealCount: map.get(r.id)?.n ?? 0,
      lastDealAt: map.get(r.id)?.last ?? null,
      nextFollowUp: fmap.get(r.id)?.next ?? null,
      openFollowUps: fmap.get(r.id)?.open ?? 0,
    })),
  );
}

export async function POST(req: Request) {
  await ensureSchema();
  const b = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const values = customerValues(b);
  if (!values.firstName && !values.lastName) return Response.json({ error: "Name required" }, { status: 400 });
  const [row] = await db.insert(customers).values(values).returning();
  return Response.json(row);
}
