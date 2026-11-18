import Link from "next/link";
import { and, desc, eq, isNull, sql } from "drizzle-orm";
import { db, events, jobs, profile, type Job, type JobStatus } from "@/db";
import { TopBar } from "@/components/topbar";
import { requireUser } from "@/lib/session";
import { Badge, btn, Card, Icon, Score, Stamp } from "@/components/ui";
import { CopyButton, ImproveLetterButton, JobActions, RunButton, WriteLetterButton } from "./components";
import { todayBR } from "@/lib/sources/gupy";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

const TABS: { key: JobStatus; label: string; empty: string }[] = [
  { key: "avaliada", label: "Fila", empty: "Nenhuma vaga esperando decisão. Clique em Buscar vagas agora ou aguarde a busca diária." },
  { key: "aprovada", label: "Aprovadas", empty: "Aprove vagas da fila: a carta de apresentação é escrita na hora." },
  { key: "enviada", label: "Enviadas", empty: "Depois de enviar pelo site da empresa, marque a vaga como enviada para acompanhar aqui." },
  { key: "rejeitada", label: "Descartadas", empty: "Vagas abaixo da nota mínima ou que você descartou aparecem aqui." },
];

const WORKPLACE: Record<string, string> = { presencial: "Presencial", hibrido: "Híbrido", remoto: "Remoto" };

function timeAgo(d: Date | null) {
  if (!d) return null;
  const days = Math.floor((Date.now() - d.getTime()) / 86400000);
  if (days <= 0) return "hoje";
  if (days === 1) return "ontem";
  if (days < 30) return `há ${days} dias`;
  return `há ${Math.floor(days / 30)} ${days < 60 ? "mês" : "meses"}`;
}

const PAGE = 50;
const BANDS = [
  { key: "todas", label: "Todas" },
  { key: "hoje", label: "Novas hoje" },
  { key: "forte", label: "Fortes (80+)" },
  { key: "possivel", label: "Possíveis (60–79)" },
] as const;

