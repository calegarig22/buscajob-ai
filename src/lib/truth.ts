import type { ResumeProfile } from "@/db/schema";

/**
 * Trava anti-invenção (sem IA, grátis): confere se um texto (carta, resposta) só usa fatos do currículo.
 * Pega ferramentas, certificações e números citados que não aparecem no currículo, e clichês de texto genérico.
 */

export const norm = (s: string) =>
  s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase();
const esc = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
export const has = (text: string, term: string) => {
  const t = norm(term).trim();
  return t.length > 1 && new RegExp(`(^|[^a-z0-9+#])${esc(t)}([^a-z0-9+#]|$)`).test(text);
};

// Ferramentas, linguagens e certificações que alguém poderia "inventar" num texto
export const CLAIMS = [
  "python", "java", "javascript", "typescript", "c#", ".net", "php", "golang", "ruby", "kotlin", "swift", "rust",
  "react", "angular", "vue", "node", "django", "spring", "sql", "nosql", "mongodb", "postgresql", "mysql", "oracle",
  "excel", "power bi", "tableau", "sap", "totvs", "salesforce", "jira", "scrum", "kanban", "itil", "cobit", "aws",
  "azure", "gcp", "google cloud", "linux", "windows server", "active directory", "firewall", "siem", "splunk",
  "qradar", "sentinel", "soc", "pentest", "nist", "iso 27001", "iso 27002", "lgpd", "gdpr", "docker", "kubernetes",
  "terraform", "ansible", "git", "github", "gitlab", "n8n", "power automate", "rpa", "uipath", "zapier", "figma",
  "cissp", "cism", "cisa", "ceh", "comptia", "security+", "network+", "ccna", "ccnp", "pmp", "itil foundation",
  "aws certified", "azure fundamentals", "az-900", "lead implementer", "ingles fluente", "ingles avancado",
  "espanhol fluente", "mba", "mestrado", "doutorado", "pos-graduacao",
];

// O que um texto "de IA" costuma ter e um recrutador detesta
export const CLICHES = [
  "apaixonad", "proativ", "sinergia", "comprovada experiencia", "vasta experiencia", "ampla experiencia",
  "solida experiencia", "fora da caixa", "agregar valor", "busco novos desafios", "orientado a resultados",
  "orientada a resultados", "perfil inovador", "ambiente dinamico", "altamente motivad", "jogador de equipe",
  "team player", "resiliente", "dedicad", "comprometid", "excelencia", "de ponta", "estado da arte",
  "me destaco", "sou a pessoa ideal", "candidato ideal", "candidata ideal", "nao medirei esforcos",
];

export type TruthIssue = { kind: "invencao" | "numero" | "cliche"; term: string; sentence: string };

/** Texto do currículo usado como fonte da verdade. */
export function cvText(p: ResumeProfile) {
  return norm(
    [
      p.resumo,
      p.senioridade,
      p.cidade,
      p.habilidades.join(" · "),
      p.experiencias.map((e) => `${e.empresa} ${e.cargo} ${e.periodo} ${e.descricao}`).join(" · "),
      p.formacao.map((f) => `${f.instituicao} ${f.curso} ${f.periodo}`).join(" · "),
      p.idiomas.join(" · "),
    ].join("\n"),
  );
}

const splitSentences = (text: string) =>
  text
    .split(/(?<=[.!?])\s+|\n+/)
    .map((s) => s.trim())
    .filter(Boolean);

/**
 * Confere o texto contra o currículo. `allowed`: termos legítimos além do currículo (ex.: a própria vaga/empresa).
 */
export function checkTruth(
  text: string,
  p: ResumeProfile,
  allowed: string[] = [],
  quoted: string[] = [], // textos repetidos literalmente (título da vaga, empresa): não são afirmações
): TruthIssue[] {
  const cv = cvText(p);
  const ok = norm(allowed.join(" · "));
  const quotes = quoted.map((q) => norm(q).replace(/[.!?\s]+$/, "").trim()).filter((q) => q.length > 2);
  const issues: TruthIssue[] = [];
  for (const sentence of splitSentences(text)) {
    let s = norm(sentence);
    for (const q of quotes) s = s.split(q).join(" ");
    for (const c of CLAIMS) {
      // citar uma ferramenta que a VAGA pede, dizendo que é interesse/aprendizado, é honesto; afirmar que tem, não
      if (has(s, c) && !has(cv, c) && !(has(ok, c) && /aprend|estud|desenvolver|interesse|ainda nao|conhecer/.test(s)))
        issues.push({ kind: "invencao", term: c, sentence });
    }
    for (const m of s.matchAll(/\b(\d+[.,]?\d*)\s*(%|anos?|meses|mil|milhoes|k\b|pessoas|clientes|projetos)/g)) {
      const num = m[1].replace(",", ".");
      if (!cv.includes(m[1]) && !cv.includes(num)) issues.push({ kind: "numero", term: m[0], sentence });
    }
    for (const c of CLICHES) if (s.includes(c)) issues.push({ kind: "cliche", term: c, sentence });
  }
  return issues;
}

/** Remove as frases com invenção ou número sem base. Clichês ficam a cargo de quem gerou. */
export function stripInventions(text: string, issues: TruthIssue[]) {
  const bad = new Set(issues.filter((i) => i.kind !== "cliche").map((i) => i.sentence));
  return text
    .split(/\n/)
    .map((para) =>
      splitSentences(para)
        .filter((s) => !bad.has(s))
        .join(" "),
    )
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

export function describeIssues(issues: TruthIssue[]) {
  const inv = [...new Set(issues.filter((i) => i.kind === "invencao").map((i) => i.term))];
  const num = [...new Set(issues.filter((i) => i.kind === "numero").map((i) => i.term))];
  const parts = [];
  if (inv.length) parts.push(`citava ${inv.join(", ")}, que não está no seu currículo`);
  if (num.length) parts.push(`tinha números sem base no currículo (${num.join(", ")})`);
  return parts.join(" e ");
}
