import { desc, eq, sql } from "drizzle-orm";
import { db, events, users, type EventType } from "@/db";
import { TopBar } from "@/components/topbar";
import { Badge, btn, Card, CardHeader, control, Icon } from "@/components/ui";
import { requireAdmin } from "@/lib/session";
import { adminDeleteUser, createResetLink } from "../auth-actions";
import { ConfirmButton, CopyButton } from "../components";

export const dynamic = "force-dynamic";

const TZ = "America/Sao_Paulo";

function ago(d: Date | null): string {
  if (!d) return "nunca";
  const min = Math.floor((Date.now() - d.getTime()) / 60000);
  if (min < 5) return "agora";
  if (min < 60) return `há ${min} min`;
  const h = Math.floor(min / 60);
  if (h < 24) return `há ${h} h`;
  const days = Math.floor(h / 24);
  return days === 1 ? "ontem" : `há ${days} dias`;
}

const LABEL: Record<EventType, string> = {
  cadastro: "criou a conta",
  login: "entrou",
  upload_cv: "enviou o currículo",
  remover_cv: "removeu o currículo",
  sugestao: "pediu sugestão da IA",
  salvar_preferencias: "salvou preferências",
  busca: "buscou vagas",
  aprovar: "aprovou uma vaga",
  descartar: "descartou uma vaga",
  enviada: "marcou candidatura enviada",
  candidatura_auto: "teve candidatura enviada pelo robô",
  candidatura_atencao: "teve candidatura parada (precisa de atenção)",
};

function detail(type: EventType, meta: Record<string, unknown> | null): string {
  if (!meta) return "";
  if (type === "busca") return ` (${meta.novas ?? 0} novas, ${meta.avaliadas ?? 0} avaliadas)`;
  if ((type === "aprovar" || type === "candidatura_auto" || type === "candidatura_atencao") && meta.vaga)
    return `: ${meta.vaga} · ${meta.empresa}`;
  return "";
}

