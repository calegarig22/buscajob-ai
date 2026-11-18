"use server";

import { and, eq, isNull, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { db, jobs, profile, sources, type Preferences, type SourceKind } from "@/db";
import { parseResume, suggestPreferences, writeCoverLetter } from "@/lib/ai";
import { fetchAllJobs, marketTitles, scorePending } from "@/lib/pipeline";
import { ensureSeeds } from "@/lib/seed";
import { localCoverLetter } from "@/lib/match";
import { parseResumeLocal } from "@/lib/cv-parse";
import { suggestLocal } from "@/lib/suggest";
import { checkTruth, describeIssues, stripInventions } from "@/lib/truth";
import { endSession, requireUser } from "@/lib/session";
import { overQuota, track } from "@/lib/activity";

const lines = (v: FormDataEntryValue | null) =>
  String(v ?? "")
    .split(/[\n,]/)
    .map((s) => s.trim())
    .filter(Boolean);

function friendlyError(e: unknown): string {
  const msg = e instanceof Error ? e.message : String(e);
  if (/API key not valid|API_KEY_INVALID/i.test(msg))
    return "A IA está indisponível (chave inválida). Avise o administrador.";
  if (/429|RESOURCE_EXHAUSTED|quota/i.test(msg))
    return "Limite da IA atingido. Tente de novo em alguns minutos.";
  return "Falha na IA. Tente de novo.";
}

async function upsertProfile(
  userId: string,
  set: Partial<typeof profile.$inferInsert>,
) {
  await db
    .insert(profile)
    .values({ userId, ...set, updatedAt: new Date() })
    .onConflictDoUpdate({
      target: profile.userId,
      set: { ...set, updatedAt: new Date() },
    });
}

export async function uploadResume(formData: FormData) {
  const user = await requireUser();
  const file = formData.get("resume") as File | null;
  let erro = "";
  let sugerido = false;
  let lidoLocal = false;
  if (!file || file.size === 0) erro = "Selecione um PDF.";
  else if (file.type && file.type !== "application/pdf")
    erro = "Envie o currículo em PDF.";
  else if (file.size > 4 * 1024 * 1024) erro = "PDF muito grande (máx. 4 MB).";
  else erro = (await overQuota(user.id, "upload_cv")) ?? "";

  if (file && !erro) {
    try {
      const b64 = Buffer.from(await file.arrayBuffer()).toString("base64");
      // IA primeiro (melhor leitura); sem IA disponível, leitura local grátis e a pessoa confere os campos
      let data;
      try {
        data = await parseResume(b64);
      } catch (e) {
        console.warn("parseResume IA indisponível, usando leitura local", e);
        data = await parseResumeLocal(b64);
        lidoLocal = true;
      }
      await upsertProfile(user.id, { resumePdfBase64: b64, data });
      await track(user.id, "upload_cv", { senioridade: data.senioridade });
      const [me] = await db
        .select()
        .from(profile)
        .where(eq(profile.userId, user.id));
      if (!me?.preferences) {
        await ensureSeeds(user.id);
        const titles = await marketTitles(user.id, 2000);
        const prefs = await suggestPreferences(data, titles.slice(0, 400)).catch(() => suggestLocal(data, titles));
        await upsertProfile(user.id, { preferences: prefs });
        sugerido = true;
      }
    } catch (e) {
      console.error("uploadResume", e);
      erro = friendlyError(e);
    }
  }
  revalidatePath("/perfil");
  redirect(
    erro
      ? `/perfil?erro=${encodeURIComponent(erro)}`
      : `/perfil?${new URLSearchParams({ ...(sugerido ? { sugerido: "1" } : {}), ...(lidoLocal ? { lido: "local" } : {}) })}`,
  );
}

/** Preenche as preferências com IA (currículo + títulos de vagas abertas). */
export async function suggestPrefsAction() {
  const user = await requireUser();
  const [me] = await db
    .select()
    .from(profile)
    .where(eq(profile.userId, user.id));
  if (!me?.data)
    redirect(
      `/perfil?erro=${encodeURIComponent("Envie o currículo antes de pedir sugestões.")}`,
    );
  let erro = (await overQuota(user.id, "sugestao")) ?? "";
  if (!erro) {
    try {
      await ensureSeeds(user.id);
      const titles = await marketTitles(user.id, 2000);
      // IA se houver limite; senão, sugestão local grátis a partir do currículo e das vagas abertas
      const prefs = await suggestPreferences(me.data, titles.slice(0, 400)).catch(() => suggestLocal(me.data!, titles));
      await upsertProfile(user.id, { preferences: prefs });
      await track(user.id, "sugestao");
    } catch (e) {
      console.error("suggestPrefs", e);
      erro = friendlyError(e);
    }
  }
  revalidatePath("/perfil");
  redirect(
    erro ? `/perfil?erro=${encodeURIComponent(erro)}` : "/perfil?sugerido=1",
  );
}

export async function savePreferences(formData: FormData) {
  const user = await requireUser();
  const prefs: Preferences = {
    cargos: lines(formData.get("cargos")).slice(0, 30),
    cidades: lines(formData.get("cidades")).slice(0, 20),
    modelos: formData
      .getAll("modelos")
      .map(String)
      .filter((m) =>
        ["presencial", "hibrido", "remoto"].includes(m),
      ) as Preferences["modelos"],
    palavrasExcluir: lines(formData.get("palavrasExcluir")).slice(0, 60),
    scoreMinimo: Math.max(
      0,
      Math.min(100, Number(formData.get("scoreMinimo") ?? 60) || 0),
    ),
    observacoes: String(formData.get("observacoes") ?? "").slice(0, 2000),
  };
  await upsertProfile(user.id, { preferences: prefs });
  await track(user.id, "salvar_preferencias");
  revalidatePath("/perfil");
}

export async function addSource(formData: FormData) {
  const user = await requireUser();
  const kind = String(formData.get("kind"));
  if (!["greenhouse", "lever", "ashby", "smartrecruiters", "gupy"].includes(kind)) return;
  const slug = String(formData.get("slug")).trim().toLowerCase();
  if (!/^[a-z0-9-]{1,80}$/.test(slug)) return;
  const name = String(formData.get("name")).trim().slice(0, 80) || slug;
  await db
    .insert(sources)
    .values({ userId: user.id, kind: kind as SourceKind, slug, name })
    .onConflictDoNothing();
  revalidatePath("/perfil");
}

export async function toggleSource(id: number, enabled: boolean) {
  const user = await requireUser();
  await db
    .update(sources)
    .set({ enabled })
    .where(and(eq(sources.id, id), eq(sources.userId, user.id)));
  revalidatePath("/perfil");
}

const RUN_COOLDOWN_MS = 60 * 1000; // só evita busca duplicada por clique duplo

export type RunResult = {
  inserted: number;
  scored: number;
  errors?: string[];
  closed?: number;
  scanned?: number;
  companies?: number;
  matched?: number;
  fila?: number;
};

export async function runNow(): Promise<RunResult> {
  const user = await requireUser();
  const [me] = await db.select({ lastRunAt: profile.lastRunAt }).from(profile).where(eq(profile.userId, user.id));
  const wait = me?.lastRunAt ? RUN_COOLDOWN_MS - (Date.now() - me.lastRunAt.getTime()) : 0;
  if (wait > 0) return { inserted: 0, scored: 0, errors: ["Aguarde 1 minuto para buscar de novo."] };
  const quota = await overQuota(user.id, "busca");
  if (quota) return { inserted: 0, scored: 0, errors: [quota] };
  await upsertProfile(user.id, { lastRunAt: new Date() });
  const fetched = await fetchAllJobs(user.id);
  const scored = await scorePending(user.id, 2000, Date.now() + 200_000);
  await track(user.id, "busca", { novas: fetched.inserted, avaliadas: scored.scored });
  const [{ n: fila }] = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(jobs)
    .where(and(eq(jobs.userId, user.id), eq(jobs.status, "avaliada"), isNull(jobs.closedAt)));
  revalidatePath("/");
  return { ...fetched, ...scored, fila };
}

export async function approveJob(id: string) {
  const user = await requireUser();
  const [job] = await db
    .update(jobs)
    .set({ status: "aprovada" })
    .where(and(eq(jobs.userId, user.id), eq(jobs.id, id)))
    .returning({ title: jobs.title, company: jobs.company });
  if (!job) throw new Error("Vaga não encontrada.");
  await track(user.id, "aprovar", { vaga: job.title, empresa: job.company });
  revalidatePath("/");
}

async function loadJobAndProfile(userId: string, id: string) {
  const [me] = await db.select().from(profile).where(eq(profile.userId, userId));
  const [job] = await db
    .select()
    .from(jobs)
    .where(and(eq(jobs.userId, userId), eq(jobs.id, id)));
  if (!me?.data || !me.preferences || !job) throw new Error("Perfil ou vaga não encontrados.");
  return { me: me as typeof me & { data: NonNullable<typeof me.data>; preferences: NonNullable<typeof me.preferences> }, job };
}

/** Carta montada pelo app só com fatos do currículo: grátis, instantânea e sem limite. */
export async function writeLetter(id: string) {
  const user = await requireUser();
  const { me, job } = await loadJobAndProfile(user.id, id);
  const coverLetter = localCoverLetter(me.data, job);
  await db
    .update(jobs)
    .set({ coverLetter, letterNote: "Montada a partir do seu currículo, sem IA." })
    .where(and(eq(jobs.userId, user.id), eq(jobs.id, id)));
  revalidatePath("/");
}

/**
 * Versão escrita pela IA (opcional; depende do limite grátis do Gemini), sempre passando pela trava anti-invenção:
 * reprovou → refaz 1 vez contando o problema; ainda reprovou → remove as frases inventadas e avisa.
 */
export async function improveLetterAI(id: string) {
  const user = await requireUser();
  const { me, job } = await loadJobAndProfile(user.id, id);
  const allowed = [job.title, job.description];
  const quoted = [job.title, job.company];
  let note = "Escrita pela IA e conferida pela trava anti-invenção.";
  let letter: string;
  try {
    letter = await writeCoverLetter(me.data, me.preferences, job);
    let issues = checkTruth(letter, me.data, allowed, quoted);
    if (issues.length) {
      letter = await writeCoverLetter(me.data, me.preferences, job, issues.map((i) => `"${i.term}" em: ${i.sentence}`).join("\n"));
      issues = checkTruth(letter, me.data, allowed, quoted);
    }
    const invented = issues.filter((i) => i.kind !== "cliche");
    if (invented.length) {
      letter = stripInventions(letter, invented);
      note = `A trava anti-invenção removeu frases: a IA ${describeIssues(invented)}.`;
    }
  } catch (e) {
    throw new Error(`${friendlyError(e)} Use "Gerar carta" (sem IA), que funciona sempre.`);
  }
  await db
    .update(jobs)
    .set({ coverLetter: letter, letterNote: note })
    .where(and(eq(jobs.userId, user.id), eq(jobs.id, id)));
  revalidatePath("/");
}

export async function setJobStatus(
  id: string,
  status: "rejeitada" | "enviada" | "avaliada",
) {
  const user = await requireUser();
  await db
    .update(jobs)
    .set({ status, appliedAt: status === "enviada" ? new Date() : null })
    .where(and(eq(jobs.userId, user.id), eq(jobs.id, id)));
  if (status === "enviada") await track(user.id, "enviada", { vaga: id });
  if (status === "rejeitada") await track(user.id, "descartar");
  revalidatePath("/");
}

/** Apaga o currículo (PDF e perfil extraído). Preferências e vagas são mantidas. */
export async function removeResume() {
  const user = await requireUser();
  await db
    .update(profile)
    .set({
      resumePdfBase64: null,
      resumeText: null,
      data: null,
      updatedAt: new Date(),
    })
    .where(eq(profile.userId, user.id));
  await track(user.id, "remover_cv");
  revalidatePath("/perfil");
}

export async function logout() {
  await endSession();
  redirect("/login");
}

/** A pessoa confere/corrige o perfil extraído do currículo (é a base de nota, currículo adaptado e carta). */
export async function saveProfileData(formData: FormData) {
  const user = await requireUser();
  const f = (k: string, max = 300) => String(formData.get(k) ?? "").trim().slice(0, max);
  const list = (k: string) =>
    f(k, 5000)
      .split(/\n|,|•|;/)
      .map((x) => x.trim())
      .filter(Boolean)
      .slice(0, 80);
  const experiencias = Array.from({ length: 10 }, (_, i) => ({
    cargo: f(`exp_cargo_${i}`, 120),
    empresa: f(`exp_empresa_${i}`, 120),
    periodo: f(`exp_periodo_${i}`, 60),
    descricao: f(`exp_descricao_${i}`, 3000),
  })).filter((e) => e.cargo || e.empresa || e.descricao);
  const formacao = Array.from({ length: 6 }, (_, i) => ({
    curso: f(`form_curso_${i}`, 150),
    instituicao: f(`form_inst_${i}`, 150),
    periodo: f(`form_periodo_${i}`, 60),
  })).filter((x) => x.curso || x.instituicao);
  const data = {
    nome: f("nome", 120),
    email: f("email", 200),
    telefone: f("telefone", 40),
    cidade: f("cidade", 100),
    linkedin: f("linkedin", 200),
    senioridade: f("senioridade", 30) || "júnior",
    resumo: f("resumo", 3000),
    habilidades: list("habilidades"),
    experiencias,
    formacao,
    idiomas: list("idiomas"),
  };
  await upsertProfile(user.id, { data });
  revalidatePath("/perfil");
  redirect("/perfil?perfil=1");
}
