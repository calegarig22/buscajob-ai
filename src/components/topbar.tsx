import Link from "next/link";
import { logout } from "@/app/actions";
import type { User } from "@/db";
import { Icon } from "./ui";

type Active = "vagas" | "perfil" | "conta" | "admin";

export function TopBar({ active, user }: { active: Active; user: Pick<User, "name" | "role"> }) {
  const link = (href: string, key: Active, label: string) => (
    <Link
      href={href}
      aria-current={active === key ? "page" : undefined}
      className={`inline-flex min-h-11 items-center rounded-[var(--radius-md)] px-3 text-sm font-medium transition-colors sm:px-3.5 ${
        active === key ? "bg-ink-soft text-ink" : "text-muted hover:text-fg hover:bg-surface-2"
      }`}
    >
      {label}
    </Link>
  );
  return (
    <header className="sticky top-0 z-20 border-b border-line bg-bg/85 backdrop-blur supports-[backdrop-filter]:bg-bg/70">
      <div className="mx-auto flex max-w-5xl items-center gap-1 px-4 py-2 sm:gap-2 sm:px-6">
        <Link href="/" className="mr-auto flex items-center gap-2 font-display text-lg font-bold tracking-tight">
          <span aria-hidden className="grid size-8 place-items-center rounded-[var(--radius-sm)] border-2 border-ink font-mono text-xs text-ink rotate-[-6deg]">
            BJ
          </span>
          <span className="hidden sm:inline">BuscaJob</span>
        </Link>
        <nav aria-label="Principal" className="flex items-center gap-0.5 sm:gap-1">
          {link("/", "vagas", "Vagas")}
          {link("/perfil", "perfil", "Perfil")}
          {user.role === "admin" && link("/admin", "admin", "Admin")}
          {link("/conta", "conta", "Conta")}
        </nav>
        <form action={logout}>
          <button className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-[var(--radius-md)] text-muted hover:bg-surface-2 hover:text-fg" aria-label={`Sair (${user.name})`} title={`Sair (${user.name})`}>
            <Icon name="logout" className="size-5" />
          </button>
        </form>
      </div>
    </header>
  );
}
