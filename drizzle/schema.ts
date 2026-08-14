import { int, sqliteTable, text } from "drizzle-orm/sqlite-core";
import { relations } from "drizzle-orm";
import { sql } from "drizzle-orm";

/**
 * Core user table backing auth flow.
 * Extend this file with additional tables as your product grows.
 * Columns use camelCase to match both database fields and generated types.
 */
export const users = sqliteTable("users", {
  /**
   * Surrogate primary key. Auto-incremented numeric value managed by the database.
   * Use this for relations between tables.
   */
  id: int("id").primaryKey({ autoIncrement: true }),
  /** Legacy Manus OAuth identifier. No longer used for auth (email/password now). */
  openId: text("openId").unique(),
  name: text("name"),
  email: text("email").unique(),
  /** scrypt hash, format "salt:hash" (hex). Null for legacy rows created before email/password auth. */
  passwordHash: text("passwordHash"),
  loginMethod: text("loginMethod"),
  role: text("role", { enum: ["user", "admin", "coordinator", "content_creator"] }).default("user").notNull(),
  createdAt: int("createdAt", { mode: "timestamp" }).default(sql`(unixepoch())`).notNull(),
  updatedAt: int("updatedAt", { mode: "timestamp" }).default(sql`(unixepoch())`).notNull(),
  lastSignedIn: int("lastSignedIn", { mode: "timestamp" }).default(sql`(unixepoch())`).notNull(),
});

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;

/**
 * Tabela de projetos de cursos
 */
export const projects = sqliteTable("projects", {
  id: int("id").primaryKey({ autoIncrement: true }),
  userId: int("userId").notNull(),
  title: text("title").notNull(),
  description: text("description"),
  status: text("status", { enum: ["draft", "awaiting_planning_validation", "planning_validated", "awaiting_sources_validation", "sources_validated", "in_production", "completed"] }).default("draft").notNull(),
  currentModule: text("currentModule", { enum: ["planning", "sources", "production", "resources", "completed"] }).default("planning").notNull(),
  createdAt: int("createdAt", { mode: "timestamp" }).default(sql`(unixepoch())`).notNull(),
  updatedAt: int("updatedAt", { mode: "timestamp" }).default(sql`(unixepoch())`).notNull(),
});

export type Project = typeof projects.$inferSelect;
export type InsertProject = typeof projects.$inferInsert;

/**
 * Tabela de etapa de planejamento pedagógico
 */
export const planningStages = sqliteTable("planningStages", {
  id: int("id").primaryKey({ autoIncrement: true }),
  projectId: int("projectId").notNull(),
  theme: text("theme"),
  institutionalProblem: text("institutionalProblem"),
  generalObjective: text("generalObjective"),
  specificObjectives: text("specificObjectives"), // JSON array
  targetAudience: text("targetAudience"),
  methodology: text("methodology"),
  programmaticContent: text("programmaticContent"), // JSON array of topics
  pedagogicalPlan: text("pedagogicalPlan"), // Full document
  instructionalMatrix: text("instructionalMatrix"), // Full document
  status: text("status", { enum: ["draft", "in_progress", "completed", "submitted_for_validation", "validated", "rejected"] }).default("draft").notNull(),
  createdAt: int("createdAt", { mode: "timestamp" }).default(sql`(unixepoch())`).notNull(),
  updatedAt: int("updatedAt", { mode: "timestamp" }).default(sql`(unixepoch())`).notNull(),
});

export type PlanningStage = typeof planningStages.$inferSelect;
export type InsertPlanningStage = typeof planningStages.$inferInsert;

/**
 * Tabela de pesquisa de fontes
 */
export const sourceResearch = sqliteTable("sourceResearch", {
  id: int("id").primaryKey({ autoIncrement: true }),
  projectId: int("projectId").notNull(),
  planningStageId: int("planningStageId").notNull(),
  topic: text("topic").notNull(),
  sources: text("sources"), // JSON array of sources
  bibliography: text("bibliography"), // Formatted bibliography
  status: text("status", { enum: ["in_progress", "completed", "submitted_for_validation", "validated", "rejected"] }).default("in_progress").notNull(),
  createdAt: int("createdAt", { mode: "timestamp" }).default(sql`(unixepoch())`).notNull(),
  updatedAt: int("updatedAt", { mode: "timestamp" }).default(sql`(unixepoch())`).notNull(),
});

export type SourceResearch = typeof sourceResearch.$inferSelect;
export type InsertSourceResearch = typeof sourceResearch.$inferInsert;

/**
 * Tabela de conteúdo produzido
 */
