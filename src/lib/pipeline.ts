import { and, eq, inArray, isNull } from "drizzle-orm";
import { db, jobs, profile, sources, type Preferences } from "@/db";
import { fetchGreenhouse } from "./sources/greenhouse";
import { fetchLever } from "./sources/lever";
import { fetchAshby } from "./sources/ashby";
import { fetchSmartRecruiters, hydrateSmartRecruiters } from "./sources/smartrecruiters";
import { fetchAdzuna } from "./sources/adzuna";
import { fetchJooble } from "./sources/jooble";
import { fetchGoogleJobs } from "./sources/googlejobs";
import { fetchGupy, hydrateGupy, todayBR } from "./sources/gupy";
import { localScore } from "./score";
import { ensureSeeds } from "./seed";
import { candidateAreas, titleArea } from "./area";
import type { FetchedJob } from "./sources/types";
import { scoreJob } from "./ai";

const norm = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

const escapeRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/** Casa palavra/expressão inteira (evita "ii" casar dentro de outra palavra). */
function hasWord(text: string, word: string): boolean {
  const w = norm(word).trim();
  if (!w) return false;
  return new RegExp(`(^|[^a-z0-9])${escapeRe(w)}([^a-z0-9]|$)`).test(text);
}

// Termos de título que indicam nível acima do candidato, por senioridade do currículo.
const ACIMA_DE_JUNIOR = [
  "senior", "sr", "pleno", "pl", "especialista", "specialist", "expert", "lead", "lider", "tech lead",
  "staff", "principal", "head", "manager", "gerente", "coordenador", "coordinator", "director", "diretor",
  "supervisor", "supervisora", "coord", "coordenadora", "gestor", "gestora", "mid", "mid level", "mid-level", "intermediate", "intermediario",
  "ii", "iii", "iv", "2", "3",
];
const ACIMA_DE_PLENO = [
  "staff", "principal", "head", "manager", "gerente", "coordenador", "coordinator", "director", "diretor", "iii", "iv",
];

// Palavras genéricas de cargo: sozinhas não indicam área (ex.: "analista" casaria "Analista de Crédito").
const GENERIC = new Set([
  "analista", "analyst", "junior", "senior", "pleno", "tecnico", "technical", "assistente", "assistant",
  "auxiliar", "associate", "especialista", "specialist", "engineer", "engenheiro", "engenharia", "operations",
  "operacoes", "business", "negocios", "afirmativa", "vaga", "para", "banco", "talentos",
]);

// Equivalências PT↔EN para casar títulos nos dois idiomas.
const SYNONYMS: Record<string, string[]> = {
  automacao: ["automation"], automation: ["automacao"],
  seguranca: ["security"], security: ["seguranca"],
  suporte: ["support"], support: ["suporte"],
  sistemas: ["systems"], systems: ["sistemas"],
  governanca: ["governance"], governance: ["governanca"],
  processos: ["process", "processes"], dados: ["data"], data: ["dados"],
  desenvolvedor: ["developer"], developer: ["desenvolvedor"],
  infraestrutura: ["infrastructure"], redes: ["network"], riscos: ["risk"], risco: ["risk"],
};

export function seniorityBlocklist(senioridade: string | undefined): string[] {
  const s = norm(senioridade ?? "");
  if (/estagi|junior|trainee/.test(s)) return ACIMA_DE_JUNIOR;
  if (/pleno/.test(s)) return ACIMA_DE_PLENO;
  return [];
}

