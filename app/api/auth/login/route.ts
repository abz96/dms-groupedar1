import { eq } from "drizzle-orm";
import { db } from "@/db";
import { staff } from "@/db/schema";
import { checkCredentials, createSession, SESSION_COOKIE, SESSION_MAX_AGE } from "@/lib/auth";
import { ensureSchema, verifyPassword } from "@/lib/server";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const { username, password } = (await req.json().catch(() => ({}))) as { username?: string; password?: string };
  const user = String(username ?? "").trim().toLowerCase();
  const pw = String(password ?? "");
  let ok = checkCredentials(user, pw);
  if (!ok && user) {
    await ensureSchema();
    const r = await db.select().from(staff).where(eq(staff.username, user));
    if (r[0] && r[0].active && verifyPassword(pw, r[0].passwordHash)) {
      ok = true;
      await db.update(staff).set({ lastLoginAt: new Date() }).where(eq(staff.id, r[0].id));
    }
  }
  if (!ok) {
    await new Promise((r) => setTimeout(r, 400));
    return Response.json({ ok: false }, { status: 401 });
  }
  const token = await createSession(String(username).trim().toLowerCase());
  const secure = new URL(req.url).protocol === "https:" || req.headers.get("x-forwarded-proto") === "https";
  return Response.json(
    { ok: true },
    {
      headers: {
        "Set-Cookie": `${SESSION_COOKIE}=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${SESSION_MAX_AGE}${secure ? "; Secure" : ""}`,
      },
    },
  );
}
