import type { ResumeProfile } from "@/db";
import { control, Field } from "./ui";
import { saveProfileData } from "@/app/actions";
import { SubmitButton } from "@/app/components";

const LEVELS = ["estágio", "júnior", "pleno", "sênior", "especialista", "gestão"];

/** Edição do perfil extraído do currículo. Tudo aqui vira a "fonte da verdade" do app. */
export function ProfileEditor({ p, open }: { p: ResumeProfile; open: boolean }) {
  const exps = [...p.experiencias, { cargo: "", empresa: "", periodo: "", descricao: "" }].slice(0, 10);
  const forms = [...p.formacao, { curso: "", instituicao: "", periodo: "" }].slice(0, 6);
  return (
    <details open={open} className="rounded-[var(--radius-md)] border border-line">
      <summary className="flex min-h-11 items-center px-4 text-sm font-medium">Conferir e editar meus dados</summary>
      <form action={saveProfileData} className="space-y-4 border-t border-line p-4">
        <p className="text-xs text-muted">
          A nota das vagas, o currículo adaptado e a carta usam <b>só</b> o que está aqui. Corrija o que estiver errado.
        </p>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field htmlFor="nome" label="Nome"><input id="nome" name="nome" defaultValue={p.nome} className={control} /></Field>
          <Field htmlFor="senioridade" label="Nível">
            <select id="senioridade" name="senioridade" defaultValue={LEVELS.includes(p.senioridade) ? p.senioridade : "júnior"} className={control}>
              {LEVELS.map((l) => <option key={l} value={l}>{l}</option>)}
            </select>
          </Field>
          <Field htmlFor="email" label="E-mail"><input id="email" name="email" defaultValue={p.email} className={control} /></Field>
          <Field htmlFor="telefone" label="Telefone"><input id="telefone" name="telefone" defaultValue={p.telefone} className={control} /></Field>
          <Field htmlFor="cidade" label="Cidade"><input id="cidade" name="cidade" defaultValue={p.cidade} className={control} /></Field>
          <Field htmlFor="linkedin" label="LinkedIn"><input id="linkedin" name="linkedin" defaultValue={p.linkedin} className={control} /></Field>
        </div>
        <Field htmlFor="resumo" label="Resumo"><textarea id="resumo" name="resumo" rows={4} defaultValue={p.resumo} className={control} /></Field>
        <Field htmlFor="habilidades" label="Habilidades" hint="Uma por linha.">
          <textarea id="habilidades" name="habilidades" rows={6} defaultValue={p.habilidades.join("\n")} className={control} />
        </Field>
        <fieldset className="space-y-3">
          <legend className="text-sm font-medium">Experiências</legend>
          {exps.map((e, i) => (
            <div key={i} className="grid gap-2 rounded-[var(--radius-md)] bg-surface-2 p-3 sm:grid-cols-3">
              <input name={`exp_cargo_${i}`} defaultValue={e.cargo} placeholder="Cargo" aria-label={`Cargo ${i + 1}`} className={control} />
              <input name={`exp_empresa_${i}`} defaultValue={e.empresa} placeholder="Empresa" aria-label={`Empresa ${i + 1}`} className={control} />
              <input name={`exp_periodo_${i}`} defaultValue={e.periodo} placeholder="Período (ex.: jan. 2025 – Atual)" aria-label={`Período ${i + 1}`} className={control} />
              <textarea name={`exp_descricao_${i}`} defaultValue={e.descricao} rows={3} placeholder="O que você fez (uma realização por frase)" aria-label={`Descrição ${i + 1}`} className={`${control} sm:col-span-3`} />
            </div>
          ))}
        </fieldset>
        <fieldset className="space-y-2">
          <legend className="text-sm font-medium">Formação</legend>
          {forms.map((x, i) => (
            <div key={i} className="grid gap-2 sm:grid-cols-3">
              <input name={`form_curso_${i}`} defaultValue={x.curso} placeholder="Curso" aria-label={`Curso ${i + 1}`} className={control} />
              <input name={`form_inst_${i}`} defaultValue={x.instituicao} placeholder="Instituição" aria-label={`Instituição ${i + 1}`} className={control} />
              <input name={`form_periodo_${i}`} defaultValue={x.periodo} placeholder="Período" aria-label={`Período do curso ${i + 1}`} className={control} />
            </div>
          ))}
        </fieldset>
        <Field htmlFor="idiomas" label="Idiomas" hint="Separe por vírgula.">
          <input id="idiomas" name="idiomas" defaultValue={p.idiomas.join(", ")} className={control} />
        </Field>
        <SubmitButton icon="check" pendingText="Salvando…">Salvar meus dados</SubmitButton>
      </form>
    </details>
  );
}
