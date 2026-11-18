import Link from "next/link";
import { and, eq } from "drizzle-orm";
import { db, jobs } from "@/db";
import { TopBar } from "@/components/topbar";
import { btn, Card } from "@/components/ui";
import { requireUser } from "@/lib/session";

export const dynamic = "force-dynamic";

export default async function EncerradaPage({ searchParams }: { searchParams: Promise<{ id?: string }> }) {
  const user = await requireUser();
  const { id = "" } = await searchParams;
  const [job] = await db
    .select({ title: jobs.title, company: jobs.company })
    .from(jobs)
    .where(and(eq(jobs.userId, user.id), eq(jobs.id, id)));
  return (
    <>
      <TopBar active="vagas" user={user} />
      <main className="mx-auto max-w-xl px-4 py-12 sm:px-6">
        <Card className="space-y-4 p-6 text-center">
          <p className="font-mono text-xs uppercase tracking-[0.2em] text-danger">Vaga encerrada</p>
          <h1 className="font-display text-2xl font-bold tracking-tight">
            {job ? `${job.title} · ${job.company}` : "Esta vaga"} não está mais aberta
          </h1>
          <p className="text-sm text-muted">
            Conferimos agora no site da empresa: a vaga saiu do ar ou as inscrições terminaram. Ela foi tirada da sua fila
            para você não perder tempo.
          </p>
          <Link href="/" className={btn("primary", "md")}>
            Voltar para as vagas
          </Link>
        </Card>
      </main>
    </>
  );
}
