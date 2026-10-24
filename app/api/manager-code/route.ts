import { getSettings } from "@/lib/server";

export const dynamic = "force-dynamic";

/** Verify the manager approval code (Settings → managerCode, default 9296). */
export async function POST(req: Request) {
  const { code } = (await req.json().catch(() => ({}))) as { code?: string };
  const s = await getSettings();
  const expected = String(s.managerCode || process.env.MANAGER_CODE || "9296");
  const ok = String(code ?? "").trim() === expected;
  if (!ok) await new Promise((r) => setTimeout(r, 400));
  return Response.json({ ok }, { status: ok ? 200 : 401 });
}
