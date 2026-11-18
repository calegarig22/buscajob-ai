"use client";

import { useState, useTransition, type ReactNode } from "react";
import { useFormStatus } from "react-dom";
import { approveJob, improveLetterAI, removeResume, runNow, setJobStatus, writeLetter } from "./actions";
import { btn, Icon, type IconName } from "@/components/ui";

function Spinner() {
  return <span aria-hidden className="size-4 rounded-full border-2 border-current/30 border-t-current animate-spin" />;
}

/** Botão de formulário com estado de carregamento (server actions podem levar ~30s com a IA). */
export function SubmitButton({
  children,
  pendingText,
  variant = "primary",
  icon,
}: {
  children: ReactNode;
  pendingText: string;
  variant?: "primary" | "secondary";
  icon?: IconName;
}) {
  const { pending } = useFormStatus();
  return (
    <button disabled={pending} aria-busy={pending} className={btn(variant, "md")}>
      {pending ? <Spinner /> : icon && <Icon name={icon} />}
      {pending ? pendingText : children}
    </button>
  );
}

export function RunButton({ disabled, hint }: { disabled?: boolean; hint?: string }) {
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<{ tone: "ok" | "danger"; text: string } | null>(null);
  return (
    <div className="flex flex-col items-start gap-2 sm:items-end">
      <button
        disabled={pending || disabled}
        onClick={() =>
          start(async () => {
            setMsg(null);
            try {
              const r = await runNow();
              const fmt = (n?: number) => (n ?? 0).toLocaleString("pt-BR");
              const parts = r.scanned
                ? [
                    `${fmt(r.scanned)} vagas conferidas em ${r.companies} empresas`,
                    `${fmt(r.matched)} combinam com você`,
                    r.inserted ? `${fmt(r.inserted)} novas` : "nenhuma nova desde a última busca",
                    r.closed ? `${fmt(r.closed)} encerradas pelas empresas` : "",
                    `${fmt(r.fila)} na sua fila`,
                  ]
                : [];
              setMsg({
                tone: r.errors?.length && !r.scanned ? "danger" : "ok",
                text: [parts.filter(Boolean).join(" · "), r.errors?.join("; ")].filter(Boolean).join(" — "),
              });
            } catch {
              setMsg({ tone: "danger", text: "A busca falhou. Tente de novo em alguns minutos." });
            }
          })
        }
        className={btn("primary", "md")}
      >
        {pending ? <Spinner /> : <Icon name="search" />}
        {pending ? "Buscando e avaliando… (1-2 min)" : "Buscar vagas agora"}
      </button>
      <p aria-live="polite" className={`text-sm ${msg?.tone === "danger" ? "text-danger" : "text-muted"}`}>
        {msg?.text ?? (disabled ? hint : "")}
      </p>
    </div>
  );
}

type ActionDef = {
  k: string;
  v: Parameters<typeof btn>[0];
  icon: IconName;
  label: string;
  busyLabel?: string;
  fn: () => Promise<void>;
};

export function JobActions({ id, status }: { id: string; status: string }) {
  const [pending, start] = useTransition();
  const [busy, setBusy] = useState<string | null>(null);
  const [err, setErr] = useState("");
  const [done, setDone] = useState<string | null>(null);

  const back: ActionDef = { k: "bk", v: "ghost", icon: "undo", label: "Voltar para a fila", fn: () => setJobStatus(id, "avaliada") };
  const actions: ActionDef[] =
    status === "avaliada"
      ? [
          { k: "ap", v: "success", icon: "check", label: "Aprovar", fn: () => approveJob(id) },
          { k: "rj", v: "ghost", icon: "x", label: "Descartar", fn: () => setJobStatus(id, "rejeitada") },
        ]
      : status === "aprovada"
        ? [{ k: "en", v: "primary", icon: "check", label: "Marcar como enviada", fn: () => setJobStatus(id, "enviada") }, back]
        : [back];

  // resposta imediata: mostra o resultado antes do servidor terminar (volta atrás se der erro)
  const DONE: Record<string, string> = { ap: "Aprovada ✓ — está na aba Aprovadas", rj: "Descartada", en: "Marcada como enviada ✓", bk: "De volta à fila" };
  if (done)
    return (
      <p role="status" className="text-sm font-medium text-ok">
        {DONE[done]}
      </p>
    );

  return (
    <div className="flex flex-wrap items-center gap-2">
      {actions.map((a) => (
        <button
          key={a.k}
          disabled={pending}
          onClick={() => {
            // confirmação na hora do clique (fora da transição, que só renderiza quando o servidor termina)
            setErr("");
            setDone(a.k);
            start(async () => {
              setBusy(a.k);
              try {
                await a.fn();
              } catch {
                setDone(null);
                setErr("Não foi possível concluir. Tente de novo.");
              } finally {
                setBusy(null);
              }
            });
          }}
          className={btn(a.v, "sm")}
        >
          {busy === a.k ? <Spinner /> : <Icon name={a.icon} />}
          {busy === a.k && a.busyLabel ? a.busyLabel : a.label}
        </button>
      ))}
      {err && (
        <span role="alert" className="text-sm text-danger">
          {err}
        </span>
      )}
    </div>
  );
}

