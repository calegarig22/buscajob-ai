import "server-only";
import { randomBytes, scrypt as _scrypt, timingSafeEqual, createHash } from "node:crypto";
import { promisify } from "node:util";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { eq } from "drizzle-orm";
import { cache } from "react";
import { db, users, type User } from "@/db";
import { COOKIE, SESSION_DAYS, makeToken, verifyToken } from "./auth";

const scrypt = promisify(_scrypt) as (pw: string, salt: Buffer, len: number) => Promise<Buffer>;

/** scrypt com salt aleatório. Formato: scrypt$<salt b64>$<hash b64> */
export async function hashPassword(pw: string): Promise<string> {
  const salt = randomBytes(16);
  const hash = await scrypt(pw, salt, 64);
  return `scrypt$${salt.toString("base64")}$${hash.toString("base64")}`;
}

export async function verifyPassword(pw: string, stored: string): Promise<boolean> {
  const [alg, saltB64, hashB64] = stored.split("$");
  if (alg !== "scrypt" || !saltB64 || !hashB64) return false;
  const expected = Buffer.from(hashB64, "base64");
  const got = await scrypt(pw, Buffer.from(saltB64, "base64"), expected.length);
  return timingSafeEqual(got, expected);
}

export function validatePassword(pw: string): string | null {
  if (pw.length < 10) return "A senha precisa ter pelo menos 10 caracteres.";
  if (pw.length > 200) return "Senha longa demais.";
  return null;
}

/** Token aleatório para links (convite/redefinição) + hash que vai para o banco. */
export function newLinkToken() {
  const token = randomBytes(24).toString("base64url");
  return { token, hash: hashToken(token) };
}
export function hashToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

export async function startSession(user: Pick<User, "id" | "sessionVersion">) {
  (await cookies()).set(COOKIE, await makeToken(user.id, user.sessionVersion), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: SESSION_DAYS * 24 * 3600,
    path: "/",
  });
}

export async function endSession() {
  (await cookies()).delete(COOKIE);
}

/** Usuário logado (ou null). Rejeita sessões de versão antiga (senha trocada / "sair de todos"). */
export const getUser = cache(async (): Promise<User | null> => {
  const s = await verifyToken((await cookies()).get(COOKIE)?.value);
  if (!s) return null;
  const [u] = await db.select().from(users).where(eq(users.id, s.userId));
  if (!u || u.sessionVersion !== s.sessionVersion) return null;
  // "visto por último" para o painel do admin; grava no máximo a cada 5 min por pessoa
  if (!u.lastSeenAt || Date.now() - u.lastSeenAt.getTime() > 5 * 60 * 1000) {
    await db.update(users).set({ lastSeenAt: new Date() }).where(eq(users.id, u.id));
  }
  return u;
});

export async function requireUser(): Promise<User> {
  const u = await getUser();
  if (!u) redirect("/login");
  return u;
}

export async function requireAdmin(): Promise<User> {
  const u = await requireUser();
  if (u.role !== "admin") redirect("/");
  return u;
}
