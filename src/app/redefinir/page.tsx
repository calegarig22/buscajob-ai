import { AuthShell } from "@/components/auth-shell";
import { Alert, control, Field } from "@/components/ui";
import { resetPassword } from "../auth-actions";
import { SubmitButton } from "../components";

export default async function RedefinirPage({ searchParams }: { searchParams: Promise<{ token?: string; erro?: string }> }) {
  const { token = "", erro } = await searchParams;
  return (
    <AuthShell title="Nova senha" subtitle="Escolha uma senha nova para sua conta.">
      <form action={resetPassword} className="space-y-4">
        <input type="hidden" name="token" value={token} />
        <Field htmlFor="password" label="Nova senha" hint="Pelo menos 10 caracteres.">
          <input id="password" type="password" name="password" autoComplete="new-password" minLength={10} required className={control} />
        </Field>
        <Field htmlFor="pass2" label="Repita a senha">
          <input id="pass2" type="password" name="pass2" autoComplete="new-password" minLength={10} required className={control} />
        </Field>
        {erro && <Alert tone="danger">{erro}</Alert>}
        <div className="[&>button]:w-full">
          <SubmitButton pendingText="Salvando…">Salvar nova senha</SubmitButton>
        </div>
      </form>
    </AuthShell>
  );
}
