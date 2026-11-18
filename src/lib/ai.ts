import { GoogleGenAI, ApiError } from "@google/genai";
import { z } from "zod";
import type { Job, Preferences, ResumeProfile } from "@/db/schema";

// trim: chave colada via pbpaste/painel pode vir com quebra de linha
const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY?.trim() });
const MODEL = process.env.GEMINI_MODEL || "gemini-3.6-flash";

/** Chama o Gemini pedindo JSON validado pelo schema Zod. Repete em 429/5xx (limites do nível gratuito). */
async function generateJson<T extends z.ZodType>(
  schema: T,
  contents: Parameters<typeof ai.models.generateContent>[0]["contents"],
  systemInstruction?: string,
): Promise<z.infer<T>> {
  for (let attempt = 0; ; attempt++) {
    try {
      const res = await ai.models.generateContent({
        model: MODEL,
        contents,
        config: {
          systemInstruction,
          responseMimeType: "application/json",
          responseJsonSchema: z.toJSONSchema(schema),
        },
      });
      return schema.parse(JSON.parse(res.text ?? ""));
    } catch (e) {
      const retryable = e instanceof ApiError && (e.status === 429 || e.status >= 500);
      if (!retryable || attempt >= 3) throw e;
      await new Promise((r) => setTimeout(r, 2000 * 2 ** attempt));
    }
  }
}

const ProfileSchema = z.object({
  nome: z.string(),
  email: z.string(),
  telefone: z.string(),
  cidade: z.string(),
  linkedin: z.string(),
  resumo: z.string(),
  senioridade: z.string(),
  habilidades: z.array(z.string()),
  experiencias: z.array(
    z.object({ empresa: z.string(), cargo: z.string(), periodo: z.string(), descricao: z.string() }),
  ),
  formacao: z.array(z.object({ instituicao: z.string(), curso: z.string(), periodo: z.string() })),
  idiomas: z.array(z.string()),
});

/** Lê o PDF do currículo e extrai um perfil estruturado. */
export async function parseResume(pdfBase64: string): Promise<ResumeProfile> {
  return generateJson(ProfileSchema, [
    {
      role: "user",
      parts: [
        { inlineData: { mimeType: "application/pdf", data: pdfBase64 } },
        {
          text: "Extraia o perfil profissional deste currículo. Use string vazia para campos ausentes. Não invente informações. Em 'senioridade', classifique como estágio, júnior, pleno, sênior, especialista ou gestão.",
        },
      ],
    },
  ]);
}

const ScoreSchema = z.object({
  score: z.number().int().describe("0 a 100: aderência da vaga ao candidato e às preferências"),
  motivo: z.string().describe("1-2 frases explicando a nota"),
  lacunas: z.string().describe("requisitos importantes que o candidato não atende; vazio se nenhum"),
});

/** Avalia o fit entre a vaga e o candidato. Retorna null se a chamada falhar. */
export async function scoreJob(p: ResumeProfile, prefs: Preferences, job: Job) {
  const out = await generateJson(
    ScoreSchema,
    `## Candidato\n${JSON.stringify(p)}\n\n## Preferências\n${JSON.stringify(prefs)}\n\n## Vaga\nEmpresa: ${job.company}\nTítulo: ${job.title}\nLocal: ${job.location} (${job.workplace})\n\n${job.description.slice(0, 12000)}`,
    "Você é um recrutador técnico brasileiro. Avalie com rigor: stack diferente ou local/modelo de trabalho fora das preferências derrubam a nota. Senioridade: compare o nível exigido pela vaga (título, anos de experiência pedidos, responsabilidades) com a senioridade do candidato; se a vaga exigir nível acima do dele (ex.: candidato júnior e vaga pleno/sênior/especialista, ou 3+ anos de experiência na área), a nota máxima é 40 e explique isso no motivo. 80+ só para vagas em que o candidato tem chance real.",
  );
  return { score: Math.max(0, Math.min(100, out.score)), motivo: out.motivo, lacunas: out.lacunas };
}

const LetterSchema = z.object({ carta: z.string() });

/** Gera carta de apresentação curta, em português, sem inventar experiência. */
export async function writeCoverLetter(p: ResumeProfile, prefs: Preferences, job: Job, corrigir?: string): Promise<string> {
  const out = await generateJson(
    LetterSchema,
    `Candidato: ${JSON.stringify(p)}\nObservações do candidato: ${prefs.observacoes}\n\nVaga: ${job.title} na ${job.company} (${job.location})\n\n${job.description.slice(0, 12000)}` +
      (corrigir
        ? `\n\nA versão anterior foi REPROVADA porque afirmava coisas que não estão no currículo. Não repita:\n${corrigir}`
        : ""),
    "Escreva cartas de apresentação em português do Brasil, tom profissional e direto, 150-220 palavras. Use apenas fatos do currículo; nunca invente experiência, ferramentas, certificações ou números. Estrutura: um motivo específico pela empresa/vaga; duas realizações reais do currículo ligadas aos requisitos; se faltar um requisito importante, diga com honestidade que ainda não tem e o que tem de parecido. Proibido: apaixonado, proativo, sinergia, vasta/sólida experiência, agregar valor, fora da caixa, orientado a resultados, dedicado, comprometido.",
  );
  return out.carta.trim();
}

const PrefsSchema = z.object({
  cargos: z
    .array(z.string())
    .describe("6-10 títulos de cargo para buscar, curtos, em PT e EN, usando a nomenclatura real das vagas abertas, SEMPRE no nível de senioridade do candidato ou abaixo (nunca acima)"),
  cidades: z.array(z.string()).describe("cidade do candidato e polos próximos viáveis para presencial/híbrido"),
  modelos: z.array(z.enum(["presencial", "hibrido", "remoto"])),
  palavrasExcluir: z
    .array(z.string())
    .describe("palavras de título que indicam vagas fora do perfil: áreas erradas e níveis acima do candidato (o app já bloqueia níveis acima automaticamente)"),
  scoreMinimo: z.number().int().describe("0-100; 55-70 é razoável"),
  observacoes: z.string().describe("2-4 frases para orientar a avaliação: foco, pontos fortes, o que evitar"),
});

/**
 * Sugere preferências de busca a partir do currículo e de uma amostra de títulos de vagas
 * abertas agora nas empresas monitoradas (o "mercado" real que o app enxerga).
 */
export async function suggestPreferences(p: ResumeProfile, marketTitles: string[]): Promise<Preferences> {
  const out = await generateJson(
    PrefsSchema,
    `## Candidato\n${JSON.stringify(p)}\n\n## Títulos de vagas abertas agora (amostra do mercado)\n${marketTitles.join("\n")}`,
    "Você é um consultor de carreira no Brasil. Com base no currículo e nos títulos de vagas reais, sugira preferências de busca realistas: cargos compatíveis com a senioridade e experiência do candidato (inclua cargos adjacentes onde ele tem chance real), escritos como as empresas escrevem nos títulos. O candidato busca vagas presenciais ou híbridas no Brasil. Não invente informações sobre o candidato.",
  );
  return { ...out, scoreMinimo: Math.max(0, Math.min(100, out.scoreMinimo)) };
}

/** Versão exportada do gerador de JSON (usada pelo plano de candidatura). */
export const generateJsonPublic = generateJson;
