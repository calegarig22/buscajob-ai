"use server";

import { and, eq, gt, isNull, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { db, invites, users } from "@/db";
import { ensureSeeds } from "@/lib/seed";
import { track } from "@/lib/activity";
import {
  endSession,
  hashPassword,
  hashToken,
  newLinkToken,
  requireAdmin,
  requireUser,
  startSession,
  validatePassword,
  verifyPassword,
} from "@/lib/session";

const normEmail = (v: FormDataEntryValue | null) => String(v ?? "").trim().toLowerCase();
const back = (path: string, erro: string) => redirect(`${path}${path.includes("?") ? "&" : "?"}erro=${encodeURIComponent(erro)}`);

// hash fixo para gastar o mesmo tempo quando o e-mail não existe (evita descobrir contas pelo tempo de resposta)
const DUMMY = "scrypt$AAAAAAAAAAAAAAAAAAAAAA==$" + "A".repeat(86) + "==";

export async function login(formData: FormData) {
  const email = normEmail(formData.get("email"));
  const pass = String(formData.get("password") ?? "");
  const [u] = await db.select().from(users).where(eq(users.email, email));
  const ok = await verifyPassword(pass, u?.passwordHash ?? DUMMY).catch(() => false);
  if (!u || !ok) {
    await new Promise((r) => setTimeout(r, 700)); // freia tentativa e erro
    back("/login", "E-mail ou senha incorretos.");
  }
  await db.update(users).set({ lastLoginAt: new Date(), lastSeenAt: new Date() }).where(eq(users.id, u!.id));
  await track(u!.id, "login");
  await startSession(u!);
  redirect("/");
}

async function findLink(token: string, kind: "invite" | "reset") {
  const [inv] = await db
    .select()
    .from(invites)
    .where(
      and(
        eq(invites.tokenHash, hashToken(token)),
        eq(invites.kind, kind),
        isNull(invites.usedAt),
        gt(invites.expiresAt, new Date()),
      ),
    );
  return inv ?? null;
}

export async function signup(formData: FormData) {
  const path = "/cadastro";
  // campo invisível: pessoas não preenchem, robôs de cadastro sim
  if (String(formData.get("website") ?? "") !== "") redirect("/login");

  const name = String(formData.get("name") ?? "").trim().slice(0, 80);
  const email = normEmail(formData.get("email"));
  const pass = String(formData.get("password") ?? "");
  if (!name) back(path, "Informe seu nome.");
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email) || email.length > 200) back(path, "E-mail inválido.");
  const pwErr = validatePassword(pass);
  if (pwErr) back(path, pwErr);
  if (String(formData.get("pass2")) !== pass) back(path, "As senhas não conferem.");
  if (formData.get("terms") !== "on") back(path, "É preciso aceitar a política de privacidade para criar a conta.");

  const [exists] = await db.select({ id: users.id }).from(users).where(eq(users.email, email));
  if (exists) back(path, "Já existe uma conta com este e-mail. Entre pelo login.");

  const [u] = await db
    .insert(users)
    .values({
      name,
      email,
      passwordHash: await hashPassword(pass),
      termsAcceptedAt: new Date(),
      lastLoginAt: new Date(),
      lastSeenAt: new Date(),
    })
    .onConflictDoNothing()
    .returning();
  if (!u) back(path, "Já existe uma conta com este e-mail. Entre pelo login.");
  await ensureSeeds(u.id);
  await track(u.id, "cadastro");
  await startSession(u);
  redirect("/perfil");
}

export async function resetPassword(formData: FormData) {
  const token = String(formData.get("token") ?? "");
  const path = `/redefinir?token=${encodeURIComponent(token)}`;
  const inv = await findLink(token, "reset");
  if (!inv?.userId) back("/login", "Link inválido ou expirado. Peça um novo ao administrador.");
  const pass = String(formData.get("password") ?? "");
  const pwErr = validatePassword(pass);
  if (pwErr) back(path, pwErr);
  if (String(formData.get("pass2")) !== pass) back(path, "As senhas não conferem.");

  await db.update(invites).set({ usedAt: new Date() }).where(eq(invites.tokenHash, inv!.tokenHash));
  const [u] = await db
    .update(users)
    .set({ passwordHash: await hashPassword(pass), sessionVersion: sql`${users.sessionVersion} + 1` })
    .where(eq(users.id, inv!.userId!))
    .returning();
  await startSession(u);
  redirect("/");
}

export async function changePassword(formData: FormData) {
  const user = await requireUser();
  const cur = String(formData.get("current") ?? "");
  const pass = String(formData.get("password") ?? "");
  if (!(await verifyPassword(cur, user.passwordHash))) back("/conta", "Senha atual incorreta.");
  const pwErr = validatePassword(pass);
  if (pwErr) back("/conta", pwErr);
  if (String(formData.get("pass2")) !== pass) back("/conta", "As senhas não conferem.");
  const [u] = await db
    .update(users)
    .set({ passwordHash: await hashPassword(pass), sessionVersion: sql`${users.sessionVersion} + 1` })
    .where(eq(users.id, user.id))
    .returning();
  await startSession(u); // mantém esta sessão; as outras caem
  redirect("/conta?ok=senha");
}

/** LGPD: apaga a conta e tudo ligado a ela (perfil, currículo, vagas, empresas) via ON DELETE CASCADE. */
export async function deleteAccount(formData: FormData) {
  const user = await requireUser();
  if (normEmail(formData.get("confirm")) !== user.email) back("/conta", "Digite seu e-mail exatamente para confirmar.");
  if (user.role === "admin") {
    const [{ n }] = await db.select({ n: sql<number>`count(*)::int` }).from(users).where(eq(users.role, "admin"));
    if (n <= 1) back("/conta", "Você é o único administrador. Promova outra pessoa antes de apagar sua conta.");
  }
  await db.delete(users).where(eq(users.id, user.id));
  await endSession();
  redirect("/login?apagada=1");
}

/* ───────── Admin ───────── */

async function origin() {
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host");
  const proto = h.get("x-forwarded-proto") ?? "https";
  return `${proto}://${host}`;
}

export async function createResetLink(userId: string) {
  const admin = await requireAdmin();
  const [u] = await db.select({ name: users.name }).from(users).where(eq(users.id, userId));
  if (!u) return;
  const { token, hash } = newLinkToken();
  await db.insert(invites).values({
    tokenHash: hash,
    kind: "reset",
    userId,
    createdBy: admin.id,
    expiresAt: new Date(Date.now() + 24 * 3600 * 1000),
  });
  redirect(
    `/admin?link=${encodeURIComponent(`${await origin()}/redefinir?token=${token}`)}&para=${encodeURIComponent(`redefinir senha de ${u.name}`)}`,
  );
}

export async function adminDeleteUser(userId: string) {
  const admin = await requireAdmin();
  if (userId === admin.id) return;
  // admins não removem outros admins (evita um admin apagar o dono do serviço)
  await db.delete(users).where(and(eq(users.id, userId), eq(users.role, "user")));
  revalidatePath("/admin");
}
