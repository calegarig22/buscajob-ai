// Componentes-base do design system. Usam apenas tokens de globals.css.
import type { ReactNode } from "react";

/* ───────── Button (classe reutilizável: <button>, <a> e SubmitButton) ───────── */
type Variant = "primary" | "secondary" | "ghost" | "danger" | "success";
type Size = "sm" | "md";

const base =
  "inline-flex items-center justify-center gap-2 rounded-[var(--radius-md)] font-medium whitespace-nowrap " +
  "transition-[background,color,border-color,transform] duration-150 active:translate-y-px " +
  "disabled:opacity-55 disabled:pointer-events-none select-none";
const variants: Record<Variant, string> = {
  primary: "bg-ink text-ink-fg hover:brightness-110 shadow-[var(--shadow-card)]",
  secondary: "bg-surface text-fg border border-line-strong hover:bg-surface-2",
  ghost: "text-muted hover:text-fg hover:bg-surface-2",
  danger: "bg-surface text-danger border border-danger/40 hover:bg-danger-soft",
  success: "bg-ok text-white hover:brightness-110 dark:text-bg",
};
const sizes: Record<Size, string> = {
  sm: "min-h-11 px-3.5 text-sm", // 44px: alvo de toque mínimo
  md: "min-h-11 px-5 text-[0.95rem]",
};

export function btn(variant: Variant = "primary", size: Size = "md", extra = "") {
  return `${base} ${variants[variant]} ${sizes[size]} ${extra}`;
}

/* ───────── Card ───────── */
export function Card({ children, className = "" }: { children: ReactNode; className?: string }) {
  return (
    <section
      className={`bg-surface border border-line rounded-[var(--radius-lg)] shadow-[var(--shadow-card)] ${className}`}
    >
      {children}
    </section>
  );
}

export function CardHeader({ title, hint, action }: { title: string; hint?: ReactNode; action?: ReactNode }) {
  return (
    <header className="flex flex-wrap items-start justify-between gap-3 px-5 pt-5 sm:px-6 sm:pt-6">
      <div className="min-w-0">
        <h2 className="font-display text-lg font-semibold tracking-tight">{title}</h2>
        {hint && <p className="mt-0.5 text-sm text-muted">{hint}</p>}
      </div>
      {action}
    </header>
  );
}

