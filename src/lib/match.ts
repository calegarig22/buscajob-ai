import type { Job, ResumeProfile } from "@/db/schema";
import { CLAIMS, has, norm } from "./truth";

/**
 * Casa currículo × vaga sem IA. Tudo que sai daqui é TEXTO DO PRÓPRIO CURRÍCULO, só reordenado/selecionado:
 * por construção, nada é inventado.
 */

export type Match = {
  skillsRelevant: string[]; // habilidades do currículo que a vaga cita (na ordem de relevância)
  skillsOther: string[];
  experiences: { empresa: string; cargo: string; periodo: string; bullets: { text: string; hit: boolean }[]; hits: number }[];
  highlights: { text: string; empresa: string }[]; // frases do currículo mais ligadas à vaga
  keywordsHave: string[]; // termos da vaga que o currículo tem
  keywordsMissing: string[]; // termos da vaga que o currículo não tem
};

const sentences = (t: string) =>
  t
    .split(/(?<=[.!?;])\s+|\n+|\s+[•·▪◦-]\s+/)
    .map((s) => s.replace(/^[•·▪◦\-–\s]+/, "").trim())
    .filter((s) => s.length > 12);

/** Palavras "de conteúdo" da vaga (para pontuar frases do currículo). */
function jobTerms(jobText: string): Set<string> {
  const stop = new Set(
    "a o e de da do das dos em no na nos nas para por com sem um uma uns umas que se ao aos as os ou mais muito como sua seu suas seus nossa nosso the and of to in for with on at by from you your our we will are is be this that vaga empresa time area trabalho experiencia conhecimento conhecimentos requisitos atividades responsabilidades".split(
      " ",
    ),
  );
  return new Set(
    norm(jobText)
      .split(/[^a-z0-9+#]+/)
      .filter((w) => w.length > 3 && !stop.has(w)),
  );
}

export function matchJob(p: ResumeProfile, job: Pick<Job, "title" | "description">): Match {
  const jobText = norm(`${job.title}\n${job.description}`);
  const terms = jobTerms(`${job.title}\n${job.description}`);
  const titleTerms = jobTerms(job.title);

  const skillHit = (s: string) => has(jobText, s) || norm(s).split(/[()/,]/).some((x) => x.trim().length > 2 && has(jobText, x));
  const skillsRelevant = p.habilidades.filter(skillHit);
  const skillsOther = p.habilidades.filter((s) => !skillsRelevant.includes(s));

  const scoreSentence = (s: string) => {
    const words = norm(s).split(/[^a-z0-9+#]+/);
    return (
      words.filter((w) => terms.has(w)).length +
      2 * words.filter((w) => titleTerms.has(w)).length +
      3 * skillsRelevant.filter((k) => has(norm(s), k)).length
    );
  };

  // ordem cronológica das experiências fica como está (recrutador espera isso); dentro de cada uma, frases relevantes primeiro
  const experiences = p.experiencias.map((e) => {
    const bs = sentences(e.descricao).map((text) => ({ text, s: scoreSentence(text) }));
    const sorted = [...bs].sort((a, b) => b.s - a.s);
    return {
      empresa: e.empresa,
      cargo: e.cargo,
      periodo: e.periodo,
      bullets: sorted.map((b) => ({ text: b.text, hit: b.s >= 3 })),
      hits: bs.reduce((n, b) => n + b.s, 0),
    };
  });

  const highlights = experiences
    .flatMap((e) => e.bullets.map((b) => ({ text: b.text, empresa: e.empresa, s: scoreSentence(b.text) })))
    .filter((h) => h.s >= 4)
    .sort((a, b) => b.s - a.s)
    .slice(0, 3)
    .map(({ text, empresa }) => ({ text, empresa }));

  const cv = norm([p.resumo, p.habilidades.join(" "), p.experiencias.map((e) => e.descricao).join(" ")].join(" "));
  const asked = CLAIMS.filter((c) => has(jobText, c));
  return {
    skillsRelevant,
    skillsOther,
    experiences,
    highlights,
    keywordsHave: asked.filter((c) => has(cv, c)),
    keywordsMissing: asked.filter((c) => !has(cv, c)),
  };
}

/**
 * Carta montada só com fatos do currículo (sem IA, grátis, ilimitada).
 * Lacunas aparecem como interesse em aprender, nunca como experiência.
 */
// Como escrever termos técnicos (siglas e nomes próprios)
const DISPLAY: Record<string, string> = {
  aws: "AWS", sap: "SAP", "power bi": "Power BI", soc: "SOC", siem: "SIEM", sql: "SQL", nosql: "NoSQL", gcp: "GCP",
  azure: "Azure", git: "Git", github: "GitHub", jira: "Jira", itil: "ITIL", cobit: "COBIT", lgpd: "LGPD", nist: "NIST",
  "iso 27001": "ISO 27001", totvs: "TOTVS", rpa: "RPA", "power automate": "Power Automate", splunk: "Splunk",
  firewall: "firewall", linux: "Linux", python: "Python", java: "Java", excel: "Excel", docker: "Docker",
  kubernetes: "Kubernetes", terraform: "Terraform", scrum: "Scrum", kanban: "Kanban", salesforce: "Salesforce",
  "ingles fluente": "inglês fluente", "ingles avancado": "inglês avançado", "pos-graduacao": "pós-graduação",
};
export const pretty = (t: string) => DISPLAY[t] ?? t;

export function localCoverLetter(p: ResumeProfile, job: Pick<Job, "title" | "company" | "description">): string {
  const m = matchJob(p, job);
  const title = job.title.trim().replace(/[.\s]+$/, "");
  const lower = (s: string) => s.charAt(0).toLowerCase() + s.slice(1);
  const strip = (s: string) => s.replace(/[.;:]+$/, "");
  const atual = p.experiencias[0];
  const form = p.formacao[0];
  const resumo = (p.resumo.split(/(?<=[.!?])\s+/)[0] ?? "").trim();

  const parags: string[] = [];
  parags.push(`Olá, equipe de recrutamento da ${job.company}.`);
  parags.push(
    [`Quero me candidatar à vaga de ${title}.`, resumo && (/[.!?]$/.test(resumo) ? resumo : resumo + ".")]
      .filter(Boolean)
      .join(" "),
  );
  if (m.highlights.length) {
    const hs = m.highlights.slice(0, 2).map((h) => `na ${h.empresa}, ${lower(strip(h.text))}`);
    parags.push(`Na minha trajetória, destaco o que mais se conecta com a vaga: ${hs.join("; e ")}.`);
  } else if (atual) {
    parags.push(`Minha experiência mais recente é como ${atual.cargo} na ${atual.empresa}.`);
  }
  if (m.skillsRelevant.length)
    parags.push(`Entre os requisitos da vaga, trabalho com ${m.skillsRelevant.slice(0, 6).join(", ")}.`);
  if (form?.curso) parags.push(`Minha formação: ${form.curso}${form.instituicao ? `, ${form.instituicao}` : ""}${form.periodo ? ` (${form.periodo})` : ""}.`);
  if (m.keywordsMissing.length)
    parags.push(
      `Sobre ${m.keywordsMissing.slice(0, 2).map(pretty).join(" e ")}, ainda não tenho experiência prática, e tenho interesse em aprender e me desenvolver nesses pontos.`,
    );
  parags.push("Fico à disposição para conversar.");
  parags.push(["Atenciosamente,", p.nome, [p.email, p.telefone].filter(Boolean).join(" · ")].filter(Boolean).join("\n"));
  return parags.join("\n\n");
}
