import { and, eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { db, jobs } from "@/db";
import { getUser } from "@/lib/session";
import { checkLive } from "@/lib/liveness";

// "Abrir vaga": confere na hora se a vaga continua aberta antes de levar a pessoa ao site da empresa.
export async function GET(req: Request) {
  const user = await getUser();
  const url = new URL(req.url);
  if (!user) return NextResponse.redirect(new URL("/login", url));
  const id = url.searchParams.get("id") ?? "";
  const [job] = await db
    .select()
    .from(jobs)
    .where(and(eq(jobs.userId, user.id), eq(jobs.id, id)));
  if (!job) return NextResponse.redirect(new URL("/", url));

  const live = await checkLive(job);
  if (live === "encerrada") {
    await db
      .update(jobs)
      .set({ closedAt: new Date() })
      .where(and(eq(jobs.userId, user.id), eq(jobs.id, id)));
    return NextResponse.redirect(new URL(`/encerrada?id=${encodeURIComponent(id)}`, url));
  }
  if (live === "aberta" && job.closedAt) {
    await db
      .update(jobs)
      .set({ closedAt: null })
      .where(and(eq(jobs.userId, user.id), eq(jobs.id, id)));
  }
  // aberta (ou não deu para conferir agora): segue para o site oficial da vaga
  return NextResponse.redirect(job.applyUrl || job.url);
}
