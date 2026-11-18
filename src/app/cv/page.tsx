import Link from "next/link";
import { and, eq } from "drizzle-orm";
import { db, jobs, profile } from "@/db";
import { requireUser } from "@/lib/session";
import { matchJob, pretty } from "@/lib/match";
import { PrintButton } from "../components";

export const dynamic = "force-dynamic";
export const metadata = { title: "Currículo para a vaga · BuscaJob" };

/**
 * Currículo adaptado à vaga, montado SÓ com o texto do currículo da pessoa:
 * habilidades pedidas pela vaga primeiro, destaques relevantes no topo e, em cada experiência,
 * as frases mais ligadas à vaga primeiro. Nenhuma palavra nova é criada.
 */
export default async function CvPage({ searchParams }: { searchParams: Promise<{ id?: string }> }) {
  const user = await requireUser();
  const { id = "" } = await searchParams;
  const [me] = await db.select({ data: profile.data }).from(profile).where(eq(profile.userId, user.id));
  const [job] = await db
    .select({ title: jobs.title, company: jobs.company, description: jobs.description })
    .from(jobs)
    .where(and(eq(jobs.userId, user.id), eq(jobs.id, id)));
  if (!me?.data || !job)
    return (
      <main className="mx-auto max-w-xl px-4 py-12">
        <p>Currículo ou vaga não encontrados.</p>
        <Link href="/" className="underline">Voltar</Link>
      </main>
    );
  const p = me.data;
  const m = matchJob(p, job);
  const contact = [p.email, p.telefone, p.cidade, p.linkedin].filter(Boolean);

  return (
    <main className="cv-page mx-auto max-w-[820px] px-4 py-6 sm:py-10">
      {/* barra de ações: não sai na impressão */}
      <div className="no-print mb-6 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <Link href="/?aba=aprovada" className="text-sm text-muted underline underline-offset-2">← Voltar às vagas</Link>
          <PrintButton />
        </div>
        <div className="rounded-[var(--radius-md)] border border-ok/30 bg-ok-soft px-4 py-3 text-sm text-ok">
          <b>Adaptado para {job.title.trim()} · {job.company}.</b> Montado só com o texto do seu currículo: a ordem e os
          destaques mudam, nenhuma informação foi criada.
          {m.keywordsMissing.length > 0 && (
            <> A vaga também pede <b>{m.keywordsMissing.slice(0, 5).map(pretty).join(", ")}</b>, que não estão no seu currículo e por isso não aparecem aqui.</>
          )}
        </div>
      </div>

      <article className="cv rounded-[var(--radius-lg)] border border-line bg-white p-8 text-[#141c2e] shadow-[var(--shadow-card)] sm:p-12">
        <header className="border-b-2 border-[#1d3a8a] pb-4">
          <h1 className="font-display text-3xl font-bold tracking-tight">{p.nome}</h1>
          {p.senioridade && <p className="mt-0.5 text-[0.95rem] text-[#3d4659]">Candidatura: {job.title.trim()}</p>}
          <p className="mt-2 text-sm text-[#3d4659]">{contact.join("  ·  ")}</p>
        </header>

        {p.resumo && (
          <section className="mt-5">
            <h2 className="cv-h">Resumo</h2>
            <p className="text-[0.95rem] leading-relaxed">{p.resumo}</p>
          </section>
        )}

        {m.highlights.length > 0 && (
          <section className="mt-5">
            <h2 className="cv-h">Destaques para esta vaga</h2>
            <ul className="list-disc space-y-1 pl-5 text-[0.95rem] leading-relaxed">
              {m.highlights.map((h, i) => (
                <li key={i}>
                  {h.text} <span className="text-[#5b6779]">({h.empresa})</span>
                </li>
              ))}
            </ul>
          </section>
        )}

        {p.habilidades.length > 0 && (
          <section className="mt-5">
            <h2 className="cv-h">Habilidades</h2>
            <p className="text-[0.95rem] leading-relaxed">
              {m.skillsRelevant.length > 0 && <b>{m.skillsRelevant.join(" · ")}</b>}
              {m.skillsRelevant.length > 0 && m.skillsOther.length > 0 && " · "}
              {m.skillsOther.join(" · ")}
            </p>
          </section>
        )}

        {m.experiences.length > 0 && (
          <section className="mt-5">
            <h2 className="cv-h">Experiência</h2>
            <div className="space-y-4">
              {m.experiences.map((e, i) => (
                <div key={i} className="cv-block">
                  <p className="flex flex-wrap justify-between gap-x-4 text-[0.95rem]">
                    <b>
                      {e.cargo}
                      {e.empresa && ` · ${e.empresa}`}
                    </b>
                    <span className="text-[#5b6779]">{e.periodo}</span>
                  </p>
                  {e.bullets.length > 0 && (
                    <ul className="mt-1 list-disc space-y-0.5 pl-5 text-[0.93rem] leading-relaxed">
                      {e.bullets.map((b, k) => (
                        <li key={k}>{b.text}</li>
                      ))}
                    </ul>
                  )}
                </div>
              ))}
            </div>
          </section>
        )}

        {p.formacao.length > 0 && (
          <section className="mt-5">
            <h2 className="cv-h">Formação</h2>
            <ul className="space-y-0.5 text-[0.95rem]">
              {p.formacao.map((f, i) => (
                <li key={i} className="flex flex-wrap justify-between gap-x-4">
                  <span>
                    <b>{f.curso}</b>
                    {f.instituicao && ` · ${f.instituicao}`}
                  </span>
                  <span className="text-[#5b6779]">{f.periodo}</span>
                </li>
              ))}
            </ul>
          </section>
        )}

        {p.idiomas.length > 0 && (
          <section className="mt-5">
            <h2 className="cv-h">Idiomas</h2>
            <p className="text-[0.95rem]">{p.idiomas.join(" · ")}</p>
          </section>
        )}
      </article>
    </main>
  );
}