export function CopyButton({ text, label = "Copiar carta" }: { text: string; label?: string }) {
  const [ok, setOk] = useState(false);
  return (
    <button
      onClick={async () => {
        await navigator.clipboard.writeText(text);
        setOk(true);
        setTimeout(() => setOk(false), 1800);
      }}
      className={btn("secondary", "sm")}
    >
      <Icon name={ok ? "check" : "copy"} />
      <span aria-live="polite">{ok ? "Copiado" : label}</span>
    </button>
  );
}

export function RemoveResumeButton() {
  const [pending, start] = useTransition();
  return (
    <button
      disabled={pending}
      onClick={() => {
        if (confirm("Remover o currículo atual? O PDF e o perfil extraído serão apagados.")) start(() => removeResume());
      }}
      className={btn("danger", "sm")}
    >
      {pending ? <Spinner /> : <Icon name="trash" />}
      {pending ? "Removendo…" : "Remover currículo"}
    </button>
  );
}

/** Input de arquivo como zona de soltar, mostrando o nome escolhido. */
export function FileDrop({ hasResume }: { hasResume: boolean }) {
  const [name, setName] = useState("");
  const [over, setOver] = useState(false);
  return (
    <label
      htmlFor="resume"
      onDragOver={() => setOver(true)}
      onDragLeave={() => setOver(false)}
      onDrop={() => setOver(false)}
      className={`relative flex min-h-28 cursor-pointer flex-col items-center justify-center gap-1.5 rounded-[var(--radius-md)] border-2 border-dashed px-4 py-5 text-center transition-colors focus-within:outline-2 focus-within:outline-ring ${
        over ? "border-ink bg-ink-soft" : "border-line-strong hover:border-ink/60 hover:bg-surface-2"
      }`}
    >
      <Icon name={name ? "file" : "upload"} className="size-6 text-ink" />
      <span className="text-sm font-medium">
        {name ||
          (hasResume ? "Arraste um novo PDF ou clique para trocar" : "Arraste seu currículo em PDF ou clique para escolher")}
      </span>
      <span className="text-xs text-muted">PDF até 4 MB</span>
      <input
        id="resume"
        name="resume"
        type="file"
        accept="application/pdf"
        required
        onChange={(e) => setName(e.target.files?.[0]?.name ?? "")}
        className="absolute inset-0 cursor-pointer opacity-0"
      />
    </label>
  );
}

/** Botão destrutivo com confirmação nativa antes de chamar a server action. */
export function ConfirmButton({ action, message, label }: { action: () => Promise<void>; message: string; label: string }) {
  const [pending, start] = useTransition();
  return (
    <button
      disabled={pending}
      onClick={() => {
        if (confirm(message)) start(() => action());
      }}
      className={btn("danger", "sm")}
    >
      {pending ? <Spinner /> : <Icon name="trash" />}
      {pending ? "Removendo…" : label}
    </button>
  );
}

export function WriteLetterButton({ id }: { id: string }) {
  const [pending, start] = useTransition();
  const [err, setErr] = useState("");
  return (
    <div className="flex flex-wrap items-center gap-2">
      <button
        disabled={pending}
        onClick={() =>
          start(async () => {
            setErr("");
            try {
              await writeLetter(id);
            } catch (e) {
              setErr(e instanceof Error ? e.message : "Não foi possível escrever a carta.");
            }
          })
        }
        className={btn("secondary", "sm")}
      >
        {pending ? <Spinner /> : <Icon name="file" />}
        {pending ? "Montando carta…" : "Gerar carta"}
      </button>
      {err && (
        <span role="alert" className="text-sm text-danger">
          {err}
        </span>
      )}
    </div>
  );
}

export function PrintButton() {
  return (
    <button onClick={() => window.print()} className={btn("primary", "md")}>
      <Icon name="file" />
      Baixar PDF / imprimir
    </button>
  );
}

export function ImproveLetterButton({ id }: { id: string }) {
  const [pending, start] = useTransition();
  const [err, setErr] = useState("");
  return (
    <div className="flex flex-wrap items-center gap-2">
      <button
        disabled={pending}
        onClick={() =>
          start(async () => {
            setErr("");
            try {
              await improveLetterAI(id);
            } catch (e) {
              setErr(e instanceof Error ? e.message : "A IA está indisponível agora.");
            }
          })
        }
        className={btn("ghost", "sm")}
      >
        {pending ? <Spinner /> : <Icon name="sparkles" />}
        {pending ? "IA escrevendo e conferindo…" : "Melhorar com IA (opcional)"}
      </button>
      {err && (
        <span role="alert" className="text-sm text-danger">
          {err}
        </span>
      )}
    </div>
  );
}
