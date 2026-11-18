// Sessão: cookie assinado (HMAC) com `userId.sessionVersion.exp.sig`.
// Este arquivo roda também no middleware (Edge): só Web Crypto, sem Node APIs.
const enc = new TextEncoder();

function b64url(buf: ArrayBuffer): string {
  return btoa(String.fromCharCode(...new Uint8Array(buf)))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

async function hmac(value: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    enc.encode(process.env.AUTH_SECRET!),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  return b64url(await crypto.subtle.sign("HMAC", key, enc.encode(value)));
}

function safeEqual(a: string, b: string) {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

export const COOKIE = "bj_session";
export const SESSION_DAYS = 30;

export async function makeToken(userId: string, sessionVersion: number): Promise<string> {
  const payload = `${userId}.${sessionVersion}.${Date.now() + SESSION_DAYS * 24 * 3600 * 1000}`;
  return `${payload}.${await hmac(payload)}`;
}

export type Session = { userId: string; sessionVersion: number };

/** Valida assinatura e validade. A checagem de sessionVersion contra o banco é feita em getUser(). */
export async function verifyToken(token: string | undefined): Promise<Session | null> {
  if (!token || !process.env.AUTH_SECRET) return null;
  const parts = token.split(".");
  if (parts.length !== 4) return null;
  const [userId, ver, exp, sig] = parts;
  if (Number(exp) < Date.now()) return null;
  if (!safeEqual(sig, await hmac(`${userId}.${ver}.${exp}`))) return null;
  return { userId, sessionVersion: Number(ver) };
}
