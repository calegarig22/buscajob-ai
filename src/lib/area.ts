import type { ResumeProfile } from "@/db/schema";
import { has, norm } from "./truth";

/**
 * Áreas profissionais: uma vaga entra se o título for de uma área em que o CURRÍCULO tem evidência.
 * Amplia a busca além das palavras exatas dos cargos, sem fugir do perfil da pessoa.
 */
type Area = { key: string; label: string; title: string[]; cv: string[]; not?: string[] };

export const AREAS: Area[] = [
  {
    key: "suporte",
    label: "Suporte e infraestrutura de TI",
    title: ["ti", "t.i", "it", "suporte", "support", "service desk", "help desk", "helpdesk", "infraestrutura", "infrastructure", "sistemas", "systems", "microinformatica", "field service", "noc"],
    cv: ["suporte", "chamados", "tickets", "service desk", "help desk", "helpdesk", "windows", "linux", "active directory", "infraestrutura", "sistemas"],
    not: ["pos-venda", "pos venda", "vendas", "comercial", "nutricional", "pedagogico", "juridico"],
  },
  {
    key: "seguranca",
    label: "Segurança da informação",
    title: ["seguranca da informacao", "seguranca cibernetica", "ciberseguranca", "cybersecurity", "cyber", "security", "infosec", "appsec", "soc", "siem", "pentest", "vulnerabilidades", "vulnerability", "iam", "gestao de acessos", "identidade e acessos", "red team", "blue team"],
    cv: ["seguranca da informacao", "ciberseguranca", "cybersecurity", "defesa cibernetica", "siem", "vulnerabilidades", "pentest", "seguranca ofensiva", "seguranca web", "criptografia"],
  },
  {
    key: "grc",
    label: "GRC, compliance e riscos",
    title: ["compliance", "governanca", "governance", "grc", "riscos", "risco", "risk", "controles internos", "internal controls", "auditoria", "audit", "lgpd", "privacidade", "privacy", "protecao de dados", "pld", "kyc", "aml", "prevencao a fraude", "fraude"],
    cv: ["governanca", "compliance", "grc", "riscos", "risco", "lgpd", "iso 27001", "auditoria", "controles", "classificacao de ativos"],
    not: ["credito"],
  },
  {
    key: "automacao",
    label: "Automação e integrações",
    title: ["automacao", "automation", "rpa", "low-code", "no-code", "integracoes", "integracao", "integration", "n8n", "hiperautomacao", "ai automation"],
    cv: ["automacao", "automatizei", "automation", "n8n", "rpa", "zapier", "make", "power automate", "integracao", "apis"],
    not: ["industrial", "predial", "eletrica", "eletrotecnica", "mecatronica", "instrumentacao", "manutencao", "marketing"],
  },
  {
    key: "dados",
    label: "Dados e BI",
    title: ["dados", "data", "analytics", "bi", "business intelligence", "power bi", "sql", "indicadores"],
    cv: ["sql", "power bi", "business intelligence", "dashboards", "dados", "indicadores", "analytics", "excel"],
  },
  {
    key: "dev",
    label: "Desenvolvimento e QA",
    title: ["desenvolvedor", "desenvolvedora", "developer", "software", "programador", "frontend", "front-end", "backend", "back-end", "full stack", "fullstack", "qa", "quality assurance", "testes", "tester", "web"],
    cv: ["javascript", "typescript", "python", "java", "html", "css", "react", "node", "desenvolvimento", "programacao", "github"],
  },
  {
    key: "cloud",
    label: "Redes, cloud e DevOps",
    title: ["redes", "network", "networking", "cloud", "devops", "sre", "telecom", "datacenter"],
    cv: ["redes", "cloud", "aws", "azure", "gcp", "devops", "docker", "kubernetes", "ccna"],
  },
  {
    key: "processos",
    label: "Processos, projetos e operações de TI",
    title: ["processos", "pmo", "projetos de ti", "melhoria continua", "operacoes de ti", "it operations", "product owner", "scrum master"],
    cv: ["processos", "backlog", "scrum", "kanban", "pmo", "documentacao", "melhoria continua"],
  },
];

/** Áreas em que o currículo tem evidência (2+ termos, ou 1 termo forte nas habilidades). */
export function candidateAreas(p: ResumeProfile): Area[] {
  const cv = norm(
    [p.resumo, p.habilidades.join(" · "), p.experiencias.map((e) => `${e.cargo} ${e.descricao}`).join(" · "), p.formacao.map((f) => f.curso).join(" ")].join(" "),
  );
  const skills = norm(p.habilidades.join(" · "));
  return AREAS.filter((a) => a.cv.filter((t) => has(cv, t)).length >= 2 || a.cv.some((t) => has(skills, t)));
}

/** Área da vaga (pelo título), entre as áreas do candidato. Ignora contextos ambíguos. */
export function titleArea(title: string, areas: Area[]): Area | null {
  const t = norm(title);
  for (const a of areas) {
    if (a.not?.some((x) => has(t, x))) continue;
    if (a.key === "seguranca" && /seguranca (do trabalho|patrimonial|alimentar|de alimentos|do paciente|viaria)|sesmt|vigilan/.test(t)) continue;
    if (a.title.some((x) => has(t, x))) return a;
  }
  return null;
}
