import { eq } from "drizzle-orm";
import { db } from "@/db";
import { creditApps } from "@/db/schema";
import { autoDecide, normalizeCredit, readyForAuto, simulateBureau } from "@/lib/credit";
import { ensureSchema } from "@/lib/server";

export const dynamic = "force-dynamic";

/** (Re)generate the automatic report from the application, then run the automatic decision. */
export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  await ensureSchema();
  const { id } = await params;
  const cur = (await db.select().from(creditApps).where(eq(creditApps.id, Number(id))))[0];
  if (!cur) return Response.json({ error: "Not found" }, { status: 404 });
  let data = normalizeCredit(cur.data);
  if (!readyForAuto(data)) {
    return Response.json(
      { error: "Renseignements insuffisants : nom, revenu et montant à financer (quotation lié) sont requis." },
      { status: 400 },
    );
  }
  data = { ...data, bureau: simulateBureau({ ...data, bureau: { ...data.bureau, bookValue: "" } }), decision: { ...data.decision, auto: true } };
  data = autoDecide(data);
  await db.update(creditApps).set({ data, status: data.decision.status || "submitted", updatedAt: new Date() }).where(eq(creditApps.id, cur.id));
  return Response.json({ data, status: data.decision.status || "submitted" });
}
