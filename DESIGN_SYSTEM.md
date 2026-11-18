# Design system — BuscaJob

Conceito: **mesa de triagem**. Papel frio, tinta azul de carimbo; cada vaga decidida ganha um carimbo.

**Regra de ouro:** nunca hardcode cor, raio ou sombra. Use os tokens.

## Tokens (`src/app/globals.css`, bloco `@theme`)

| Token | Uso |
|---|---|
| `bg` | fundo da página |
| `surface` / `surface-2` | cards / áreas internas (carta, chips) |
| `line` / `line-strong` | bordas sutis / bordas de controles |
| `fg` / `muted` | texto principal / secundário |
| `ink` / `ink-fg` / `ink-soft` | primária (botão, aba ativa) / texto sobre ela / fundo leve |
| `ok`, `warn`, `danger` (+ `-soft`) | nota forte, possível, erro/descartar |
| `ring` | foco visível |

Tema escuro: mesmos nomes, valores trocados em `@media (prefers-color-scheme: dark)`. Pares de texto verificados para contraste WCAG AA.

Raio `--radius-sm/md/lg` (6/10/16px), sombras `--shadow-card/pop`, animações `animate-stamp` e `animate-rise`. Com `prefers-reduced-motion`, as animações são desligadas.

## Tipografia

- **Bricolage Grotesque** (`font-display`): títulos e nomes de vaga.
- **Instrument Sans** (`font-sans`): texto e controles.
- **JetBrains Mono** (`font-mono`): notas, contadores, identificadores e sobretítulos ("TRIAGEM").

## Componentes (`src/components/ui.tsx`)

- `btn(variant, size)`: `primary` (ação principal da tela, uma por área), `secondary`, `ghost` (ações de baixo risco), `danger`, `success` (Aprovar). Todos com altura mínima de 44px.
- `Card`, `CardHeader`, `Badge`, `Alert`, `Field` + `control` (inputs).
- `Score`: nota em mono + faixa (forte ≥ 80, possível ≥ 60, fraca).
- `Stamp`: carimbo de status. É a assinatura visual; não usar para outra coisa.
- `Icon`: SVG inline, sem dependência.

Componentes interativos (cliente) ficam em `src/app/components.tsx`: `SubmitButton`, `RunButton`, `JobActions`, `CopyButton`, `RemoveResumeButton` e `FileDrop`.

## Texto

Botões dizem o que acontece ("Marcar como enviada", não "Enviar"). Estados vazios dizem o próximo passo. Erros dizem o que houve e como resolver.
