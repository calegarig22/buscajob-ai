import type { Preferences, ResumeProfile } from "@/db/schema";
import { has, norm } from "./truth";

/**
 * Sugestão de busca SEM IA (grátis): cargos reais do currículo + títulos de vagas abertas que compartilham
 * termos de área com o currículo e cabem na senioridade da pessoa.
 */
const STOP = new Set(
  "de da do das dos e em para com a o as os the and of to in for vaga afirmativa pcd exclusiva pessoa deficiencia pessoas jr junior senior pleno sr pl i ii iii iv analista analyst assistente assistant especialista specialist tecnico tecnica engenheiro engenheira engineer coordenador gerente manager lead head trainee estagio estagiario associate intern banco talentos grupo"
    .split(" "),
);
const ABOVE: Record<string, RegExp> = {
  estagio: /\b(junior|jr|pleno|senior|sr|especialista|lead|coordenador|gerente|manager|head|ii|iii)\b/,
  junior: /\b(pleno|pl|senior|sr|especialista|specialist|lead|staff|principal|coordenador|gerente|manager|head|supervisor|ii|iii|iv)\b/,
  pleno: /\b(senior|sr|staff|principal|lead|coordenador|gerente|manager|head|diretor|iii|iv)\b/,
};

const level = (s: string) => {
  const t = norm(s);
  if (/estagi|trainee/.test(t)) return "estagio";
  if (/junior/.test(t)) return "junior";
  if (/pleno/.test(t)) return "pleno";
  return "senior";
};

export function suggestLocal(p: ResumeProfile, marketTitles: string[]): Preferences {
  const lvl = level(p.senioridade);
  const vocab = new Set(
    norm([p.resumo, p.habilidades.join(" "), p.experiencias.map((e) => `${e.cargo} ${e.descricao}`).join(" "), p.formacao.map((f) => f.curso).join(" ")].join(" "))
      .split(/[^a-z0-9+#]+/)
      .filter((w) => w.length > 3 && !STOP.has(w)),
  );

  // 1) cargos que a pessoa já teve (sem empresa), no nível dela
  const own = p.experiencias.map((e) => e.cargo.trim()).filter(Boolean);

  // 2) títulos de vagas abertas com 2+ termos de área em comum com o currículo, sem nível acima
  const above = ABOVE[lvl];
  const scored = new Map<string, number>();
  for (const t of marketTitles) {
    const clean = t.replace(/\s*[|\-–(\[].*$/, "").trim(); // tira "| Unidade X", "(Híbrido)"…
    const n = norm(clean);
    if (!clean || clean.length > 60 || (above && above.test(n))) continue;
    const words = [...new Set(n.split(/[^a-z0-9+#]+/).filter((w) => w.length > 3 && !STOP.has(w)))];
    const common = words.filter((w) => vocab.has(w)).length;
    if (common >= 2 || (common >= 1 && words.length === 1)) scored.set(clean, Math.max(scored.get(clean) ?? 0, common));
  }
  const market = [...scored.entries()].sort((a, b) => b[1] - a[1]).map(([t]) => t);

  const cargos: string[] = [];
  for (const c of [...own, ...market]) {
    if (cargos.length >= 10) break;
    if (!cargos.some((x) => norm(x) === norm(c))) cargos.push(c);
  }

  const cidade = (p.cidade.split(/[,\-–/]/)[0] ?? "").trim();
  return {
    cargos,
    cidades: cidade ? [cidade] : [],
    modelos: ["presencial", "hibrido", "remoto"],
    palavrasExcluir: [],
    scoreMinimo: 60,
    observacoes: has(norm(p.resumo), "estudante") ? "Candidato(a) em formação; priorizar vagas de entrada." : "",
  };
}
