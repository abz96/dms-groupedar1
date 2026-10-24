import { desc, eq } from "drizzle-orm";
import { db } from "@/db";
import { creditApps, customers } from "@/db/schema";
import { applyFinancing, autoProcess, emptyCredit, type DealFinancing } from "@/lib/credit";
import { dealFinancing } from "@/lib/credit-server";
import { ensureSchema, getSessionUser } from "@/lib/server";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  await ensureSchema();
  if (new URL(req.url).searchParams.get("summary") === "1") {
    const all = await db.select({ status: creditApps.status }).from(creditApps);
    const c = (k: string) => all.filter((x) => x.status === k).length;
    return Response.json({ total: all.length, conditional: c("conditional"), declined: c("declined"), approved: c("approved"), pending: c("submitted") + c("draft") });
  }
  const rows = await db
    .select({
      id: creditApps.id,
      appNumber: creditApps.appNumber,
      customerId: creditApps.customerId,
      dealId: creditApps.dealId,
      status: creditApps.status,
      applicantName: creditApps.applicantName,
      createdBy: creditApps.createdBy,
      createdAt: creditApps.createdAt,
      updatedAt: creditApps.updatedAt,
      data: creditApps.data,
    })
    .from(creditApps)
    .orderBy(desc(creditApps.updatedAt));
  return Response.json(
    rows.map(({ data, ...r }) => {
      const x = data as { vehicle?: string; amountRequested?: string; dealType?: string; quoteNumber?: string; applicant?: { mobile?: string }; bureau?: { score?: string }; decision?: { status?: string } };
      return {
        ...r,
        vehicle: x.vehicle ?? "",
        amountRequested: x.amountRequested ?? "",
        dealType: x.dealType ?? "",
        phone: x.applicant?.mobile ?? "",
        quoteNumber: x.quoteNumber ?? "",
        score: x.bureau?.score ?? "",
        decision: x.decision?.status ?? "",
      };
    }),
  );
}

/** Create a credit application, pre-filled from a CRM client and/or a deal. */
export async function POST(req: Request) {
  await ensureSchema();
  const me = await getSessionUser();
  const b = (await req.json().catch(() => ({}))) as { customerId?: number | null; dealId?: number | null };
  const data = emptyCredit();
  let customerId = b.customerId ? Number(b.customerId) : null;
  const dealId = b.dealId ? Number(b.dealId) : null;
  let fin: DealFinancing | null = null;
  if (dealId) {
    fin = await dealFinancing(dealId);
    if (fin) {
      Object.assign(data, applyFinancing(data, fin));
      if (!customerId && fin.customerId) customerId = fin.customerId;
    }
  }
  if (customerId) {
    const c = (await db.select().from(customers).where(eq(customers.id, customerId)))[0];
    if (c) {
      const a = data.applicant;
      a.firstName ||= c.firstName;
      a.lastName ||= c.lastName;
      a.email ||= c.email;
      a.mobile ||= c.mobile;
      a.homePhone ||= c.homePhone;
      a.address ||= c.address;
      a.city ||= c.city;
      a.province = a.province || c.province || "QC";
      a.postal ||= c.postal;
      if (!data.vehicle && c.interestVehicle) data.vehicle = c.interestVehicle;
      if (!dealId && c.dealTypePref) data.dealType = c.dealTypePref === "lease" ? "lease" : "finance";
    }
  }
  const processed = autoProcess(data);
  Object.assign(data, processed);
  const [row] = await db
    .insert(creditApps)
    .values({
      customerId,
      dealId,
      status: data.decision.status || "draft",
      applicantName: `${data.applicant.firstName} ${data.applicant.lastName}`.trim(),
      data,
      createdBy: me?.name ?? "",
    })
    .returning({ id: creditApps.id });
  const appNumber = `CA-${100000 + row.id}`;
  await db.update(creditApps).set({ appNumber }).where(eq(creditApps.id, row.id));
  return Response.json({ id: row.id, appNumber });
}
