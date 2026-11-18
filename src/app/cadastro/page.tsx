import Link from "next/link";
import { redirect } from "next/navigation";
import { AuthShell } from "@/components/auth-shell";
import { Alert, control, Field } from "@/components/ui";
import { getUser } from "@/lib/session";
import { signup } from "../auth-actions";
import { SubmitButton } from "../components";

export const metadata = { title: "Criar conta · BuscaJob" };

export default async function CadastroPage({ searchParams }: { searchParams: Promise<{ erro?: string }> }) {
  if (await getUser()) redirect("/");
  const { erro } = await searchParams;
  return (
    <AuthShell title="Criar conta" subtitle="Envie seu currículo e receba milhares de vagas avaliadas para você.">
      <form action={signup} className="space-y-4">
        {/* armadilha para robôs: invisível para pessoas */}
        <div aria-hidden className="absolute -left-[9999px] h-0 overflow-hidden">
          <label htmlFor="website">Não preencha</label>
          <input id="website" name="website" tabIndex={-1} autoComplete="off" />
        </div>
        <Field htmlFor="name" label="Nome">
          <input id="name" name="name" autoComplete="name" autoFocus required maxLength={80} className={control} />
        </Field>
        <Field htmlFor="email" label="E-mail">
          <input id="email" type="email" name="email" autoComplete="email" required className={control} />
        </Field>
        <Field htmlFor="password" label="Senha" hint="Pelo menos 10 caracteres.">
          <input id="password" type="password" name="password" autoComplete="new-password" minLength={10} required className={control} />
        </Field>
        <Field htmlFor="pass2" label="Repita a senha">
          <input id="pass2" type="password" name="pass2" autoComplete="new-password" minLength={10} required className={control} />
        </Field>
        <label className="flex items-start gap-3 text-sm">
          <input type="checkbox" name="terms" required className="mt-1 size-4 accent-[var(--color-ink)]" />
          <span>
            Li e aceito a{" "}
            <Link href="/privacidade" target="_blank" className="font-medium text-ink underline underline-offset-2">
              política de privacidade
            </Link>
            : meu currículo fica guardado para buscar e avaliar vagas, e posso apagar tudo quando quiser.
          </span>
        </label>
        {erro && <Alert tone="danger">{erro}</Alert>}
        <div className="[&>button]:w-full">
          <SubmitButton pendingText="Criando conta…">Criar conta</SubmitButton>
        </div>
      </form>
      <p className="text-center text-sm text-muted">
        Já tem conta?{" "}
        <Link href="/login" className="font-medium text-ink underline underline-offset-2">
          Entrar
        </Link>
      </p>
    </AuthShell>
  );
}