export const producedContent = sqliteTable("producedContent", {
  id: int("id").primaryKey({ autoIncrement: true }),
  projectId: int("projectId").notNull(),
  sourceResearchId: int("sourceResearchId").notNull(),
  topic: text("topic").notNull(),
  content: text("content").notNull(), // Full content
  pageCount: int("pageCount"),
  hoursPerPage: text("hoursPerPage"), // decimal stored as text to avoid float rounding
  status: text("status", { enum: ["draft", "in_progress", "completed", "under_review"] }).default("draft").notNull(),
  createdAt: int("createdAt", { mode: "timestamp" }).default(sql`(unixepoch())`).notNull(),
  updatedAt: int("updatedAt", { mode: "timestamp" }).default(sql`(unixepoch())`).notNull(),
});

export type ProducedContent = typeof producedContent.$inferSelect;
export type InsertProducedContent = typeof producedContent.$inferInsert;

/**
 * Tabela de recursos adicionais (roteiros, atividades, podcasts, etc)
 */
export const additionalResources = sqliteTable("additionalResources", {
  id: int("id").primaryKey({ autoIncrement: true }),
  projectId: int("projectId").notNull(),
  producedContentId: int("producedContentId").notNull(),
  resourceType: text("resourceType", { enum: ["video_script", "video_lesson", "assessment_activity", "podcast", "mind_map", "infographic"] }).notNull(),
  title: text("title").notNull(),
  content: text("content").notNull(),
  status: text("status", { enum: ["draft", "completed", "under_review"] }).default("draft").notNull(),
  createdAt: int("createdAt", { mode: "timestamp" }).default(sql`(unixepoch())`).notNull(),
  updatedAt: int("updatedAt", { mode: "timestamp" }).default(sql`(unixepoch())`).notNull(),
});

export type AdditionalResource = typeof additionalResources.$inferSelect;
export type InsertAdditionalResource = typeof additionalResources.$inferInsert;

/**
 * Tabela de validações de etapas
 */
export const validations = sqliteTable("validations", {
  id: int("id").primaryKey({ autoIncrement: true }),
  projectId: int("projectId").notNull(),
  stage: text("stage", { enum: ["planning", "sources", "production"] }).notNull(),
  validatorId: int("validatorId").notNull(),
  status: text("status", { enum: ["pending", "approved", "rejected", "changes_requested"] }).default("pending").notNull(),
  comments: text("comments"),
  submittedAt: int("submittedAt", { mode: "timestamp" }),
  reviewedAt: int("reviewedAt", { mode: "timestamp" }),
  createdAt: int("createdAt", { mode: "timestamp" }).default(sql`(unixepoch())`).notNull(),
  updatedAt: int("updatedAt", { mode: "timestamp" }).default(sql`(unixepoch())`).notNull(),
});

export type Validation = typeof validations.$inferSelect;
export type InsertValidation = typeof validations.$inferInsert;

/**
 * Tabela de prompts de sistema para cada assistente
 */
export const systemPrompts = sqliteTable("systemPrompts", {
  id: int("id").primaryKey({ autoIncrement: true }),
  assistantType: text("assistantType", { enum: ["planning", "sources", "production", "resources"] }).notNull(),
  promptContent: text("promptContent").notNull(),
  version: int("version").default(1).notNull(),
  isActive: int("isActive", { mode: "boolean" }).default(true).notNull(),
  createdBy: int("createdBy").notNull(),
  updatedBy: int("updatedBy"),
  createdAt: int("createdAt", { mode: "timestamp" }).default(sql`(unixepoch())`).notNull(),
  updatedAt: int("updatedAt", { mode: "timestamp" }).default(sql`(unixepoch())`).notNull(),
});

export type SystemPrompt = typeof systemPrompts.$inferSelect;
export type InsertSystemPrompt = typeof systemPrompts.$inferInsert;

/**
 * Tabela de histórico de chat com IA
 */
export const chatHistory = sqliteTable("chatHistory", {
  id: int("id").primaryKey({ autoIncrement: true }),
  projectId: int("projectId").notNull(),
  userId: int("userId").notNull(),
  module: text("module", { enum: ["planning", "sources", "production", "resources"] }).notNull(),
  role: text("role", { enum: ["user", "assistant", "system"] }).notNull(),
  message: text("message").notNull(),
  createdAt: int("createdAt", { mode: "timestamp" }).default(sql`(unixepoch())`).notNull(),
});

export type ChatHistory = typeof chatHistory.$inferSelect;
export type InsertChatHistory = typeof chatHistory.$inferInsert;

/**
 * Tabela de uploads de arquivos
 */
