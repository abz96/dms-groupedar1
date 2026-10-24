import { eq } from "drizzle-orm";
import { db } from "@/db";
import { deals } from "@/db/schema";
import { customerLabel, normalizeDeal, vehicleLabel } from "@/lib/deal";
import { ensureSchema, syncCustomerFromDeal } from "@/lib/server";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_req: Request, { params }: Ctx) {
  await ensureSchema();
  const { id } = await params;
  const rows = await db.select().from(deals).where(eq(deals.id, Number(id)));
  if (!rows[0]) return Response.json({ error: "Not found" }, { status: 404 });
  return Response.json({ ...rows[0], data: normalizeDeal(rows[0].data) });
}

export async function PUT(req: Request, { params }: Ctx) {
  await ensureSchema();
  const { id } = await params;
  const body = (await req.json()) as { data: unknown };
  const data = normalizeDeal(body.data);
  const customerId = await syncCustomerFromDeal(Number(id), data);
  if (customerId) data.customer.id = customerId;
  const [row] = await db
    .update(deals)
    .set({
      data,
      customerName: customerLabel(data),
      vehicleLabel: vehicleLabel(data),
      dealType: data.dealType,
      status: data.status,
      updatedAt: new Date(),
    })
    .where(eq(deals.id, Number(id)))
    .returning({ id: deals.id, updatedAt: deals.updatedAt });
  if (!row) return Response.json({ error: "Not found" }, { status: 404 });
  return Response.json({ ...row, customerId });
}

export async function DELETE(_req: Request, { params }: Ctx) {
  await ensureSchema();
  const { id } = await params;
  await db.delete(deals).where(eq(deals.id, Number(id)));
  return Response.json({ ok: true });
}
