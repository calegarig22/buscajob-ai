import Link from "next/link";
import type { ReactNode } from "react";

/** Moldura das telas sem login (entrar, cadastro, redefinir). */
export function AuthShell({ title, subtitle, children }: { title: string; subtitle: string; children: ReactNode }) {
  return (
    <main className="grid min-h-dvh place-items-center px-4 py-10">
      <div className="w-full max-w-sm animate-rise">
        <div className="mb-8 text-center">
          <span
            aria-hidden
            className="mx-auto mb-5 grid size-16 place-items-center rounded-[var(--radius-md)] border-[3px] border-ink font-mono text-lg font-bold text-ink rotate-[-8deg] animate-stamp"
          >
            BJ
          </span>
          <h1 className="font-display text-3xl font-bold tracking-tight">{title}</h1>
          <p className="mt-1 text-sm text-muted">{subtitle}</p>
        </div>
        <div className="space-y-4 rounded-[var(--radius-lg)] border border-line bg-surface p-6 shadow-[var(--shadow-card)]">
          {children}
        </div>
        <p className="mt-6 text-center text-xs text-muted">
          <Link href="/privacidade" className="underline underline-offset-2 hover:text-fg">
            Política de privacidade
          </Link>
        </p>
      </div>
    </main>
  );
}
