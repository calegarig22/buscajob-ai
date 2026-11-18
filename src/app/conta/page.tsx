import { TopBar } from "@/components/topbar";
import { Alert, Card, CardHeader, control, Field } from "@/components/ui";
import { requireUser } from "@/lib/session";
import { changePassword, deleteAccount } from "../auth-actions";
import { SubmitButton } from "../components";

export const dynamic = "force-dynamic";

export default async function ContaPage({ searchParams }: { searchParams: Promise<{ erro?: string; ok?: string }> }) {
  const user = await requireUser();
  const { erro, ok } = await searchParams;
  return (
    <>
      <TopBar active="conta" user={user} />
      <main className="mx-auto max-w-2xl space-y-6 px-4 py-6 sm:px-6 sm:py-10">
        <div>
          <p className="font-mono text-xs uppercase tracking-[0.2em] text-muted">Conta</p>
          <h1 className="font-display text-3xl font-bold tracking-tight">{user.name}</h1>
          <p className="text-sm text-muted">{user.email}</p>
        </div>
        {erro && <Alert tone="danger">{erro}</Alert>}
        {ok === "senha" && <Alert tone="ok">Senha alterada. Outras sessões abertas foram encerradas.</Alert>}

        <Card>
          <CardHeader title="Trocar senha" hint="Ao trocar, você sai de todos os outros dispositivos." />
          <form action={changePassword} className="space-y-4 p-5 sm:p-6">
            <Field htmlFor="current" label="Senha atual">
              <input id="current" type="password" name="current" autoComplete="current-password" required className={control} />
            </Field>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field htmlFor="password" label="Nova senha" hint="Pelo menos 10 caracteres.">
                <input id="password" type="password" name="password" autoComplete="new-password" minLength={10} required className={control} />
              </Field>
              <Field htmlFor="pass2" label="Repita a nova senha">
                <input id="pass2" type="password" name="pass2" autoComplete="new-password" minLength={10} required className={control} />
              </Field>
            </div>
            <SubmitButton icon="check" pendingText="Salvando…">Trocar senha</SubmitButton>
          </form>
        </Card>

        <Card className="border-danger/30">
          <CardHeader
            title="Apagar conta e dados"
            hint="Apaga para sempre sua conta, currículo, preferências, vagas e empresas monitoradas. Não dá para desfazer."
          />
          <form action={deleteAccount} className="space-y-4 p-5 sm:p-6">
            <Field htmlFor="confirm" label={<>Para confirmar, digite seu e-mail: <span className="font-mono">{user.email}</span></>}>
              <input id="confirm" name="confirm" autoComplete="off" required className={control} />
            </Field>
            <button className="inline-flex min-h-11 items-center gap-2 rounded-[var(--radius-md)] border border-danger/40 bg-surface px-5 text-[0.95rem] font-medium text-danger hover:bg-danger-soft">
              Apagar minha conta e dados
            </button>
          </form>
        </Card>
      </main>
    </>
  );
}
