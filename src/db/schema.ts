import { pgTable, text, integer, timestamp, jsonb, boolean, serial, uuid, primaryKey, uniqueIndex } from "drizzle-orm/pg-core";

export type Preferences = {
  cargos: string[]; // ex: ["desenvolvedor backend", "engenheiro de software"]
  cidades: string[]; // ex: ["São Paulo", "Campinas"]
  modelos: ("presencial" | "hibrido" | "remoto")[];
  palavrasExcluir: string[]; // ex: ["estágio", "PJ"]
  scoreMinimo: number; // 0-100, abaixo disso a vaga é escondida da fila
  observacoes: string; // texto livre para a IA (pretensão, senioridade, etc.)
};

export type ResumeProfile = {
  nome: string;
  email: string;
  telefone: string;
  cidade: string;
  linkedin: string;
  resumo: string;
  senioridade: string;
  habilidades: string[];
  experiencias: { empresa: string; cargo: string; periodo: string; descricao: string }[];
  formacao: { instituicao: string; curso: string; periodo: string }[];
  idiomas: string[];
};

/** Dados usados para preencher formulários de candidatura. */
export type ApplyData = {
  telefone: string; // com DDD, ex.: +55 11 91234-5678
  linkedin: string;
  portfolio: string;
  cidadeEstado: string; // ex.: São Paulo, SP
  pretensaoSalarial: string; // ex.: R$ 4.500 CLT
  nivelIngles: string; // básico | intermediário | avançado | fluente
  escolaridade: string;
  disponibilidade: string; // ex.: imediata
  pcd: string; // "não" | descrição | "prefiro não informar"
  genero: string; // ou "prefiro não informar"
  raca: string; // ou "prefiro não informar"
  veiculoProprio: string;
  comoSoube: string; // ex.: LinkedIn
  outras: string; // respostas livres extras para a IA usar
};
/** Sensíveis: guardados criptografados (AES-256-GCM) em profile.applySecret. */
export type ApplySecret = { cpf: string; nascimento: string; endereco: string; cep: string };