export const fileUploads = sqliteTable("fileUploads", {
  id: int("id").primaryKey({ autoIncrement: true }),
  projectId: int("projectId"),
  userId: int("userId").notNull(),
  fileName: text("fileName").notNull(),
  fileType: text("fileType").notNull(),
  fileSize: int("fileSize"),
  storageKey: text("storageKey").notNull(),
  storageUrl: text("storageUrl"),
  uploadType: text("uploadType", { enum: ["educational_proposal", "geped_manual", "reference_material", "other"] }).notNull(),
  createdAt: int("createdAt", { mode: "timestamp" }).default(sql`(unixepoch())`).notNull(),
});

export type FileUpload = typeof fileUploads.$inferSelect;
export type InsertFileUpload = typeof fileUploads.$inferInsert;

/**
 * Configurações da aplicação (linha única, id=1). Guarda as credenciais do Azure OpenAI
 * cadastradas pelo usuário via modal, para não depender de variáveis de ambiente.
 */
export const appSettings = sqliteTable("appSettings", {
  id: int("id").primaryKey({ autoIncrement: true }),
  /** @deprecated substituído pelas credenciais do Azure OpenAI abaixo. */
  geminiApiKey: text("geminiApiKey"),
  azureApiBase: text("azureApiBase"),
  azureDeployment: text("azureDeployment"),
  azureApiVersion: text("azureApiVersion"),
  azureApiKey: text("azureApiKey"),
  azureVectorStoreId: text("azureVectorStoreId"),
  /** Preferências de tom/estilo do usuário, anexadas a todo prompt de sistema (como as "Instruções personalizadas" do Claude). */
  customInstructions: text("customInstructions"),
  updatedAt: int("updatedAt", { mode: "timestamp" }).default(sql`(unixepoch())`).notNull(),
});

export type AppSettings = typeof appSettings.$inferSelect;
export type InsertAppSettings = typeof appSettings.$inferInsert;

/**
 * Relações entre tabelas
 */
export const usersRelations = relations(users, ({ many }) => ({
  projects: many(projects),
  validations: many(validations),
  systemPrompts: many(systemPrompts),
  chatHistory: many(chatHistory),
  fileUploads: many(fileUploads),
}));

export const projectsRelations = relations(projects, ({ one, many }) => ({
  user: one(users, {
    fields: [projects.userId],
    references: [users.id],
  }),
  planningStages: many(planningStages),
  sourceResearch: many(sourceResearch),
  producedContent: many(producedContent),
  additionalResources: many(additionalResources),
  validations: many(validations),
  chatHistory: many(chatHistory),
}));

export const planningStagesRelations = relations(planningStages, ({ one, many }) => ({
  project: one(projects, {
    fields: [planningStages.projectId],
    references: [projects.id],
  }),
  sourceResearch: many(sourceResearch),
}));

export const sourceResearchRelations = relations(sourceResearch, ({ one, many }) => ({
  project: one(projects, {
    fields: [sourceResearch.projectId],
    references: [projects.id],
  }),
  planningStage: one(planningStages, {
    fields: [sourceResearch.planningStageId],
    references: [planningStages.id],
  }),
  producedContent: many(producedContent),
}));

export const producedContentRelations = relations(producedContent, ({ one, many }) => ({
  project: one(projects, {
    fields: [producedContent.projectId],
    references: [projects.id],
  }),
  sourceResearch: one(sourceResearch, {
    fields: [producedContent.sourceResearchId],
    references: [sourceResearch.id],
  }),
  additionalResources: many(additionalResources),
}));

export const additionalResourcesRelations = relations(additionalResources, ({ one }) => ({
  project: one(projects, {
    fields: [additionalResources.projectId],
    references: [projects.id],
  }),
  producedContent: one(producedContent, {
    fields: [additionalResources.producedContentId],
    references: [producedContent.id],
  }),
}));

export const validationsRelations = relations(validations, ({ one }) => ({
  project: one(projects, {
    fields: [validations.projectId],
    references: [projects.id],
  }),
  validator: one(users, {
    fields: [validations.validatorId],
    references: [users.id],
  }),
}));

export const systemPromptsRelations = relations(systemPrompts, ({ one }) => ({
  creator: one(users, {
    fields: [systemPrompts.createdBy],
    references: [users.id],
  }),
}));

export const chatHistoryRelations = relations(chatHistory, ({ one }) => ({
  project: one(projects, {
    fields: [chatHistory.projectId],
    references: [projects.id],
  }),
  user: one(users, {
    fields: [chatHistory.userId],
    references: [users.id],
  }),
}));

export const fileUploadsRelations = relations(fileUploads, ({ one }) => ({
  project: one(projects, {
    fields: [fileUploads.projectId],
    references: [projects.id],
  }),
  user: one(users, {
    fields: [fileUploads.userId],
    references: [users.id],
  }),
}));
