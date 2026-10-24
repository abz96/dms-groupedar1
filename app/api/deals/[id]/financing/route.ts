import { dealFinancing } from "@/lib/credit-server";
import { ensureSchema } from "@/lib/server";

export const dynamic = "force-dynamic";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  await ensureSchema();
  const { id } = await params;
  const f = await dealFinancing(Number(id));
  if (!f) return Response.json({ error: "Not found" }, { status: 404 });
  return Response.json(f);
}
