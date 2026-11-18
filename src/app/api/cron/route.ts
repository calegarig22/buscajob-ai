import { NextResponse } from "next/server";
import { isNotNull } from "drizzle-orm";
import { db, profile } from "@/db";
import { fetchAllJobs, scorePending } from "@/lib/pipeline";
import { track } from "@/lib/activity";

export const maxDuration = 300;

// Vercel Cron envia "Authorization: Bearer $CRON_SECRET". Roda para todos os usuários com preferências,
// parando antes do limite de tempo da função; quem ficar de fora é atendido na próxima execução.
export async function GET(req: Request) {
  if (req.headers.get("authorization") !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const deadline = Date.now() + 270_000;
  const people = await db.select({ userId: profile.userId }).from(profile).where(isNotNull(profile.preferences));
  // ordem aleatória: ninguém fica sempre por último
  people.sort(() => Math.random() - 0.5);
  const report: Record<string, unknown> = {};
  for (const { userId } of people) {
    if (Date.now() > deadline - 30_000) break;
    try {
      const f = await fetchAllJobs(userId);
      const s = await scorePending(userId, 2000, deadline);
      report[userId] = { inserted: f.inserted, scored: s.scored, closed: f.closed };
      await track(userId, "busca", { auto: true, novas: f.inserted, avaliadas: s.scored, encerradas: f.closed });
    } catch (e) {
      console.error("cron", userId, e);
      report[userId] = { error: true };
    }
  }
  return NextResponse.json({ users: people.length, report });
}