export default async function AdminPage({ searchParams }: { searchParams: Promise<{ link?: string; para?: string }> }) {
  const admin = await requireAdmin();
  const { link, para } = await searchParams;

  // por pessoa: uso total e últimos 7 dias (colunas qualificadas por causa das subconsultas)
  const people = await db
    .select({
      id: users.id,
      name: users.name,
      email: users.email,
      role: users.role,
      createdAt: users.createdAt,
      lastSeenAt: users.lastSeenAt,
      temCv: sql<boolean>`exists(select 1 from profile p where p.user_id = "users"."id" and p.data is not null)`,
      vagas: sql<number>`(select count(*)::int from jobs j where j.user_id = "users"."id")`,
      aprovadas: sql<number>`(select count(*)::int from jobs j where j.user_id = "users"."id" and j.status in ('aprovada','enviada'))`,
      enviadas: sql<number>`(select count(*)::int from jobs j where j.user_id = "users"."id" and j.status = 'enviada')`,
      buscas7d: sql<number>`(select count(*)::int from events e where e.user_id = "users"."id" and e.type = 'busca' and e.created_at > now() - interval '7 days')`,
    })
    .from(users)
    .orderBy(sql`${users.lastSeenAt} desc nulls last`);

  const [stats] = await db.execute<{
    total: number;
    ativos7d: number;
    novos7d: number;
    buscasHoje: number;
    enviadas: number;
  }>(sql`select
      (select count(*)::int from users) as "total",
      (select count(*)::int from users where last_seen_at > now() - interval '7 days') as "ativos7d",
      (select count(*)::int from users where created_at > now() - interval '7 days') as "novos7d",
      (select count(*)::int from events where type = 'busca' and created_at > now() - interval '24 hours') as "buscasHoje",
      (select count(*)::int from jobs where status = 'enviada') as "enviadas"`).then((r) => r.rows);

  const feed = await db
    .select({ type: events.type, meta: events.meta, createdAt: events.createdAt, name: users.name })
    .from(events)
    .innerJoin(users, eq(users.id, events.userId))
    .orderBy(desc(events.createdAt))
    .limit(40);

  const kpis = [
    { label: "pessoas", value: stats.total },
    { label: "ativas em 7 dias", value: stats.ativos7d },
    { label: "novas em 7 dias", value: stats.novos7d },
    { label: "buscas em 24h", value: stats.buscasHoje },
    { label: "candidaturas enviadas", value: stats.enviadas },
  ];

  return (
    <>
      <TopBar active="admin" user={admin} />
      <main className="mx-auto max-w-5xl space-y-6 px-4 py-6 sm:px-6 sm:py-10">
        <div>
          <p className="font-mono text-xs uppercase tracking-[0.2em] text-muted">Admin</p>
          <h1 className="font-display text-3xl font-bold tracking-tight sm:text-4xl">Quem está usando</h1>
        </div>

        {link && (
          <Card className="border-ok/40 p-5 sm:p-6">
            <p className="mb-2 text-sm font-medium">
              Link criado{para ? ` (${para})` : ""}. Copie e envie para a pessoa.{" "}
              <span className="text-muted">Ele aparece só agora e vale 24 horas.</span>
            </p>
            <div className="flex flex-col gap-2 sm:flex-row">
              <input readOnly value={link} className={`${control} font-mono text-xs`} aria-label="Link gerado" />
              <CopyButton text={link} label="Copiar link" />
            </div>
          </Card>
        )}

        <ul className="grid grid-cols-2 gap-3 sm:grid-cols-5">
          {kpis.map((k) => (
            <li key={k.label} className="rounded-[var(--radius-lg)] border border-line bg-surface p-4">
              <p className="font-mono text-2xl font-semibold tabular-nums">{k.value}</p>
              <p className="text-xs text-muted">{k.label}</p>
            </li>
          ))}
        </ul>

        <div className="grid gap-6 lg:grid-cols-[minmax(0,7fr)_minmax(0,5fr)] lg:items-start">
          <Card>
            <CardHeader title="Pessoas" hint="Ordenadas pelo acesso mais recente." />
            <ul className="mt-3 divide-y divide-line border-t border-line">
              {people.map((p) => (
                <li key={p.id} className="space-y-3 px-5 py-4 sm:px-6">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="font-medium">
                        {p.name} {p.role === "admin" && <Badge tone="ink">admin</Badge>}{" "}
                        {!p.temCv && <Badge tone="warn">sem currículo</Badge>}
                      </p>
                      <p className="truncate text-sm text-muted">{p.email}</p>
                    </div>
                    <p className="text-right text-xs text-muted">
                      visto {ago(p.lastSeenAt)}
                      <br />
                      conta desde {p.createdAt.toLocaleDateString("pt-BR", { timeZone: TZ })}
                    </p>
                  </div>
                  <p className="font-mono text-xs text-muted">
                    {p.buscas7d} buscas/7d · {p.vagas} vagas · {p.aprovadas} aprovadas · {p.enviadas} enviadas
                  </p>
                  <div className="flex flex-wrap gap-2">
                    <form action={createResetLink.bind(null, p.id)}>
                      <button className={btn("secondary", "sm")}>
                        <Icon name="undo" />
                        Link de nova senha
                      </button>
                    </form>
                    {p.role !== "admin" && (
                      <ConfirmButton
                        action={adminDeleteUser.bind(null, p.id)}
                        message={`Remover ${p.name} e todos os dados dessa pessoa? Não dá para desfazer.`}
                        label="Remover"
                      />
                    )}
                  </div>
                </li>
              ))}
            </ul>
          </Card>

          <Card>
            <CardHeader title="Atividade recente" hint="Últimas 40 ações no app." />
            {feed.length === 0 ? (
              <p className="p-5 text-sm text-muted sm:p-6">Nenhuma atividade ainda.</p>
            ) : (
              <ol className="mt-3 divide-y divide-line border-t border-line">
                {feed.map((e, i) => (
                  <li key={i} className="flex gap-3 px-5 py-2.5 text-sm sm:px-6">
                    <time
                      className="w-14 shrink-0 font-mono text-xs leading-5 text-muted"
                      dateTime={e.createdAt.toISOString()}
                      title={e.createdAt.toLocaleString("pt-BR", { timeZone: TZ })}
                    >
                      {ago(e.createdAt).replace("há ", "")}
                    </time>
                    <span className="min-w-0">
                      <b className="font-medium">{e.name}</b> {LABEL[e.type] ?? e.type}
                      <span className="text-muted">{detail(e.type, e.meta)}</span>
                    </span>
                  </li>
                ))}
              </ol>
            )}
          </Card>
        </div>
      </main>
    </>
  );
}