/** Filtro barato antes da IA: corta vagas claramente fora do perfil para economizar tokens. */
export function prefilter(
  job: FetchedJob,
  prefs: Preferences,
  senioridade?: string,
  areas: ReturnType<typeof candidateAreas> = [],
): boolean {
  const title = norm(job.title);
  const all = norm(`${job.title} ${job.location} ${job.workplace}`);

  if (prefs.palavrasExcluir.some((w) => hasWord(title, w))) return false;
  if (seniorityBlocklist(senioridade).some((w) => hasWord(title, w))) return false;

  if (prefs.cargos.length) {
    const tokens = prefs.cargos
      .flatMap((c) => norm(c).split(/[^a-z0-9]+/))
      .filter((t) => t.length > 2 && !GENERIC.has(t))
      .flatMap((t) => [t, ...(SYNONYMS[t] ?? [])]);
    // entra se bater com os cargos OU se o título for de uma área em que o currículo tem evidência
    if (!tokens.some((t) => hasWord(title, t)) && !titleArea(job.title, areas)) return false;
  }

  if (prefs.modelos.length && !prefs.modelos.includes(job.workplace as Preferences["modelos"][number])) return false;

  if (prefs.cidades.length && job.workplace !== "remoto") {
    if (!prefs.cidades.some((c) => all.includes(norm(c).split("/")[0].trim()))) return false;
  }
  return true;
}

function fetchSource(s: typeof sources.$inferSelect): Promise<FetchedJob[]> {
  switch (s.kind) {
    case "greenhouse":
      return fetchGreenhouse(s.slug, s.name);
    case "lever":
      return fetchLever(s.slug, s.name);
    case "ashby":
      return fetchAshby(s.slug, s.name);
    case "smartrecruiters":
      return fetchSmartRecruiters(s.slug, s.name);
    case "gupy":
      return fetchGupy(s.slug, s.name);
  }
}

/** Chave de duplicidade: mesma empresa + mesmo título = mesma vaga, venha de onde vier. */
export function dedupKey(j: Pick<FetchedJob, "company" | "title">) {
  const n = (x: string) => norm(x).replace(/[^a-z0-9]+/g, " ").trim();
  return `${n(j.company)}|${n(j.title)}`.slice(0, 300);
}

/**
 * Vagas ativas: se o site da empresa respondeu e a vaga não está mais na lista, ela foi encerrada.
 * Se voltar a aparecer, reabre. Fontes que falharam nesta busca não encerram nada.
 */
async function syncActive(userId: string, results: { s: typeof sources.$inferSelect; ok: boolean; jobs: FetchedJob[] }[]) {
  const seen = new Set(results.flatMap((r) => r.jobs.map((j) => String(j.id))));
  const okSources = new Set(results.filter((r) => r.ok).map((r) => `${r.s.kind}|${r.s.name}`));
  const mine = await db
    .select({ id: jobs.id, source: jobs.source, company: jobs.company, closedAt: jobs.closedAt, deadline: jobs.deadline })
    .from(jobs)
    .where(eq(jobs.userId, userId));
  const today = todayBR();
  const toClose = mine
    .filter(
      (j) =>
        !j.closedAt &&
        ((okSources.has(`${j.source}|${j.company}`) && !seen.has(j.id)) || (j.deadline !== null && j.deadline < today)),
    )
    .map((j) => j.id);
  const toReopen = mine.filter((j) => j.closedAt && seen.has(j.id) && !(j.deadline !== null && j.deadline < today)).map((j) => j.id);
  for (let i = 0; i < toClose.length; i += 500)
    await db
      .update(jobs)
      .set({ closedAt: new Date() })
      .where(and(eq(jobs.userId, userId), inArray(jobs.id, toClose.slice(i, i + 500))));
  for (let i = 0; i < toReopen.length; i += 500)
    await db
      .update(jobs)
      .set({ closedAt: null })
      .where(and(eq(jobs.userId, userId), inArray(jobs.id, toReopen.slice(i, i + 500))));
  return toClose.length;
}

/** Executa fn em paralelo com no máximo `limit` ao mesmo tempo. */
async function mapLimit<T, R>(items: T[], limit: number, fn: (x: T) => Promise<R>): Promise<R[]> {
  const out: R[] = new Array(items.length);
  let i = 0;
  await Promise.all(
    Array.from({ length: Math.min(limit, items.length) }, async () => {
      while (i < items.length) {
        const k = i++;
        out[k] = await fn(items[k]);
      }
    }),
  );
  return out;
}

