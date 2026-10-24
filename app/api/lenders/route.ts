import { db } from "@/db";
import { lenders } from "@/db/schema";
import { ensureSchema, getLenders } from "@/lib/server";

export const dynamic = "force-dynamic";

export async function GET() {
  return Response.json(await getLenders());
}

export async function POST(req: Request) {
  await ensureSchema();
  const b = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const [row] = await db
    .insert(lenders)
    .values({
      name: String(b.name ?? "Nouveau prêteur"),
      shortName: String(b.shortName ?? "NEW"),
      type: String(b.type ?? "bank"),
      active: true,
      allowFinance: true,
      allowLease: Boolean(b.allowLease ?? false),
      financeRates: (b.financeRates as object) ?? { "36": 6.99, "48": 6.99, "60": 7.24, "72": 7.49, "84": 7.74 },
      leaseRates: (b.leaseRates as object) ?? {},
      residuals: (b.residuals as object) ?? {},
      maxMarkup: String(b.maxMarkup ?? "2.00"),
      reserveShare: String(b.reserveShare ?? "75"),
      registrationFee: String(b.registrationFee ?? "53.76"),
      notes: String(b.notes ?? ""),
      sortOrder: 999,
    })
    .returning();
  return Response.json(row);
}
