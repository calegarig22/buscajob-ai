import { candidateAreas, titleArea } from "./area";
import type { Preferences, ResumeProfile } from "@/db/schema";
import type { FetchedJob } from "./sources/types";

/**
 * Nota local (gratuita, sem IA): compara currículo e preferências com a vaga.
 * 40% cargo · 35% habilidades · 15% senioridade · 10% local/modelo.
 */

const norm = (s: string) =>
  s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase();
const esc = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const has = (text: string, term: string) => {
  const t = norm(term).trim();
  return t.length > 1 && new RegExp(`(^|[^a-z0-9+#])${esc(t)}([^a-z0-9+#]|$)`).test(text);
};

// Palavras de cargo genéricas demais para indicar área
const GENERIC = new Set([
  "analista", "analyst", "junior", "jr", "senior", "pleno", "tecnico", "technical", "assistente", "assistant",
  "auxiliar", "associate", "especialista", "specialist", "engineer", "engenheiro", "de", "da", "do", "e", "em",
  "the", "of", "and", "i", "ii", "iii", "para", "vaga", "afirmativa", "pcd",
]);
const SYN: Record<string, string[]> = {
  seguranca: ["security", "cyber", "ciberseguranca", "cybersecurity"],
  security: ["seguranca", "cyber"],
  automacao: ["automation"], automation: ["automacao"],
  suporte: ["support", "service desk", "help desk", "helpdesk"], support: ["suporte", "service desk"],
  sistemas: ["systems"], dados: ["data"], data: ["dados"],
  governanca: ["governance", "grc"], compliance: ["conformidade"], riscos: ["risk", "risco"],
  desenvolvedor: ["developer", "dev"], developer: ["desenvolvedor"], infraestrutura: ["infrastructure", "infra"],
  redes: ["network", "networking"], informacao: ["information"],
};

// Contextos que mudam o sentido da palavra de área
const AMBIG: Record<string, string[]> = {
  seguranca: ["trabalho", "patrimonial", "sesmt", "alimentos", "alimentar", "vigilante", "vigilancia", "viaria", "portaria", "do paciente"],
  suporte: ["pos-venda", "pos venda", "posvenda", "vendas", "comercial", "nutricional"],
  automacao: ["industrial", "predial", "eletrica", "eletrotecnica"],
};
const SYN_ROOT: Record<string, string> = { security: "seguranca", cyber: "seguranca", support: "suporte", automation: "automacao" };

// Requisitos comuns em vagas: se a vaga pede e o currículo não tem, vira "lacuna"
const REQUIREMENTS = [
  "python", "java", "javascript", "typescript", "c#", ".net", "php", "go", "sql", "nosql", "excel", "excel avancado",
  "power bi", "tableau", "sap", "totvs", "salesforce", "jira", "scrum", "kanban", "itil", "cobit", "aws", "azure",
  "gcp", "linux", "windows server", "active directory", "firewall", "siem", "soc", "pentest", "iso 27001", "lgpd",
  "nist", "cissp", "comptia", "security+", "ceh", "docker", "kubernetes", "terraform", "git", "api", "n8n",
  "power automate", "rpa", "ingles avancado", "ingles fluente", "espanhol", "cnh", "ensino superior completo",
  "pos-graduacao", "mba", "crm", "erp", "vendas", "atendimento ao cliente", "logistica", "contabilidade",
];

// Se o currículo tem a chave, a vaga que pede o valor não é lacuna
const COVERS: Record<string, string[]> = {
  github: ["git"], gitlab: ["git"], "pacote office": ["excel"], office: ["excel"], "microsoft 365": ["excel"],
  "power platform": ["power automate", "power bi"], "active directory": ["windows server"], ingles: [],
};

const SENIOR_TERMS = ["senior", "sr", "especialista", "specialist", "lead", "lider", "staff", "principal", "coordenador", "gerente", "manager", "head", "diretor", "arquiteto", "architect", "consultor", "consultant", "supervisor", "supervisora", "coord", "coordenadora", "gestor", "gestora"];
const MID_TERMS = ["pleno", "pl", "mid", "intermediario", "intermediate", "ii"];
const JUNIOR_TERMS = ["junior", "jr", "trainee", "assistente", "auxiliar", "associate", "entry level", "iniciante", "i"];

function level(text: string): "estagio" | "junior" | "pleno" | "senior" | null {
  if (has(text, "estagio") || has(text, "estagiario") || has(text, "intern") || has(text, "internship")) return "estagio";
  if (SENIOR_TERMS.some((t) => has(text, t))) return "senior";
  if (MID_TERMS.some((t) => has(text, t))) return "pleno";
  if (JUNIOR_TERMS.some((t) => has(text, t))) return "junior";
  return null;
}
const RANK = { estagio: 0, junior: 1, pleno: 2, senior: 3 } as const;
function candidateLevel(s: string): keyof typeof RANK {
  const t = norm(s);
  if (/estagi|trainee/.test(t)) return "estagio";
  if (/junior/.test(t)) return "junior";
  if (/pleno/.test(t)) return "pleno";
  return "senior"; // sênior, especialista, gestão
}

export type LocalScore = { score: number; motivo: string; lacunas: string };