// Vagas novas por busca (cada uma da Gupy custa 1 acesso à página da vaga)
const MAX_NOVAS_POR_BUSCA = 400;

// Quantas consultas por busca em cada agregador (controla cota das APIs pagas/limitadas)
const MAX_CARGOS_AGREGADOR = 8;
const MAX_CIDADES_AGREGADOR = 3;

export async function fetchAllJobs(userId: string) {
  await ensureSeeds(userId); // empresas novas da lista entram para todos
  const [me] = await db.select().from(profile).where(eq(profile.userId, userId));
  const prefs = me?.preferences;
  if (!prefs)
    return { inserted: 0, closed: 0, scanned: 0, companies: 0, matched: 0, errors: ["Configure suas preferências em /perfil primeiro."] };

  const enabled = await db
    .select()
    .from(sources)
    .where(and(eq(sources.userId, userId), eq(sources.enabled, true)));
  const areas = me?.data ? candidateAreas(me.data) : [];
  const errors: string[] = [];
  const safe = (label: string, p: Promise<FetchedJob[]>) =>
    p.catch((e) => {
      console.error("fonte falhou", label, e);
      errors.push(label);
      return [] as FetchedJob[];
    });

  // 1) sites de carreira das empresas monitoradas (guardamos quais responderam, para conferir vagas encerradas)
  const atsResults = await Promise.all(
    enabled.map(async (s) => {
      try {
        return { s, ok: true, jobs: await fetchSource(s) };
      } catch (e) {
        console.error("fonte falhou", s.name, e);
        errors.push(s.name);
        return { s, ok: false, jobs: [] as FetchedJob[] };
      }
    }),
  );
  const tasks: Promise<FetchedJob[]>[] = [Promise.resolve(atsResults.flatMap((r) => r.jobs))];

  // 2) agregadores: uma consulta por cargo (e por cidade), em português, no Brasil
  const cargos = prefs.cargos.slice(0, MAX_CARGOS_AGREGADOR);
  const cidades = prefs.cidades.length ? prefs.cidades.slice(0, MAX_CIDADES_AGREGADOR) : [""];
  for (const cargo of cargos) {
    tasks.push(safe("Google Vagas", fetchGoogleJobs(cargo, cidades[0])));
    for (const cidade of cidades) {
      tasks.push(safe("Adzuna", fetchAdzuna(cargo, cidade)));
      tasks.push(safe("Jooble", fetchJooble(cargo, cidade || "Brasil")));
    }
  }

  const seen = new Set<string>();
  const matched = (await Promise.all(tasks))
    .flat()
    .filter((j) => j.title && j.url && prefilter(j, prefs, me?.data?.senioridade, areas))
    .filter((j) => {
      const k = dedupKey(j);
      if (seen.has(k)) return false;
      seen.add(k);
      return true;
    });

  // Gupy e SmartRecruiters não mandam descrição na lista: busca só das que passaram no filtro e ainda não
  // estão no banco, com no máximo 8 páginas ao mesmo tempo
  const known = new Set(
    (
      await db
        .select({ k: jobs.dedupKey })
        .from(jobs)
        .where(eq(jobs.userId, userId))
    ).map((r) => r.k),
  );
  const fresh = matched.filter((j) => !known.has(dedupKey(j))).slice(0, MAX_NOVAS_POR_BUSCA);
  const srSlug = new Map(enabled.filter((s) => s.kind === "smartrecruiters").map((s) => [s.name, s.slug]));
  const ready = await mapLimit(fresh, 8, (j) =>
    j.source === "gupy"
      ? hydrateGupy(j)
      : j.source === "smartrecruiters" && srSlug.has(j.company)
        ? hydrateSmartRecruiters(j, srSlug.get(j.company)!)
        : Promise.resolve(j),
  );

  // só vagas ativas entram (ex.: Gupy com inscrições encerradas fica de fora)
  const rows = ready
    .filter((j) => !j.inactive)
    .map((j) => {
      const { inactive, ...row } = j;
      void inactive;
      return { ...row, userId, dedupKey: dedupKey(j) };
    });
  let inserted = 0;
  for (let i = 0; i < rows.length; i += 100) {
    const r = await db
      .insert(jobs)
      .values(rows.slice(i, i + 100))
      .onConflictDoNothing()
      .returning({ id: jobs.id });
    inserted += r.length;
  }
  const closed = await syncActive(userId, atsResults);
  return {
    inserted,
    closed,
    scanned: atsResults.reduce((n, r) => n + r.jobs.length, 0),
    companies: atsResults.filter((r) => r.ok).length,
    matched: matched.length,
    errors: [...new Set(errors)].map((e) => `${e} indisponível agora`),
  };
}