/* ───────── Badge ───────── */
type Tone = "neutral" | "ink" | "ok" | "warn" | "danger";
const tones: Record<Tone, string> = {
  neutral: "bg-surface-2 text-muted border-line",
  ink: "bg-ink-soft text-ink border-transparent",
  ok: "bg-ok-soft text-ok border-transparent",
  warn: "bg-warn-soft text-warn border-transparent",
  danger: "bg-danger-soft text-danger border-transparent",
};
export function Badge({ children, tone = "neutral" }: { children: ReactNode; tone?: Tone }) {
  return (
    <span className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-xs font-medium ${tones[tone]}`}>
      {children}
    </span>
  );
}

/* ───────── Alert ───────── */
export function Alert({ tone, children }: { tone: "ok" | "danger" | "ink"; children: ReactNode }) {
  const map = {
    ok: "bg-ok-soft text-ok border-ok/30",
    danger: "bg-danger-soft text-danger border-danger/30",
    ink: "bg-ink-soft text-ink border-ink/20",
  };
  return (
    <p role={tone === "danger" ? "alert" : "status"} className={`rounded-[var(--radius-md)] border px-4 py-3 text-sm ${map[tone]}`}>
      {children}
    </p>
  );
}

/* ───────── Field (label + helper + controle) ───────── */
export const control =
  "w-full rounded-[var(--radius-md)] border border-line-strong bg-surface px-3.5 py-2.5 text-[0.95rem] text-fg " +
  "placeholder:text-muted/70 transition-colors hover:border-muted/60 " +
  "focus-visible:outline-2 focus-visible:outline-ring focus-visible:outline-offset-0 focus-visible:border-ring";

export function Field({
  label,
  hint,
  htmlFor,
  children,
}: {
  label: ReactNode;
  hint?: ReactNode;
  htmlFor: string;
  children: ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <label htmlFor={htmlFor} className="block text-sm font-medium">
        {label}
      </label>
      {children}
      {hint && <p className="text-xs text-muted">{hint}</p>}
    </div>
  );
}

/* ───────── Score: assinatura numérica (mono) com faixa ───────── */
export function scoreBand(s: number | null): { label: string; tone: Tone } {
  if (s == null) return { label: "sem nota", tone: "neutral" };
  if (s >= 80) return { label: "forte", tone: "ok" };
  if (s >= 60) return { label: "possível", tone: "warn" };
  return { label: "fraca", tone: "neutral" };
}

export function Score({ value }: { value: number | null }) {
  const band = scoreBand(value);
  const color = { ok: "text-ok", warn: "text-warn", neutral: "text-muted", ink: "text-ink", danger: "text-danger" }[band.tone];
  const bar = { ok: "bg-ok", warn: "bg-warn", neutral: "bg-line-strong", ink: "bg-ink", danger: "bg-danger" }[band.tone];
  return (
    <div className="flex sm:flex-col items-center sm:items-start gap-2 sm:gap-1 sm:w-20 shrink-0" aria-label={`Nota ${value ?? "pendente"}, ${band.label}`}>
      <span className={`font-mono text-3xl sm:text-4xl font-semibold leading-none tabular-nums ${color}`}>{value ?? "—"}</span>
      <span className="text-xs uppercase tracking-wider text-muted">{band.label}</span>
      <span className="hidden sm:block h-1 w-full rounded-full bg-surface-2 overflow-hidden" aria-hidden>
        <span className={`block h-full ${bar}`} style={{ width: `${value ?? 0}%` }} />
      </span>
    </div>
  );
}

/* ───────── Carimbo (assinatura visual) ───────── */
export function Stamp({ status }: { status: string }) {
  const map: Record<string, { text: string; cls: string }> = {
    aprovada: { text: "Aprovada", cls: "text-ok border-ok" },
    enviada: { text: "Enviada", cls: "text-ink border-ink" },
    rejeitada: { text: "Descartada", cls: "text-danger border-danger" },
  };
  const s = map[status];
  if (!s) return null;
  return (
    <span
      aria-hidden
      className={`pointer-events-none absolute right-4 top-4 rotate-[-9deg] select-none rounded-[4px] border-[2.5px] px-2.5 py-0.5 font-mono text-[0.7rem] font-bold uppercase tracking-[0.18em] opacity-80 animate-stamp ${s.cls}`}
    >
      {s.text}
    </span>
  );
}

/* ───────── Ícones (inline, sem dependência) ───────── */
const paths: Record<string, ReactNode> = {
  search: <><circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" /></>,
  check: <path d="m5 12 5 5L20 7" />,
  x: <path d="M6 6l12 12M18 6 6 18" />,
  undo: <path d="M9 14 4 9l5-5M4 9h10a6 6 0 0 1 0 12h-3" />,
  external: <path d="M14 4h6v6M20 4l-9 9M19 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1h5" />,
  copy: <><rect x="9" y="9" width="11" height="11" rx="2" /><path d="M5 15V5a1 1 0 0 1 1-1h10" /></>,
  sparkles: <path d="M12 3l1.8 4.7L18.5 9.5l-4.7 1.8L12 16l-1.8-4.7L5.5 9.5l4.7-1.8zM19 15l.8 2.2L22 18l-2.2.8L19 21l-.8-2.2L16 18l2.2-.8z" />,
  upload: <path d="M12 16V4m0 0-4 4m4-4 4 4M4 16v3a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-3" />,
  file: <><path d="M14 3H6a1 1 0 0 0-1 1v16a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1V8z" /><path d="M14 3v5h5" /></>,
  trash: <path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3" />,
  pin: <><path d="M12 21s-7-6.2-7-11a7 7 0 1 1 14 0c0 4.8-7 11-7 11z" /><circle cx="12" cy="10" r="2.5" /></>,
  building: <path d="M4 21V5a1 1 0 0 1 1-1h9a1 1 0 0 1 1 1v16M15 9h4a1 1 0 0 1 1 1v11M8 8h3M8 12h3M8 16h3M3 21h18" />,
  logout: <path d="M15 4h3a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-3M10 16l-4-4 4-4M6 12h10" />,
  plus: <path d="M12 5v14M5 12h14" />,
  pause: <path d="M9 5v14M15 5v14" />,
  play: <path d="M7 5l12 7-12 7z" />,
  alert: <path d="M12 9v4m0 4h.01M10.3 3.9 2.4 18a2 2 0 0 0 1.7 3h15.8a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z" />,
};

export function Icon({ name, className = "size-4" }: { name: keyof typeof paths; className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden>
      {paths[name]}
    </svg>
  );
}
export type IconName = keyof typeof paths;
