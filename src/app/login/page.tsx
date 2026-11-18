import Link from "next/link";
import { redirect } from "next/navigation";
import { AuthShell } from "@/components/auth-shell";
import { Alert, control, Field } from "@/components/ui";
import { getUser } from "@/lib/session";
import { login } from "../auth-actions";
import { SubmitButton } from "../components";

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ erro?: string; apagada?: string }> }) {
  if (await getUser()) redirect("/");
  const { erro, apagada } = await searchParams;
  return (
    <AuthShell title="BuscaJob" subtitle="Sua triagem de vagas com IA.">
      <form action={login} className="space-y-4">
        <Field htmlFor="email" label="E-mail">
          <input id="email" type="email" name="email" autoComplete="email" autoFocus required className={control} />
        </Field>
        <Field htmlFor="password" label="Senha">
          <input id="password" type="password" name="password" autoComplete="current-password" required className={control} />
        </Field>
        {erro && <Alert tone="danger">{erro}</Alert>}
        {apagada && <Alert tone="ok">Conta e dados apagados.</Alert>}
        <div className="[&>button]:w-full">
          <SubmitButton pendingText="Entrando…">Entrar</SubmitButton>
        </div>
      </form>
      <div className="border-t border-line pt-4 text-center">
        <p className="mb-2 text-sm text-muted">Ainda não tem conta?</p>
        <Link href="/cadastro" className="inline-flex min-h-11 w-full items-center justify-center rounded-[var(--radius-md)] border border-line-strong bg-surface px-5 text-[0.95rem] font-medium hover:bg-surface-2">
          Criar uma conta
        </Link>
      </div>
      <p className="text-center text-xs text-muted">Esqueceu a senha? Peça um link de redefinição ao administrador.</p>
    </AuthShell>
  );
}