/**
 * Dá nota às vagas novas. Padrão: nota local gratuita (instantânea, sem limite).
 * Com AI_SCORING=on, as melhores pela nota local são reavaliadas pelo Gemini (requer plano pago).
 */
export async function scorePending(userId: string, limit = 2000, deadline = Infinity) {
  const [me] = await db.select().from(profile).where(eq(profile.userId, userId));
  if (!me?.data || !me.preferences) return { scored: 0 };
  const pending = await db
    .select()
    .from(jobs)
    .where(and(eq(jobs.userId, userId), eq(jobs.status, "nova"), isNull(jobs.score), isNull(jobs.closedAt)))
    .limit(limit);

  const scoredJobs = pending.map((job) => ({ job, s: localScore(job, me.data!, me.preferences!) }));
  const aiOn = process.env.AI_SCORING === "on";
  if (aiOn) {
    const top = scoredJobs.filter((x) => x.s.score >= me.preferences!.scoreMinimo - 10).sort((a, b) => b.s.score - a.s.score).slice(0, 30);
    for (let i = 0; i < top.length && Date.now() < deadline; i += 6) {
      await Promise.all(
        top.slice(i, i + 6).map(async (x) => {
          try {
            const r = await scoreJob(me.data!, me.preferences!, x.job);
            x.s = { score: r.score, motivo: r.motivo, lacunas: r.lacunas };
          } catch (e) {
            console.error("score IA falhou; mantém nota local", x.job.id, e);
          }
        }),
      );
    }
  }

  for (let i = 0; i < scoredJobs.length; i += 50) {
    await Promise.all(
      scoredJobs.slice(i, i + 50).map(({ job, s }) =>
        db
          .update(jobs)
          .set({
            score: s.score,
            scoreReason: s.motivo,
            gaps: s.lacunas,
            status: s.score < me.preferences!.scoreMinimo ? "rejeitada" : "avaliada",
          })
          .where(and(eq(jobs.userId, userId), eq(jobs.id, job.id))),
      ),
    );
  }
  return { scored: scoredJobs.length };
}

/** Amostra de títulos de vagas abertas nas fontes ativas (sem descrição: leve). */
export async function marketTitles(userId: string, max = 400): Promise<string[]> {
  const enabled = await db
    .select()
    .from(sources)
    .where(and(eq(sources.userId, userId), eq(sources.enabled, true)));
  const lists = await Promise.all(
    enabled.map(async (s) => {
      try {
        const list = s.kind === "greenhouse" ? await fetchGreenhouse(s.slug, s.name, false) : await fetchSource(s);
        return list.map((j) => j.title);
      } catch {
        return [];
      }
    }),
  );
  const uniq = [...new Set(lists.flat().map((t) => t.trim()))];
  // embaralha para a amostra não ficar enviesada para a primeira empresa
  for (let i = uniq.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [uniq[i], uniq[j]] = [uniq[j], uniq[i]];
  }
  return uniq.slice(0, max);
}
