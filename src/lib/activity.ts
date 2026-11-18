import "server-only";
import { and, eq, gt, sql } from "drizzle-orm";
import { db, events, type EventType } from "@/db";

export async function track(userId: string, type: EventType, meta?: Record<string, unknown>) {
  try {
    await db.insert(events).values({ userId, type, meta });
  } catch (e) {
    console.error("track", type, e); // registro de uso nunca derruba a ação principal
  }
}

// Limites por pessoa em 24h. Vazio = sem limite (decisão do dono do serviço em 11/11/2026).
// Para reativar, ex.: { busca: 12, upload_cv: 6, sugestao: 15, aprovar: 40 }
const DAILY: Partial<Record<EventType, number>> = {};

/** Retorna mensagem de erro se a pessoa passou do limite diário daquela ação. */
export async function overQuota(userId: string, type: EventType): Promise<string | null> {
  const max = DAILY[type];
  if (!max) return null;
  const [{ n }] = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(events)
    .where(and(eq(events.userId, userId), eq(events.type, type), gt(events.createdAt, sql`now() - interval '24 hours'`)));
  return n >= max ? `Limite diário atingido (${max}). Tente de novo amanhã.` : null;
}