export function localScore(job: FetchedJob, p: ResumeProfile, prefs: Preferences): LocalScore {
  const title = norm(job.title);
  const body = norm(`${job.title}\n${job.description ?? ""}`);
  const cv = norm(
    [p.resumo, p.habilidades.join(" "), p.experiencias.map((e) => `${e.cargo} ${e.descricao}`).join(" "), p.formacao.map((f) => f.curso).join(" "), p.idiomas.join(" ")].join(" "),
  );

  // 1) cargo: palavras de área dos cargos desejados que aparecem no título
  const tokens = [
    ...new Set(
      prefs.cargos
        .flatMap((c) => norm(c).split(/[^a-z0-9+#]+/))
        .filter((t) => t.length > 2 && !GENERIC.has(t)),
    ),
  ];
  // palavra de área em contexto de outra área (ex.: "segurança do trabalho" ≠ segurança da informação)
  const ambiguous = (t: string) => (AMBIG[t] ?? AMBIG[SYN_ROOT[t] ?? ""] ?? []).some((ctx) => has(title, ctx));
  const hitWord = (w: string) => !ambiguous(w) && [w, ...(SYN[w] ?? [])].some((v) => has(title, v));
  const titleHits = tokens.filter(hitWord);
  // "cargo igual": todas as palavras de área (2 ou mais) de algum cargo desejado estão no título
  const exactCargo = prefs.cargos.some((c) => {
    const words = [...new Set(norm(c).split(/[^a-z0-9+#]+/).filter((w) => !GENERIC.has(w) && w.length > 2))];
    return words.length >= 2 && words.every(hitWord);
  });
  // cargo de uma palavra de área só (ex.: "Analista de Suporte Técnico" → suporte) que bate no título
  const singleCargo = prefs.cargos.some((c) => {
    const words = [...new Set(norm(c).split(/[^a-z0-9+#]+/).filter((w) => !GENERIC.has(w) && w.length > 2))];
    return words.length === 1 && hitWord(words[0]);
  });
  // vaga da mesma área do currículo (ex.: "Analista de Compliance" para quem tem GRC/LGPD) vale meio cargo
  const area = titleArea(job.title, candidateAreas(p));
  const cargoFit = Math.max(exactCargo ? 1 : singleCargo ? 0.75 : Math.min(1, titleHits.length / 2), area ? 0.5 : 0);

  // 2) habilidades do currículo citadas na vaga
  const skills = [...new Set(p.habilidades.map((h) => h.trim()).filter((h) => h.length > 1))];
  const skillHits = skills.filter((s) => has(body, s) || norm(s).split(/[()/,]/).some((part) => part.trim().length > 2 && has(body, part)));
  const skillFit = Math.min(1, skillHits.length / 4);

  // 3) senioridade
  const jobLevel = level(title) ?? level(norm(job.description ?? "").slice(0, 600));
  const cand = candidateLevel(p.senioridade);
  let senFit = 0.7; // vaga não diz o nível
  if (jobLevel) {
    const diff = RANK[jobLevel] - RANK[cand];
    senFit = diff === 0 ? 1 : diff === -1 ? 0.6 : diff < -1 ? 0.3 : diff === 1 ? 0.35 : 0;
  }

  // 4) local e modelo de trabalho
  const loc = norm(`${job.location} ${job.title}`);
  const cityOk = job.workplace === "remoto" || !prefs.cidades.length || prefs.cidades.some((c) => loc.includes(norm(c).split("/")[0].trim()));
  const modelOk = !prefs.modelos.length || prefs.modelos.includes(job.workplace as Preferences["modelos"][number]);
  const locFit = (cityOk ? 0.6 : 0) + (modelOk ? 0.4 : 0);

  let score = Math.round(100 * (0.4 * cargoFit + 0.35 * skillFit + 0.15 * senFit + 0.1 * locFit));
  if (jobLevel && RANK[jobLevel] - RANK[cand] >= 2) score = Math.min(score, 35); // muito acima do nível
  if (!cargoFit && skillHits.length < 2) score = Math.min(score, 40); // área diferente
  if (cargoFit < 0.75 && skillHits.length < 2) score = Math.min(score, 55); // só uma palavra em comum
  if (!exactCargo && !singleCargo && area) score = Math.min(score, 74); // só a área bate: "possível", nunca "forte"

  const covered = new Set(Object.entries(COVERS).flatMap(([k, v]) => (has(cv, k) ? v : [])));
  const gaps = REQUIREMENTS.filter(
    (r) => has(body, r) && !has(cv, r) && !covered.has(r) && !skills.some((s) => has(norm(s), r)),
  ).slice(0, 5);
  const levelTxt: Record<string, string> = { estagio: "estágio", junior: "júnior", pleno: "pleno", senior: "sênior" };
  const motivo = [
    exactCargo ? "Cargo igual ao que você busca." : singleCargo ? "Cargo na sua área." : area ? `Área do seu currículo: ${area.label}.` : titleHits.length ? `Área compatível (${titleHits.slice(0, 3).join(", ")}).` : "Cargo fora da sua busca principal.",
    skillHits.length ? `Bate com: ${skillHits.slice(0, 5).join(", ")}.` : "Poucas habilidades do seu currículo aparecem na vaga.",
    jobLevel && jobLevel !== cand ? `Vaga de nível ${levelTxt[jobLevel]} (você: ${levelTxt[cand]}).` : "",
    !cityOk ? "Fora das suas cidades." : "",
  ]
    .filter(Boolean)
    .join(" ");
  return { score, motivo, lacunas: gaps.length ? `A vaga pede: ${gaps.join(", ")}` : "" };
}
