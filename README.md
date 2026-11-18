# BuscaJob AI

Busca vagas de emprego no Brasil, compara cada uma com o currículo da pessoa e prepara a candidatura (carta e currículo adaptado) sem inventar experiência.

## O que faz

- Lê o currículo em PDF e extrai um perfil estruturado (Gemini; com leitura local sem IA como alternativa).
- Busca vagas em boards públicos (Greenhouse, Lever, Ashby, SmartRecruiters, Gupy) e, opcionalmente, Adzuna, Jooble e Google Jobs (SerpApi).
- Dá uma nota de 0 a 100 para cada vaga (cargo, habilidades, senioridade e local/modelo) e monta uma fila de aprovação.
- Gera carta de apresentação e currículo adaptado à vaga usando só o texto do currículo.
- Confere na hora, no site da empresa, se a vaga ainda está aberta antes de abrir o link.
- Multiusuário, com painel de administração e exclusão completa de conta e dados (LGPD).

## Destaques técnicos

- **Trava anti-invenção** (`src/lib/truth.ts`): confere se a carta cita ferramentas, certificações ou números que não estão no currículo; a IA refaz uma vez e, se insistir, as frases inventadas são removidas.
- **Saída da IA validada por schema**: o Gemini responde em JSON e o resultado passa por Zod antes de ser usado.
- **Retry com backoff exponencial** em 429/5xx (limites do nível gratuito do Gemini).
- **Funciona sem IA**: nota, leitura do currículo, sugestão de busca e carta têm versões locais, sem custo.
- **Segurança**: senhas com scrypt, sessão em cookie assinado com versão (logout global), cron protegido por segredo, dados isolados por usuário.

## Stack

Next.js 15 (App Router, Server Actions) · React 19 · TypeScript · Tailwind CSS 4 · Drizzle ORM · Postgres (Neon) · Google Gemini (`@google/genai`) · Zod · Vercel Cron.

## Como rodar

```bash
cp .env.example .env.local   # preencha as variáveis
pnpm install
pnpm db:push                 # cria as tabelas
pnpm dev
```

Variáveis principais: `DATABASE_URL`, `AUTH_SECRET`, `CRON_SECRET` e, opcional, `GEMINI_API_KEY`. As demais (fontes extras de vagas, `AI_SCORING`, admin inicial) estão comentadas no `.env.example`. O cron diário está em `vercel.json` e chama `/api/cron`.

## Estrutura

```
src/app/            páginas (fila, perfil, conta, admin, cv) e server actions
src/app/api/        cron diário e upload de currículo
src/lib/sources/    um conector por fonte de vagas
src/lib/            nota local, IA, trava anti-invenção, pipeline, sessão
src/db/             schema Drizzle e conexão
scripts/            migração para multiusuário (cria o admin)
```

## Direitos autorais

© 2026 Gustavo Fiedler Calegari. Todos os direitos reservados.

Este código está publicado apenas para avaliação de portfólio. Não é permitido copiar, modificar, distribuir ou usar comercialmente, no todo ou em parte, sem autorização por escrito do autor.
