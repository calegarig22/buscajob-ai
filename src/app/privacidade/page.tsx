import Link from "next/link";

export const metadata = { title: "Privacidade · BuscaJob" };

export default function PrivacidadePage() {
  return (
    <main className="mx-auto max-w-2xl px-4 py-10 sm:px-6">
      <Link href="/" className="text-sm text-muted underline underline-offset-2 hover:text-fg">
        ← BuscaJob
      </Link>
      <p className="mt-8 font-mono text-xs uppercase tracking-[0.2em] text-muted">LGPD</p>
      <h1 className="font-display text-3xl font-bold tracking-tight">Política de privacidade</h1>
      <p className="mt-2 text-sm text-muted">Atualizada em 11/11/2026.</p>

      <div className="mt-8 space-y-6 leading-relaxed [&_h2]:font-display [&_h2]:text-lg [&_h2]:font-semibold [&_ul]:list-disc [&_ul]:space-y-1 [&_ul]:pl-5">
        <section>
          <h2>O que é o BuscaJob</h2>
          <p>
            Uma ferramenta que busca vagas de emprego, avalia o quanto cada uma combina
            com o seu currículo e ajuda a se candidatar. Não vendemos nem compartilhamos seus dados com recrutadores ou
            anunciantes.
          </p>
        </section>
        <section>
          <h2>Quais dados guardamos</h2>
          <ul>
            <li>Conta: nome, e-mail e senha (guardada só como hash, nunca em texto).</li>
            <li>Currículo em PDF e o perfil extraído dele (experiências, formação, habilidades, contato).</li>
            <li>Suas preferências de busca, as vagas encontradas, as notas e as cartas de apresentação geradas.</li>
            <li>
              Registro de uso: datas de acesso e ações feitas no app (login, buscas, aprovações), visível ao
              administrador para acompanhar o uso e evitar abuso. Não registramos o conteúdo do currículo nesse histórico.
            </li>
          </ul>
        </section>
        <section>
          <h2>Para que usamos (finalidade e base legal)</h2>
          <p>
            Só para prestar o serviço que você pediu: buscar vagas, avaliá-las e preparar candidaturas. A base legal é o
            seu consentimento, dado ao criar a conta, e a execução do serviço solicitado (LGPD, art. 7º, I e V).
          </p>
        </section>
        <section>
          <h2>Com quem os dados são processados</h2>
          <ul>
            <li>Neon (banco de dados, servidores em São Paulo).</li>
            <li>Vercel (hospedagem do site).</li>
            <li>
              Google Gemini (IA que lê o currículo, sugere a busca e escreve cartas de apresentação). As notas das vagas são
              calculadas no próprio BuscaJob, sem enviar seus dados a terceiros.
            </li>
            <li>Quando você se candidata, os dados vão para o sistema de recrutamento da empresa (ex.: Greenhouse, Lever).</li>
          </ul>
        </section>
        <section>
          <h2>Seus direitos</h2>
          <p>
            Você pode ver, corrigir e trocar seu currículo a qualquer momento no Perfil, e{" "}
            <b>apagar a conta e todos os dados</b> em Conta → Apagar conta e dados. A exclusão é imediata e definitiva.
            Para qualquer outra solicitação, fale com o administrador do serviço.
          </p>
        </section>
        <section>
          <h2>Segurança</h2>
          <p>
            Conexões criptografadas (HTTPS), senhas com hash scrypt, sessões assinadas e acesso aos dados restrito à sua
            conta.
          </p>
        </section>
      </div>
    </main>
  );
}
