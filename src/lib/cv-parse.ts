import "server-only";
import { extractText, getDocumentProxy } from "unpdf";
import type { ResumeProfile } from "@/db/schema";

/**
 * Leitura do currículo SEM IA (grátis, ilimitada). Usada quando o Gemini não está disponível.
 * É uma leitura aproximada: a pessoa confere e corrige os campos no Perfil.
 */

const norm = (s: string) =>
  s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .trim();

const SECTIONS: [keyof Sections, RegExp][] = [
  ["resumo", /^(resumo( profissional)?|perfil( profissional)?|sobre( mim)?|objetivo( profissional)?|summary|profile|about)$/],
  ["experiencia", /^(experiencias?( profissional(is)?)?|historico profissional|experience|work experience|employment)$/],
  ["formacao", /^(formacao( academica)?|educacao|escolaridade|education|academic)$/],
  ["habilidades", /^(habilidades|competencias( tecnicas)?|conhecimentos( tecnicos)?|skills|ferramentas|tecnologias|hard skills)$/],
  ["idiomas", /^(idiomas|linguas|languages)$/],
  ["cursos", /^(cursos( complementares)?|certificacoes|certificados|certifications|courses)$/],
];
type Sections = { topo: string[]; resumo: string[]; experiencia: string[]; formacao: string[]; habilidades: string[]; idiomas: string[]; cursos: string[] };

const MES = "(jan|fev|mar|abr|mai|jun|jul|ago|set|out|nov|dez|january|february|march|april|may|june|july|august|september|october|november|december|jan|feb|apr|aug|sep|oct|dec)[a-z]*\\.?";
const DATE = `((${MES}\\s*(de\\s*)?)?\\d{4}|\\d{2}/\\d{4})`;
const RANGE = new RegExp(`${DATE}\\s*(–|-|—|a|até|to)\\s*(${DATE}|atual|presente|o momento|hoje|current|present)`, "i");

function split(text: string): Sections {
  const out: Sections = { topo: [], resumo: [], experiencia: [], formacao: [], habilidades: [], idiomas: [], cursos: [] };
  let cur: keyof Sections = "topo";
  for (const raw of text.split(/\n/)) {
    const line = raw.trim();
    if (!line) continue;
    const key = SECTIONS.find(([, re]) => re.test(norm(line).replace(/[:•]/g, "").trim()))?.[0];
    if (key) {
      cur = key;
      continue;
    }
    out[cur].push(line);
  }
  return out;
}

const cleanSkill = (s: string) =>
  s
    .replace(/\(([^)]*\d[^)]*|em formacao|em formação)\)/gi, "") // remove "(2 anos)", "(em formação)"
    .replace(/\s+/g, " ")
    .trim();

function senioridadeFrom(text: string, starts: number[]): string {
  const t = norm(text);
  if (/\bestagi(o|ario|aria)\b/.test(t) && !/\b(analista|desenvolvedor|engenheiro)\b/.test(t)) return "estágio";
  if (/\b(gerente|head|diretor|coordenador)\b/.test(t)) return "gestão";
  if (/\b(senior|sr\.?)\b/.test(t)) return "sênior";
  if (/\bpleno\b/.test(t)) return "pleno";
  if (/\b(junior|jr\.?|trainee|assistente|auxiliar)\b/.test(t)) return "júnior"; // nível escrito vale mais que a conta de anos
  const first = starts.length ? Math.min(...starts) : null;
  const anos = first ? new Date().getFullYear() - first : 0;
  if (anos >= 6) return "sênior";
  if (anos >= 3) return "pleno";
  return "júnior";
}