export default async function Home({
  searchParams,
}: {
  searchParams: Promise<{ aba?: string; nota?: string; mostrar?: string }>;
}) {
  const user = await requireUser();
  const { aba, nota, mostrar } = await searchParams;
  const tab = TABS.find((t) => t.key === aba) ?? TABS[0];
  const band = BANDS.find((b) => b.key === nota)?.key ?? "todas";
  const shown = Math.min(1000, Math.max(PAGE, Number(mostrar) || PAGE));
  const bandWhere =
    band === "hoje" ? sql`${jobs.fetchedAt} > now() - interval '24 hours'` : band === "forte" ? sql`${jobs.score} >= 80` : band === "possivel" ? sql`${jobs.score} >= 60 and ${jobs.score} < 80` : sql`true`;
  const qs = (o: Record<string, string | number>) =>
    "/?" + new URLSearchParams({ aba: tab.key, nota: band, mostrar: String(shown), ...Object.fromEntries(Object.entries(o).map(([k, v]) => [k, String(v)])) });

  const [me] = await db.select({ data: profile.data, prefs: profile.preferences }).from(profile).where(eq(profile.userId, user.id));
  const counts = await db.select({ status: jobs.status, n: sql<number>`count(*)::int` }).from(jobs)
    // fila e contadores só com vagas ativas; aprovadas/enviadas contam mesmo encerradas (histórico)
    .where(and(eq(jobs.userId, user.id), sql`(${jobs.closedAt} is null or ${jobs.status} in ('aprovada','enviada'))`))
    .groupBy(jobs.status);
  const count = (s: string) => counts.find((c) => c.status === s)?.n ?? 0;

  const list = await db
    .select()
    .from(jobs)
    .where(
      and(
        eq(jobs.userId, user.id),
        eq(jobs.status, tab.key),
        bandWhere,
        tab.key === "avaliada" || tab.key === "rejeitada" ? isNull(jobs.closedAt) : undefined,
      ),
    )
    .orderBy(tab.key === "enviada" ? desc(jobs.appliedAt) : sql`${jobs.score} desc nulls last, ${jobs.postedAt} desc nulls last`)
    .limit(shown + 1);
  const hasMore = list.length > shown;
  if (hasMore) list.pop();

  const ready = Boolean(me?.data && me?.prefs);
  const [auto] = await db
    .select({ at: events.createdAt, meta: events.meta })
    .from(events)
    .where(and(eq(events.userId, user.id), eq(events.type, "busca"), sql`${events.meta}->>'auto' = 'true'`))
    .orderBy(desc(events.createdAt))
    .limit(1);
  const pending = count("nova");

  return (
    <>
      <TopBar active="vagas" user={user} />
      <main className="mx-auto max-w-5xl space-y-6 px-4 py-6 sm:px-6 sm:py-10">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="font-mono text-xs uppercase tracking-[0.2em] text-muted">Triagem</p>
            <h1 className="font-display text-3xl font-bold tracking-tight sm:text-4xl">
              {count("avaliada") > 0 ? `${count("avaliada")} vagas esperando você` : "Sua fila de vagas"}
            </h1>
            <p className="mt-1 text-sm text-muted">
              Busca automática todo dia às 7h.{" "}
              {auto
                ? `Última: ${auto.at.toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo", day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })}, ${Number((auto.meta as { novas?: number })?.novas ?? 0)} novas.`
                : "Ainda não rodou para você."}
            </p>
            {pending > 0 && (
              <p className="mt-1 text-sm text-muted">+{pending} encontradas, aguardando nota na próxima busca.</p>
            )}
          </div>
          <RunButton disabled={!ready} hint="Envie o currículo e salve as preferências no Perfil primeiro." />
        </div>

        {!ready && (
          <Card className="flex flex-col gap-3 p-5 sm:flex-row sm:items-center sm:justify-between sm:p-6">
            <div>
              <h2 className="font-display text-lg font-semibold">Comece pelo perfil</h2>
              <p className="text-sm text-muted">
                {me?.data ? "Falta salvar o que você procura." : "Envie seu currículo: a IA monta o perfil e sugere a busca."}
              </p>
            </div>
            <Link href="/perfil" className={btn("primary", "md")}>
              Ir para o perfil
            </Link>
          </Card>
        )}

        <nav aria-label="Status das vagas" className="-mx-4 overflow-x-auto px-4 sm:mx-0 sm:px-0">
          <ul className="flex min-w-max gap-1 rounded-[var(--radius-lg)] border border-line bg-surface p-1">
            {TABS.map((t) => {
              const on = t.key === tab.key;
              return (
                <li key={t.key}>
                  <Link
                    href={`/?aba=${t.key}`}
                    aria-current={on ? "page" : undefined}
                    className={`inline-flex min-h-10 items-center gap-2 rounded-[var(--radius-md)] px-4 text-sm font-medium transition-colors ${
                      on ? "bg-ink text-ink-fg" : "text-muted hover:bg-surface-2 hover:text-fg"
                    }`}
                  >
                    {t.label}
                    <span className={`font-mono text-xs tabular-nums ${on ? "opacity-80" : ""}`}>{count(t.key)}</span>
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>

        {(tab.key === "avaliada" || tab.key === "aprovada") && (
          <div className="flex flex-wrap gap-2" role="group" aria-label="Filtrar por nota">
            {BANDS.map((b) => (
              <Link
                key={b.key}
                href={qs({ nota: b.key, mostrar: PAGE })}
                aria-current={band === b.key ? "true" : undefined}
                className={`inline-flex min-h-9 items-center rounded-full border px-3.5 text-sm transition-colors ${
                  band === b.key ? "border-ink bg-ink-soft text-ink" : "border-line-strong text-muted hover:bg-surface-2"
                }`}
              >
                {b.label}
              </Link>
            ))}
          </div>
        )}

        {list.length === 0 ? (
          <div className="rounded-[var(--radius-lg)] border-2 border-dashed border-line px-6 py-14 text-center">
            <p className="mx-auto max-w-md text-muted">{tab.empty}</p>
          </div>
        ) : (
          <>
            <ul className="space-y-4">
              {list.map((j, i) => (
                <JobCard key={j.id} job={j} index={i} />
              ))}
            </ul>
            {hasMore && (
              <div className="flex justify-center">
                <Link href={qs({ mostrar: shown + PAGE }) + "#mais"} scroll={false} className={btn("secondary", "md")}>
                  Mostrar mais vagas
                </Link>
              </div>
            )}
            <span id="mais" />
          </>
        )}
      </main>
    </>
  );
}

function JobCard({ job: j, index }: { job: Job; index: number }) {
  const posted = timeAgo(j.postedAt);
  return (
    <li className="animate-rise" style={{ animationDelay: `${Math.min(index, 8) * 40}ms` }}>
      <Card className="relative overflow-hidden">
        <Stamp status={j.status} />
        <div className="flex flex-col gap-4 p-5 sm:flex-row sm:gap-6 sm:p-6">
          <Score value={j.score} />
          <div className="min-w-0 flex-1 space-y-3">
            <div className="pr-24">
              <a
                href={`/ir?id=${encodeURIComponent(j.id)}`}
                target="_blank"
                rel="noreferrer"
                className="font-display text-lg font-semibold leading-snug tracking-tight decoration-ink/40 underline-offset-4 hover:underline"
              >
                {j.title}
              </a>
              <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-muted">
                <span className="inline-flex items-center gap-1">
                  <Icon name="building" className="size-3.5" />
                  {j.company}
                </span>
                {j.location && (
                  <span className="inline-flex items-center gap-1">
                    <Icon name="pin" className="size-3.5" />
                    {j.location}
                  </span>
                )}
                <Badge tone={j.workplace === "remoto" ? "ink" : "neutral"}>{WORKPLACE[j.workplace] ?? j.workplace}</Badge>
                {posted && <span className="text-xs">{posted}</span>}
                {j.closedAt && <Badge tone="danger">Vaga encerrada pela empresa</Badge>}
                {!j.closedAt && Date.now() - j.fetchedAt.getTime() < 24 * 3600 * 1000 && <Badge tone="ok">Nova hoje</Badge>}
                {!j.closedAt && j.deadline && (
                  <Badge tone={j.deadline <= todayBR() ? "warn" : "neutral"}>
                    {j.deadline <= todayBR() ? "Inscrições até hoje" : `Inscrições até ${j.deadline.slice(8, 10)}/${j.deadline.slice(5, 7)}`}
                  </Badge>
                )}
              </div>
            </div>

            {j.scoreReason && <p className="text-[0.95rem] leading-relaxed">{j.scoreReason}</p>}
            {j.gaps && (
              <p className="flex gap-2 rounded-[var(--radius-md)] bg-warn-soft px-3 py-2 text-sm text-warn">
                <Icon name="alert" className="mt-0.5 size-4 shrink-0" />
                <span>
                  <b className="font-semibold">Lacunas:</b> {j.gaps}
                </span>
              </p>
            )}

            {j.status === "aprovada" && (
              <div className="space-y-3 rounded-[var(--radius-md)] border border-line bg-surface-2 p-4">
                <p className="font-mono text-xs uppercase tracking-[0.18em] text-muted">Candidatura</p>
                <div className="flex flex-wrap gap-2">
                  <a href={`/ir?id=${encodeURIComponent(j.id)}`} target="_blank" rel="noreferrer" className={btn("primary", "sm")}>
                    <Icon name="external" />
                    Abrir vaga para se candidatar
                  </a>
                  <Link href={`/cv?id=${encodeURIComponent(j.id)}`} className={btn("secondary", "sm")}>
                    <Icon name="file" />
                    Currículo para esta vaga
                  </Link>
                </div>
                {j.coverLetter ? (
                  <>
                    <p className="whitespace-pre-wrap rounded-[var(--radius-md)] bg-surface p-3 text-[0.95rem] leading-relaxed">{j.coverLetter}</p>
                    {j.letterNote && <p className="text-xs text-muted">{j.letterNote}</p>}
                    <div className="flex flex-wrap gap-2">
                      <CopyButton text={j.coverLetter} />
                      <ImproveLetterButton id={j.id} />
                    </div>
                  </>
                ) : (
                  <div className="flex flex-wrap items-center gap-3">
                    <WriteLetterButton id={j.id} />
                    <span className="text-xs text-muted">Carta montada com fatos do seu currículo. Grátis e sem limite.</span>
                  </div>
                )}
              </div>
            )}

            {j.description && (
              <details className="group text-sm">
                <summary className="inline-flex min-h-9 cursor-pointer items-center gap-1 text-muted hover:text-fg">
                  <span className="group-open:hidden">Ver descrição da vaga</span>
                  <span className="hidden group-open:inline">Ocultar descrição</span>
                </summary>
                <p className="mt-2 max-h-80 overflow-y-auto whitespace-pre-wrap rounded-[var(--radius-md)] border border-line p-3 leading-relaxed text-muted">
                  {j.description.slice(0, 4000)}
                </p>
              </details>
            )}

            <JobActions id={j.id} status={j.status} />
          </div>
        </div>
      </Card>
    </li>
  );
}