export const users = pgTable("users", {
  id: uuid("id").primaryKey().defaultRandom(),
  email: text("email").notNull().unique(), // sempre minúsculo
  name: text("name").notNull(),
  passwordHash: text("password_hash").notNull(),
  role: text("role").$type<"admin" | "user">().notNull().default("user"),
  // incrementa ao trocar senha/sair de todos: invalida sessões antigas
  sessionVersion: integer("session_version").notNull().default(1),
  termsAcceptedAt: timestamp("terms_accepted_at"),
  lastLoginAt: timestamp("last_login_at"),
  lastSeenAt: timestamp("last_seen_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export type EventType =
  | "candidatura_auto"
  | "candidatura_atencao"
  | "cadastro"
  | "login"
  | "upload_cv"
  | "remover_cv"
  | "sugestao"
  | "salvar_preferencias"
  | "busca"
  | "aprovar"
  | "descartar"
  | "enviada";

/** Registro de uso (painel do admin e limites diários). Apagado junto com a conta. */
export const events = pgTable("events", {
  id: serial("id").primaryKey(),
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  type: text("type").$type<EventType>().notNull(),
  meta: jsonb("meta").$type<Record<string, unknown>>(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

/** Links de uso único: convite de cadastro ou redefinição de senha. Guardamos só o hash do token. */
export const invites = pgTable("invites", {
  tokenHash: text("token_hash").primaryKey(),
  kind: text("kind").$type<"invite" | "reset">().notNull(),
  email: text("email"), // convite: e-mail sugerido (opcional)
  userId: uuid("user_id").references(() => users.id, { onDelete: "cascade" }), // reset: dono
  createdBy: uuid("created_by").references(() => users.id, { onDelete: "set null" }),
  note: text("note"),
  expiresAt: timestamp("expires_at").notNull(),
  usedAt: timestamp("used_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const profile = pgTable("profile", {
  userId: uuid("user_id")
    .primaryKey()
    .references(() => users.id, { onDelete: "cascade" }),
  resumeText: text("resume_text"),
  resumePdfBase64: text("resume_pdf_base64"),
  data: jsonb("data").$type<ResumeProfile>(),
  preferences: jsonb("preferences").$type<Preferences>(),
  lastRunAt: timestamp("last_run_at"),
  applyData: jsonb("apply_data").$type<ApplyData>(),
  applySecret: text("apply_secret"), // ApplySecret criptografado
  autoApply: boolean("auto_apply").notNull().default(false), // consentimento: candidatar sozinho ao aprovar
  updatedAt: timestamp("updated_at").defaultNow(),
});

/** Tokens da extensão do Chrome (guardamos só o hash). */
export const apiTokens = pgTable("api_tokens", {
  tokenHash: text("token_hash").primaryKey(),
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  lastUsedAt: timestamp("last_used_at"),
});

export type SourceKind = "greenhouse" | "lever" | "ashby" | "smartrecruiters" | "gupy";

export const sources = pgTable(
  "sources",
  {
    id: serial("id").primaryKey(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    kind: text("kind").$type<SourceKind>().notNull(),
    slug: text("slug").notNull(),
    name: text("name").notNull(),
    enabled: boolean("enabled").notNull().default(true),
  },
  (t) => [uniqueIndex("sources_user_kind_slug").on(t.userId, t.kind, t.slug)],
);

export type JobStatus = "nova" | "avaliada" | "aprovada" | "rejeitada" | "enviada";
/**
 * servidor: robô do servidor vai tentar | enviando: em andamento | extensao: aguardando a extensão do Chrome
 * atencao: precisa da pessoa (ver applyNote) | manual: site não permite robô (LinkedIn, Catho...)
 */
export type ApplyState = "servidor" | "enviando" | "extensao" | "atencao" | "manual";

export const jobs = pgTable(
  "jobs",
  {
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  id: text("id").notNull(), // `${source}:${externalId}` (único por usuário)
  source: text("source").notNull(), // greenhouse | lever | adzuna
  company: text("company").notNull(),
  title: text("title").notNull(),
  location: text("location").notNull().default(""),
  workplace: text("workplace").notNull().default(""),
  url: text("url").notNull(),
  applyUrl: text("apply_url").notNull(),
  description: text("description").notNull().default(""),
  postedAt: timestamp("posted_at"),
  fetchedAt: timestamp("fetched_at").defaultNow().notNull(),
  score: integer("score"),
  scoreReason: text("score_reason"),
  gaps: text("gaps"),
  status: text("status").$type<JobStatus>().notNull().default("nova"),
  coverLetter: text("cover_letter"),
  appliedAt: timestamp("applied_at"),
  // empresa+título normalizados: a mesma vaga vinda de fontes diferentes entra uma vez só
  dedupKey: text("dedup_key"),
  // a empresa tirou a vaga do ar (conferido a cada busca no site de carreiras); some da fila
  closedAt: timestamp("closed_at"),
  deadline: text("deadline"), // último dia de inscrição (AAAA-MM-DD), quando a plataforma informa
  letterNote: text("letter_note"), // o que a trava anti-invenção corrigiu na carta
  // candidatura automática
  applyState: text("apply_state").$type<ApplyState>(),
  applyNote: text("apply_note"),
  applyTriedAt: timestamp("apply_tried_at"),
  applyShot: text("apply_shot"), // print do formulário enviado (jpeg base64), comprovante
  },
  (t) => [primaryKey({ columns: [t.userId, t.id] }), uniqueIndex("jobs_user_dedup").on(t.userId, t.dedupKey)],
);

export type Job = typeof jobs.$inferSelect;
export type NewJob = typeof jobs.$inferInsert;

export type User = typeof users.$inferSelect;