export async function parseResumeLocal(pdfBase64: string): Promise<ResumeProfile> {
  const pdf = await getDocumentProxy(new Uint8Array(Buffer.from(pdfBase64, "base64")));
  const { text } = await extractText(pdf, { mergePages: true });
  const s = split(text);
  const all = text;

  const email = all.match(/[\w.+-]+@[\w-]+\.[\w.]+/)?.[0] ?? "";
  const telefone = all.match(/(\+?55\s?)?\(?\d{2}\)?\s?9?\d{4}[-\s]?\d{4}/)?.[0]?.trim() ?? "";
  const linkedin = all.match(/(https?:\/\/)?(www\.)?linkedin\.com\/in\/[\w-]+\/?/i)?.[0] ?? "";
  const nome = s.topo.find((l) => !/@|\d|linkedin|http/i.test(l) && l.split(/\s+/).length <= 6) ?? "";
  const cidade =
    all.match(/([A-ZÀ-Ý][a-zà-ÿ]+(?:[ ](?:de|do|da|dos|das)?[ ]?[A-ZÀ-Ý][a-zà-ÿ]+)*)[ \t]*[-,/][ \t]*(SP|RJ|MG|PR|SC|RS|BA|PE|CE|DF|GO|ES|PA|AM|MA|MT|MS|PB|RN|AL|PI|SE|RO|TO|AC|AP|RR|Brasil)\b/)?.[0] ?? "";

  // bullets (•) costumam ser as realizações; o PDF pode trazê-los fora de ordem (duas colunas)
  const bullets = all
    .split("•")
    .map((b) => b.replace(/\s+/g, " ").trim())
    .filter((b) => b.length > 40 && /[a-z]/.test(b) && !/\(\d+\+? ?(anos?|meses)\)/i.test(b) && !/previs[aã]o de formatura/i.test(b));

  const experiencias: ResumeProfile["experiencias"] = [];
  const starts: number[] = [];
  for (let i = 0; i < s.experiencia.length; i++) {
    const line = s.experiencia[i];
    const r = line.match(RANGE);
    if (!r) {
      if (experiencias.length) experiencias[experiencias.length - 1].descricao += (experiencias[experiencias.length - 1].descricao ? " " : "") + line;
      continue;
    }
    const y = r[0].match(/\d{4}/);
    if (y) starts.push(Number(y[0]));
    const rest = line.replace(r[0], "").replace(/^[\s|·,–-]+/, "").trim() || s.experiencia[i + 1] || "";
    const [cargo, empresa] = rest.split(/\s*[,|·–—]\s*|\s+-\s+|\s+na\s+|\s+at\s+/);
    experiencias.push({ cargo: (cargo ?? "").trim(), empresa: (empresa ?? "").trim(), periodo: r[0].trim(), descricao: "" });
  }
  // realizações soltas vão para a experiência mais recente, se ela não tiver descrição
  const relevantes = bullets.filter((b) => /^(automatiz|cri|estrutur|desenvolv|implement|reduz|aument|lider|gerenc|atuei|atuo|respons|realiz|elabor|monitor|configur|suport|analis|implant|otimiz|padroniz)/i.test(b));
  if (experiencias.length && !experiencias[0].descricao && relevantes.length) experiencias[0].descricao = relevantes.join(" ");

  const formacao: ResumeProfile["formacao"] = [];
  for (let i = 0; i < s.formacao.length; i++) {
    const line = s.formacao[i];
    const r = line.match(RANGE);
    const rest = (r ? line.replace(r[0], "") : line).replace(/^[\s|·,–-]+/, "").trim();
    if (!r && formacao.length) {
      formacao[formacao.length - 1].instituicao += ` ${rest}`;
      continue;
    }
    const [curso, ...inst] = rest.split(/\s*,\s*/);
    formacao.push({ curso: curso ?? "", instituicao: inst.join(", ").replace(/\s*·.*$/, ""), periodo: r?.[0]?.trim() ?? "" });
  }

  // habilidades: junta as linhas (o PDF quebra "Python (9\nmeses)"), tira rótulos de categoria e frases de realização
  let skillText = s.habilidades.join(" ").replace(/\s+/g, " ");
  for (const b of bullets) skillText = skillText.split(b).join(" ");
  skillText = skillText
    .replace(/\b[A-ZÀ-Ý][\wÀ-ÿ]*\s*&\s*[A-ZÀ-Ý][\wÀ-ÿ]*/g, " • ") // "Linguagens & Desenvolvimento"
    .replace(/\b(Competências|Habilidades)\s+(Complementares|Comportamentais|Técnicas)\b/gi, " • ")
    .replace(/Especializações:\s*/gi, " • ")
    .replace(/Previsão de formatura[^•]*/gi, " ");
  const habilidades = [
    ...new Set(
      skillText
        .split(/•|;|\||,(?![^(]*\))/)
        .flatMap((x) => (/\be\s+[A-ZÀ-Ý]/.test(x) && x.length > 30 ? x.split(/\s+e\s+(?=[A-ZÀ-Ý])/) : [x]))
        .map(cleanSkill)
        .map((x) => x.replace(/[.]$/, "").trim())
        .filter((x) => x.length > 1 && x.length < 50 && /^[A-ZÀ-Ý0-9]/.test(x) && x.split(" ").length <= 6),
    ),
  ].slice(0, 60);

  const resumo = s.resumo.join(" ").replace(/\s+/g, " ").trim() || s.topo.slice(1, 2).join(" ");
  const idiomas = s.idiomas.flatMap((l) => l.split(/•|,|;/)).map((x) => x.trim()).filter((x) => x && x.length < 50);

  return {
    nome,
    email,
    telefone,
    cidade,
    linkedin,
    resumo,
    senioridade: senioridadeFrom(`${s.topo.join(" ")} ${experiencias.map((e) => e.cargo).join(" ")}`, starts),
    habilidades,
    experiencias,
    formacao,
    idiomas,
  };
}
