import { eq } from "drizzle-orm";
import { db } from "@/db";
import { creditApps } from "@/db/schema";
import { autoProcess, normalizeCredit, num, type CreditData } from "@/lib/credit";
import { ensureSchema } from "@/lib/server";

export const dynamic = "force-dynamic";
type Ctx = { params: Promise<{ id: string }> };

const statusFor = (d: CreditData, fallback: string) => d.decision.status || (num(d.bureau.score) ? "submitted" : fallback === "draft" ? "draft" : fallback);

export async function GET(_req: Request, { params }: Ctx) {
  await ensureSchema();
  const { id } = await params;
  const r = (await db.select().from(creditApps).where(eq(creditApps.id, Number(id))))[0];
  if (!r) return Response.json({ error: "Not found" }, { status: 404 });
  return Response.json({ ...r, data: normalizeCredit(r.data) });
}

/**
 * Save. `preserve` keeps the stored bureau/decision (used by the application form so it never overwrites the report).
 * The automatic engine runs on every save: report generated when the file is complete, decision recomputed.
 */
export async function PUT(req: Request, { params }: Ctx) {
  await ensureSchema();
  const { id } = await params;
  const cur = (await db.select().from(creditApps).where(eq(creditApps.id, Number(id))))[0];
  if (!cur) return Response.json({ error: "Not found" }, { status: 404 });
  const b = (await req.json().catch(() => ({}))) as { data?: unknown; status?: string; customerId?: number | null; dealId?: number | null; preserve?: string[] };
  let data = normalizeCredit(b.data);
  const stored = normalizeCredit(cur.data);
  if (b.preserve?.includes("bureau")) data.bureau = stored.bureau;
  if (b.preserve?.includes("decision")) data.decision = stored.decision;
  data = autoProcess(data);
  const patch: Partial<typeof creditApps.$inferInsert> = {
    data,
    applicantName: `${data.applicant.firstName} ${data.applicant.lastName}`.trim(),
    status: statusFor(data, b.status && ["draft", "submitted"].includes(b.status) ? b.status : cur.status),
    updatedAt: new Date(),
  };
  if (b.customerId !== undefined) patch.customerId = b.customerId;
  if (b.dealId !== undefined) patch.dealId = b.dealId;
  const [row] = await db.update(creditApps).set(patch).where(eq(creditApps.id, Number(id))).returning();
  return Response.json({ id: row.id, status: row.status, updatedAt: row.updatedAt, data });
}

export async function DELETE(_req: Request, { params }: Ctx) {
  await ensureSchema();
  const { id } = await params;
  await db.delete(creditApps).where(eq(creditApps.id, Number(id)));
  return Response.json({ ok: true });
}
