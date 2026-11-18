import { eq } from "drizzle-orm";
import { db, profile, sources } from "@/db";
import { ensureSeeds } from "@/lib/seed";
import { requireUser } from "@/lib/session";
import { TopBar } from "@/components/topbar";
import { Alert, Badge, btn, Card, CardHeader, control, Field, Icon } from "@/components/ui";
import { addSource, savePreferences, suggestPrefsAction, toggleSource, uploadResume } from "../actions";
import { FileDrop, RemoveResumeButton, SubmitButton } from "../components";
import { ProfileEditor } from "@/components/profile-editor";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

const KINDS = [
  { v: "gupy", label: "Gupy" },
  { v: "greenhouse", label: "Greenhouse" },
  { v: "lever", label: "Lever" },
  { v: "ashby", label: "Ashby" },
  { v: "smartrecruiters", label: "SmartRecruiters" },
] as const;

const MODELOS = [
  { v: "presencial", label: "Presencial" },
  { v: "hibrido", label: "Híbrido" },
  { v: "remoto", label: "Remoto" },
] as const;

export default async function PerfilPage({ searchParams }: { searchParams: Promise<{ erro?: string; sugerido?: string; lido?: string; perfil?: string }> }) {
  const user = await requireUser();
  const { erro, sugerido, lido, perfil } = await searchParams;
  await ensureSeeds(user.id);
  const [me] = await db.select().from(profile).where(eq(profile.userId, user.id));
  const srcs = await db.select().from(sources).where(eq(sources.userId, user.id)).orderBy(sources.name);
  const p = me?.preferences;
  const d = me?.data;

  return (
    <>
      <TopBar active="perfil" user={user} />
      <main className="mx-auto max-w-5xl space-y-6 px-4 py-6 sm:px-6 sm:py-10">
        <div>
          <p className="font-mono text-xs uppercase tracking-[0.2em] text-muted">Perfil</p>
          <h1 className="font-display text-3xl font-bold tracking-tight sm:text-4xl">Quem você é e o que procura</h1>
        </div>

        {erro && <Alert tone="danger">{erro}</Alert>}

        <div className="grid gap-6 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] lg:items-start">
          {/* ─── Currículo ─── */}
          <Card className="lg:sticky lg:top-20">
            <CardHeader title="Currículo" hint="O app lê o PDF e monta seu perfil. Confira e corrija abaixo." />
            <div className="space-y-5 p-5 sm:p-6">
              <form action={uploadResume} className="space-y-3">
                <FileDrop hasResume={Boolean(d)} />
                <SubmitButton icon="upload" pendingText="Analisando currículo… (até 30s)">
                  {d ? "Substituir e analisar" : "Enviar e analisar"}
                </SubmitButton>
              </form>

              {d ? (
                <div className="space-y-4 border-t border-line pt-5">
                  <div>
                    <p className="font-display text-xl font-semibold tracking-tight">{d.nome}</p>
                    <div className="mt-1.5 flex flex-wrap gap-1.5">
                      <Badge tone="ink">{d.senioridade}</Badge>
                      {d.cidade && <Badge>{d.cidade}</Badge>}
                    </div>
                  </div>
                  <p className="text-sm leading-relaxed text-muted">{d.resumo}</p>
                  {d.habilidades.length > 0 && (
                    <ul className="flex flex-wrap gap-1.5" aria-label="Habilidades">
                      {d.habilidades.map((h) => (
                        <li key={h} className="rounded-[var(--radius-sm)] border border-line bg-surface-2 px-2 py-0.5 text-xs">
                          {h}
                        </li>
                      ))}
                    </ul>
                  )}
                  {lido === "local" && (
                    <p role="status" className="rounded-[var(--radius-md)] bg-warn-soft px-3 py-2 text-sm text-warn">
                      Lemos seu currículo sem IA (grátis). Confira os dados abaixo e corrija o que estiver errado.
                    </p>
                  )}
                  {perfil && <p role="status" className="rounded-[var(--radius-md)] bg-ok-soft px-3 py-2 text-sm text-ok">Dados salvos.</p>}
                  <ProfileEditor p={d} open={lido === "local"} />
                  <div className="flex flex-wrap gap-2">
                    {me?.resumePdfBase64 && (
                      <a href="/api/curriculo" target="_blank" className={btn("secondary", "sm")}>
                        <Icon name="file" />
                        Ver PDF
                      </a>
                    )}
                    <RemoveResumeButton />
                  </div>
                </div>
              ) : (
                <p className="text-sm text-muted">Nenhum currículo enviado ainda.</p>
              )}
            </div>
          </Card>

          <div className="space-y-6">
            {/* ─── Preferências ─── */}
            <Card>
              <CardHeader
                title="O que você procura"
                hint="Define quais vagas entram na fila."
                action={
                  d && (
                    <form action={suggestPrefsAction}>
                      <SubmitButton variant="secondary" icon="sparkles" pendingText="Lendo currículo e vagas abertas…">
                        Sugerir minha busca
                      </SubmitButton>
                    </form>
                  )
                }
              />
              <div className="p-5 sm:p-6">
                {sugerido && (
                  <div className="mb-5">
                    <Alert tone="ok">
                      Sugestão feita com base no seu currículo e nas vagas abertas agora. Revise, ajuste e salve.
                    </Alert>
                  </div>
                )}
                {/* key força remontar o form para refletir valores novos após sugestão */}
                <form key={String(me?.updatedAt?.getTime())} action={savePreferences} className="space-y-5">
                  <div className="grid gap-5 sm:grid-cols-2">
                    <Field htmlFor="cargos" label="Cargos que você quer" hint="Um por linha. Vale português e inglês.">
                      <textarea id="cargos" name="cargos" rows={7} defaultValue={p?.cargos.join("\n")} className={control} placeholder={"Analista de Segurança da Informação Júnior\nSecurity Analyst"} />
                    </Field>
                    <Field htmlFor="cidades" label="Cidades" hint="Uma por linha. Vagas remotas ignoram este filtro.">
                      <textarea id="cidades" name="cidades" rows={7} defaultValue={p?.cidades.join("\n")} className={control} placeholder="São Paulo" />
                    </Field>
                  </div>

                  <fieldset className="space-y-2">
                    <legend className="text-sm font-medium">Modelo de trabalho</legend>
                    <div className="flex flex-wrap gap-2">
                      {MODELOS.map((m) => (
                        <label key={m.v} className="relative">
                          <input
                            type="checkbox"
                            name="modelos"
                            value={m.v}
                            defaultChecked={p ? p.modelos.includes(m.v) : m.v !== "remoto"}
                            className="peer sr-only"
                          />
                          <span className="inline-flex min-h-11 cursor-pointer items-center gap-2 rounded-full border border-line-strong px-4 text-sm font-medium text-muted transition-colors hover:bg-surface-2 peer-checked:border-ink peer-checked:bg-ink-soft peer-checked:text-ink peer-focus-visible:outline-2 peer-focus-visible:outline-ring">
                            {m.label}
                          </span>
                        </label>
                      ))}
                    </div>
                  </fieldset>

                  <div className="rounded-[var(--radius-md)] border border-danger/25 bg-danger-soft/60 p-4">
                    <Field
                      htmlFor="palavrasExcluir"
                      label={<span className="text-danger">Ignorar vagas com estas palavras no título</span>}
                      hint={
                        <>
                          Separe por vírgula. Vagas com qualquer uma delas são descartadas, não buscadas.
                          {d?.senioridade && ` Níveis acima de "${d.senioridade}" já são descartados automaticamente.`}
                        </>
                      }
                    >
                      <textarea id="palavrasExcluir" name="palavrasExcluir" rows={3} defaultValue={p?.palavrasExcluir.join(", ")} className={control} placeholder="estágio, comercial" />
                    </Field>
                  </div>

                  <div className="grid gap-5 sm:grid-cols-[10rem_minmax(0,1fr)]">
                    <Field htmlFor="scoreMinimo" label="Nota mínima" hint="0 a 100. Abaixo disso vai para Descartadas.">
                      <input id="scoreMinimo" type="number" name="scoreMinimo" min={0} max={100} defaultValue={p?.scoreMinimo ?? 60} className={`${control} font-mono tabular-nums`} />
                    </Field>
                    <Field htmlFor="observacoes" label="Observações para a IA" hint="Pretensão, setores preferidos, o que evitar.">
                      <textarea id="observacoes" name="observacoes" rows={3} defaultValue={p?.observacoes} className={control} placeholder="Pretensão CLT R$ X, prefiro fintech…" />
                    </Field>
                  </div>

                  <SubmitButton icon="check" pendingText="Salvando…">
                    Salvar preferências
                  </SubmitButton>
                </form>
              </div>
            </Card>

            {/* ─── Fontes ─── */}
            <Card>
              <CardHeader
                title="Empresas monitoradas"
                hint={
                  <>
                    {srcs.filter((x) => x.enabled).length} empresas ativas, buscadas direto no site de carreiras de cada uma.
                    O identificador está na URL: <code className="font-mono text-xs"><b>assai</b>.gupy.io</code> ou{" "}
                    <code className="font-mono text-xs">boards.greenhouse.io/<b>stone</b></code>
                  </>
                }
              />
              <div className="space-y-4 p-5 sm:p-6">
                <div className="space-y-2">
                  {KINDS.filter((k) => srcs.some((x) => x.kind === k.v)).map((k) => {
                    const group = srcs.filter((x) => x.kind === k.v);
                    return (
                      <details key={k.v} className="group rounded-[var(--radius-md)] border border-line">
                        <summary className="flex min-h-11 cursor-pointer items-center justify-between gap-3 px-4 text-sm font-medium">
                          <span>{k.label}</span>
                          <span className="font-mono text-xs text-muted">
                            {group.filter((x) => x.enabled).length}/{group.length} ativas
                          </span>
                        </summary>
                        <ul className="max-h-96 divide-y divide-line overflow-y-auto border-t border-line">
                          {group.map((s) => (
                            <li key={s.id} className="flex items-center justify-between gap-3 px-4 py-1.5">
                              <div className="min-w-0">
                                <p className={`truncate text-sm font-medium ${s.enabled ? "" : "text-muted line-through"}`}>{s.name}</p>
                                <p className="font-mono text-xs text-muted">{s.slug}</p>
                              </div>
                              <form action={toggleSource.bind(null, s.id, !s.enabled)}>
                                <button className={btn("ghost", "sm")} aria-label={`${s.enabled ? "Pausar" : "Ativar"} ${s.name}`}>
                                  <Icon name={s.enabled ? "pause" : "play"} />
                                  {s.enabled ? "Pausar" : "Ativar"}
                                </button>
                              </form>
                            </li>
                          ))}
                        </ul>
                      </details>
                    );
                  })}
                </div>
                <form action={addSource} className="flex flex-wrap gap-2 [&>select]:w-full [&>select]:sm:w-36 [&>input]:min-w-48 [&>input]:flex-1">
                  <label className="sr-only" htmlFor="kind">Plataforma</label>
                  <select id="kind" name="kind" className={control}>
                    <option value="gupy">Gupy</option>
                    <option value="greenhouse">Greenhouse</option>
                    <option value="lever">Lever</option>
                    <option value="ashby">Ashby</option>
                    <option value="smartrecruiters">SmartRecruiters</option>
                  </select>
                  <label className="sr-only" htmlFor="slug">Identificador</label>
                  <input id="slug" name="slug" placeholder="Identificador (ex.: assai)" required className={control} />
                  <label className="sr-only" htmlFor="name">Nome da empresa</label>
                  <input id="name" name="name" placeholder="Nome da empresa" className={control} />
                  <SubmitButton variant="secondary" icon="plus" pendingText="Adicionando…">
                    Adicionar
                  </SubmitButton>
                </form>
              </div>
            </Card>
          </div>
        </div>
      </main>
    </>
  );
}
