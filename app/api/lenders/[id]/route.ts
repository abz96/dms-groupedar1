import { eq } from "drizzle-orm";
import { db } from "@/db";
import { lenders } from "@/db/schema";
import { ensureSchema } from "@/lib/server";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

export async function PUT(req: Request, { params }: Ctx) {
  await ensureSchema();
  const { id } = await params;
  const b = (await req.json()) as Record<string, unknown>;
  const [row] = await db
    .update(lenders)
    .set({
      name: String(b.name ?? ""),
      shortName: String(b.shortName ?? ""),
      type: String(b.type ?? "bank"),
      active: Boolean(b.active),
      allowFinance: Boolean(b.allowFinance),
      allowLease: Boolean(b.allowLease),
      financeRates: (b.financeRates as object) ?? {},
      leaseRates: (b.leaseRates as object) ?? {},
      residuals: (b.residuals as object) ?? {},
      maxMarkup: String(b.maxMarkup ?? "0"),
      reserveShare: String(b.reserveShare ?? "0"),
      registrationFee: String(b.registrationFee ?? "0"),
      notes: String(b.notes ?? ""),
    })
    .where(eq(lenders.id, Number(id)))
    .returning();
  return Response.json(row);
}

export async function DELETE(_req: Request, { params }: Ctx) {
  await ensureSchema();
  const { id } = await params;
  await db.delete(lenders).where(eq(lenders.id, Number(id)));
  return Response.json({ ok: true });
}
