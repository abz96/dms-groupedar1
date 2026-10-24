/** Lightweight signed-cookie session (Web Crypto — works in proxy and route handlers). */

export const SESSION_COOKIE = "dms_session";
export const SESSION_MAX_AGE = 60 * 60 * 12; // 12 hours

export const AUTH_USER = process.env.AUTH_USER || "adar";
export const AUTH_PASSWORD = process.env.AUTH_PASSWORD || "9296";
const SECRET = process.env.AUTH_SECRET || "dms-desking-session-secret-change-me";

const enc = new TextEncoder();

async function hmac(data: string): Promise<string> {
  const key = await crypto.subtle.importKey("raw", enc.encode(SECRET), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const sig = await crypto.subtle.sign("HMAC", key, enc.encode(data));
  return Array.from(new Uint8Array(sig))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

function safeEqual(a: string, b: string) {
  if (a.length !== b.length) return false;
  let r = 0;
  for (let i = 0; i < a.length; i++) r |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return r === 0;
}

/** usernames are hex-encoded in the token (no dots / percent signs — cookie-safe) */
const toHex = (s: string) => Array.from(enc.encode(s)).map((b) => b.toString(16).padStart(2, "0")).join("");
const fromHex = (h: string) => new TextDecoder().decode(new Uint8Array((h.match(/../g) ?? []).map((x) => parseInt(x, 16))));

export async function createSession(user: string): Promise<string> {
  const exp = Math.floor(Date.now() / 1000) + SESSION_MAX_AGE;
  const payload = `${toHex(user)}.${exp}`;
  return `${payload}.${await hmac(payload)}`;
}

export async function verifySession(token: string | undefined | null): Promise<string | null> {
  if (!token) return null;
  const parts = token.split(".");
  if (parts.length !== 3) return null;
  const [u, exp, sig] = parts;
  if (!/^[0-9a-f]+$/.test(u)) return null;
  if (!safeEqual(sig, await hmac(`${u}.${exp}`))) return null;
  if (Number(exp) < Math.floor(Date.now() / 1000)) return null;
  return fromHex(u);
}

export function checkCredentials(user: string, password: string) {
  return safeEqual(user.trim().toLowerCase(), AUTH_USER.toLowerCase()) && safeEqual(password, AUTH_PASSWORD);
}
