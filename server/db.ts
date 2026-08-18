import { eq, and } from "drizzle-orm";
import { drizzle } from "drizzle-orm/better-sqlite3";
import Database from "better-sqlite3";
import fs from "fs";
import path from "path";
import { users, projects, planningStages, sourceResearch, producedContent, additionalResources, validations, chatHistory, systemPrompts, appSettings } from "../drizzle/schema";
import { ENV } from './_core/env';
import { systemPrompts as defaultSystemPrompts } from "./prompts/system-prompts";

let _db: ReturnType<typeof drizzle> | null = null;

const CREATE_TABLES_SQL = `
CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  openId TEXT UNIQUE,
  name TEXT,
  email TEXT UNIQUE,
  passwordHash TEXT,
  loginMethod TEXT,
  role TEXT NOT NULL DEFAULT 'user',
  createdAt INTEGER NOT NULL DEFAULT (unixepoch()),
  updatedAt INTEGER NOT NULL DEFAULT (unixepoch()),
  lastSignedIn INTEGER NOT NULL DEFAULT (unixepoch())
);

CREATE TABLE IF NOT EXISTS projects (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  userId INTEGER NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  status TEXT NOT NULL DEFAULT 'draft',
  currentModule TEXT NOT NULL DEFAULT 'planning',
  createdAt INTEGER NOT NULL DEFAULT (unixepoch()),
  updatedAt INTEGER NOT NULL DEFAULT (unixepoch())
);

CREATE TABLE IF NOT EXISTS planningStages (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  projectId INTEGER NOT NULL,
  theme TEXT,
  institutionalProblem TEXT,
  generalObjective TEXT,
  specificObjectives TEXT,
  targetAudience TEXT,
  methodology TEXT,
  programmaticContent TEXT,
  pedagogicalPlan TEXT,
  instructionalMatrix TEXT,
  status TEXT NOT NULL DEFAULT 'draft',
  createdAt INTEGER NOT NULL DEFAULT (unixepoch()),
  updatedAt INTEGER NOT NULL DEFAULT (unixepoch())
);

CREATE TABLE IF NOT EXISTS sourceResearch (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  projectId INTEGER NOT NULL,
  planningStageId INTEGER NOT NULL,
  topic TEXT NOT NULL,
  sources TEXT,
  bibliography TEXT,
  status TEXT NOT NULL DEFAULT 'in_progress',
  createdAt INTEGER NOT NULL DEFAULT (unixepoch()),
  updatedAt INTEGER NOT NULL DEFAULT (unixepoch())
);

CREATE TABLE IF NOT EXISTS producedContent (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  projectId INTEGER NOT NULL,
  sourceResearchId INTEGER NOT NULL,
  topic TEXT NOT NULL,
  content TEXT NOT NULL,
  pageCount INTEGER,
  hoursPerPage TEXT,
  status TEXT NOT NULL DEFAULT 'draft',
  createdAt INTEGER NOT NULL DEFAULT (unixepoch()),
  updatedAt INTEGER NOT NULL DEFAULT (unixepoch())
);

CREATE TABLE IF NOT EXISTS additionalResources (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  projectId INTEGER NOT NULL,
  producedContentId INTEGER NOT NULL,
  resourceType TEXT NOT NULL,
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'draft',
  createdAt INTEGER NOT NULL DEFAULT (unixepoch()),
  updatedAt INTEGER NOT NULL DEFAULT (unixepoch())
);

CREATE TABLE IF NOT EXISTS validations (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  projectId INTEGER NOT NULL,
  stage TEXT NOT NULL,
  validatorId INTEGER NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  comments TEXT,
  submittedAt INTEGER,
  reviewedAt INTEGER,
  createdAt INTEGER NOT NULL DEFAULT (unixepoch()),
  updatedAt INTEGER NOT NULL DEFAULT (unixepoch())
);

CREATE TABLE IF NOT EXISTS systemPrompts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  assistantType TEXT NOT NULL,
  promptContent TEXT NOT NULL,
  version INTEGER NOT NULL DEFAULT 1,
  isActive INTEGER NOT NULL DEFAULT 1,
  createdBy INTEGER NOT NULL,
  updatedBy INTEGER,
  createdAt INTEGER NOT NULL DEFAULT (unixepoch()),
  updatedAt INTEGER NOT NULL DEFAULT (unixepoch())
);

CREATE TABLE IF NOT EXISTS chatHistory (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  projectId INTEGER NOT NULL,
  userId INTEGER NOT NULL,
  module TEXT NOT NULL,
  role TEXT NOT NULL,
  message TEXT NOT NULL,
  createdAt INTEGER NOT NULL DEFAULT (unixepoch())
);

CREATE TABLE IF NOT EXISTS fileUploads (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  projectId INTEGER,
  userId INTEGER NOT NULL,
  fileName TEXT NOT NULL,
  fileType TEXT NOT NULL,
  fileSize INTEGER,
  storageKey TEXT NOT NULL,
  storageUrl TEXT,
  uploadType TEXT NOT NULL,
  createdAt INTEGER NOT NULL DEFAULT (unixepoch())
);

CREATE TABLE IF NOT EXISTS appSettings (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  geminiApiKey TEXT,
  updatedAt INTEGER NOT NULL DEFAULT (unixepoch())
);
`;

// Columns added after the initial release — SQLite has no "ADD COLUMN IF NOT EXISTS",
// so each ALTER is attempted and a "duplicate column" failure is swallowed.
const ALTER_TABLES_SQL = [
  "ALTER TABLE appSettings ADD COLUMN azureApiBase TEXT",
  "ALTER TABLE appSettings ADD COLUMN azureDeployment TEXT",
  "ALTER TABLE appSettings ADD COLUMN azureApiVersion TEXT",
  "ALTER TABLE appSettings ADD COLUMN azureApiKey TEXT",
  "ALTER TABLE appSettings ADD COLUMN azureVectorStoreId TEXT",
  "ALTER TABLE appSettings ADD COLUMN customInstructions TEXT",
  "ALTER TABLE chatHistory ADD COLUMN sources TEXT",
];

// Lazily open the local SQLite file so the tool works with zero external setup.
export async function getDb() {
  if (_db) return _db;

  try {
    fs.mkdirSync(path.dirname(ENV.sqliteFilePath), { recursive: true });
    const sqlite = new Database(ENV.sqliteFilePath);
    sqlite.pragma("journal_mode = WAL");
    sqlite.exec(CREATE_TABLES_SQL);
    for (const statement of ALTER_TABLES_SQL) {
      try {
        sqlite.exec(statement);
      } catch {
        // Column already exists — fine.
      }
    }
    _db = drizzle(sqlite);
    await seedDefaultPrompts();
  } catch (error) {
    console.warn("[Database] Failed to open local SQLite database:", error);
    _db = null;
  }

  return _db;
}

async function seedDefaultPrompts() {
  if (!_db) return;

  const existing = await _db.select().from(systemPrompts).limit(1);
  if (existing.length > 0) return;

  const owner = await getOrCreateDefaultUser();
  const createdBy = owner?.id ?? 1;

  for (const assistantType of Object.keys(defaultSystemPrompts) as Array<keyof typeof defaultSystemPrompts>) {
    await _db.insert(systemPrompts).values({
      assistantType,
      promptContent: defaultSystemPrompts[assistantType],
      version: 1,
      isActive: true,
      createdBy,
    });
  }
}

export async function getUserByOpenId(openId: string) {
  const db = await getDb();
  if (!db) return undefined;

  const result = await db.select().from(users).where(eq(users.openId, openId)).limit(1);
  return result.length > 0 ? result[0] : undefined;
}

export async function getUserByEmail(email: string) {
  const db = await getDb();
  if (!db) return undefined;

  const result = await db.select().from(users).where(eq(users.email, email)).limit(1);
  return result.length > 0 ? result[0] : undefined;
}

export async function getUserById(id: number) {
  const db = await getDb();
  if (!db) return undefined;

  const result = await db.select().from(users).where(eq(users.id, id)).limit(1);
  return result.length > 0 ? result[0] : undefined;
}

const DEFAULT_LOCAL_USER_EMAIL = "local@cocria.local";

// Used while login is disabled: every request is treated as this single local admin user.
export async function getOrCreateDefaultUser() {
  const existing = await getUserByEmail(DEFAULT_LOCAL_USER_EMAIL);
  if (existing) return existing;

  const db = await getDb();
  if (!db) return undefined;

  const result = await db.insert(users).values({
    email: DEFAULT_LOCAL_USER_EMAIL,
    name: "Usuário Local",
    loginMethod: "local",
    role: "admin",
  });

  return getUserById(Number(result.lastInsertRowid));
}

export async function createUserWithPassword(email: string, passwordHash: string, name: string) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const result = await db.insert(users).values({
    email,
    passwordHash,
    name,
    loginMethod: "email",
  });

  return getUserById(Number(result.lastInsertRowid));
}

// Project queries
export async function createProject(userId: number, title: string, description?: string) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const result = await db.insert(projects).values({
    userId,
    title,
    description,
    status: "draft",
    currentModule: "planning",
  });

  return result;
}

export async function getUserProjects(userId: number) {
  const db = await getDb();
  if (!db) return [];

  return await db.select().from(projects).where(eq(projects.userId, userId));
}

export async function getProjectById(projectId: number) {
  const db = await getDb();
  if (!db) return null;

  const result = await db.select().from(projects).where(eq(projects.id, projectId)).limit(1);
  return result.length > 0 ? result[0] : null;
}

export async function updateProjectStatus(projectId: number, status: string, currentModule: string) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  return await db.update(projects)
    .set({ status: status as any, currentModule: currentModule as any })
    .where(eq(projects.id, projectId));
}

// Planning stage queries
export async function getPlanningStage(projectId: number) {
  const db = await getDb();
  if (!db) return null;

  const result = await db.select().from(planningStages).where(eq(planningStages.projectId, projectId)).limit(1);
  return result.length > 0 ? result[0] : null;
}

export async function createOrUpdatePlanningStage(projectId: number, data: any) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const existing = await getPlanningStage(projectId);
  if (existing) {
    return await db.update(planningStages).set(data).where(eq(planningStages.projectId, projectId));
  } else {
    return await db.insert(planningStages).values({ projectId, ...data });
  }
}

// Chat history queries
export async function saveChatMessage(projectId: number, userId: number, module: string, role: string, message: string, sources?: { title: string; url: string }[]) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  return await db.insert(chatHistory).values({
    projectId,
    userId,
    module: module as any,
    role: role as any,
    message,
    sources: sources?.length ? JSON.stringify(sources) : null,
  });
}

export async function getChatHistory(projectId: number, module: string) {
  const db = await getDb();
  if (!db) return [];

  return await db.select().from(chatHistory)
    .where(and(eq(chatHistory.projectId, projectId), eq(chatHistory.module, module as any)))
    .orderBy(chatHistory.createdAt);
}

export async function deleteChatHistory(projectId: number, module: string) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  return await db.delete(chatHistory)
    .where(and(eq(chatHistory.projectId, projectId), eq(chatHistory.module, module as any)));
}

// System prompts queries
export async function getActiveSystemPrompt(assistantType: string) {
  const db = await getDb();
  if (!db) return null;

  const result = await db.select().from(systemPrompts)
    .where(and(eq(systemPrompts.assistantType, assistantType as any), eq(systemPrompts.isActive, true)))
    .orderBy(systemPrompts.version)
    .limit(1);

  return result.length > 0 ? result[0] : null;
}

export async function getSystemPromptVersions(assistantType: string) {
  const db = await getDb();
  if (!db) return [];

  return await db.select().from(systemPrompts)
    .where(eq(systemPrompts.assistantType, assistantType as any))
    .orderBy(systemPrompts.version);
}

export async function createSystemPrompt(assistantType: string, promptContent: string, createdBy: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  // Get the latest version
  const latest = await db.select().from(systemPrompts)
    .where(eq(systemPrompts.assistantType, assistantType as any))
    .orderBy(systemPrompts.version)
    .limit(1);

  const nextVersion = latest.length > 0 ? (latest[0].version || 1) + 1 : 1;

  return await db.insert(systemPrompts).values({
    assistantType: assistantType as any,
    promptContent,
    version: nextVersion,
    isActive: true,
    createdBy,
  });
}

export async function updateSystemPromptActive(promptId: number, isActive: boolean) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  return await db.update(systemPrompts).set({ isActive }).where(eq(systemPrompts.id, promptId));
}

// Validation queries
export async function createValidation(projectId: number, stage: string, validatorId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  return await db.insert(validations).values({
    projectId,
    stage: stage as any,
    validatorId,
    status: "pending",
    submittedAt: new Date(),
  });
}

export async function updateValidation(validationId: number, status: string, validatorId: number, comments?: string) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  return await db.update(validations)
    .set({ status: status as any, validatorId, comments, reviewedAt: new Date() })
    .where(eq(validations.id, validationId));
}

export async function getProjectValidations(projectId: number) {
  const db = await getDb();
  if (!db) return [];

  return await db.select().from(validations).where(eq(validations.projectId, projectId));
}

// Returns pending validations across all projects, joined with project title/description for the coordinator queue.
export async function getPendingValidations() {
  const db = await getDb();
  if (!db) return [];

  return await db.select({
    id: validations.id,
    projectId: validations.projectId,
    stage: validations.stage,
    status: validations.status,
    comments: validations.comments,
    submittedAt: validations.submittedAt,
    reviewedAt: validations.reviewedAt,
    projectTitle: projects.title,
    projectDescription: projects.description,
  })
    .from(validations)
    .innerJoin(projects, eq(validations.projectId, projects.id))
    .where(eq(validations.status, "pending"))
    .orderBy(validations.submittedAt);
}

export async function getValidationsByStatus(status: "approved" | "rejected") {
  const db = await getDb();
  if (!db) return [];

  return await db.select({
    id: validations.id,
    projectId: validations.projectId,
    stage: validations.stage,
    status: validations.status,
    comments: validations.comments,
    submittedAt: validations.submittedAt,
    reviewedAt: validations.reviewedAt,
    projectTitle: projects.title,
    projectDescription: projects.description,
  })
    .from(validations)
    .innerJoin(projects, eq(validations.projectId, projects.id))
    .where(eq(validations.status, status))
    .orderBy(validations.reviewedAt);
}

// Source research documents ("Fontes" canvas)
export async function listSourceResearch(projectId: number) {
  const db = await getDb();
  if (!db) return [];

  return await db.select().from(sourceResearch).where(eq(sourceResearch.projectId, projectId));
}

export async function createOrUpdateSourceResearch(
  id: number | null,
  projectId: number,
  planningStageId: number,
  topic: string,
  sources?: string,
  bibliography?: string,
) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  if (id) {
    await db.update(sourceResearch).set({ topic, sources, bibliography }).where(eq(sourceResearch.id, id));
    return id;
  }

  const result = await db.insert(sourceResearch).values({ projectId, planningStageId, topic, sources, bibliography });
  return Number(result.lastInsertRowid);
}

// Produced content documents ("Produção" canvas)
export async function listProducedContent(projectId: number) {
  const db = await getDb();
  if (!db) return [];

  return await db.select().from(producedContent).where(eq(producedContent.projectId, projectId));
}

export async function createOrUpdateProducedContent(
  id: number | null,
  projectId: number,
  sourceResearchId: number,
  topic: string,
  content: string,
) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  if (id) {
    await db.update(producedContent).set({ topic, content }).where(eq(producedContent.id, id));
    return id;
  }

  const result = await db.insert(producedContent).values({ projectId, sourceResearchId, topic, content });
  return Number(result.lastInsertRowid);
}

// Additional resources documents ("Recursos" canvas)
export async function listAdditionalResources(projectId: number) {
  const db = await getDb();
  if (!db) return [];

  return await db.select().from(additionalResources).where(eq(additionalResources.projectId, projectId));
}

export async function createOrUpdateAdditionalResource(
  id: number | null,
  projectId: number,
  producedContentId: number,
  resourceType: string,
  title: string,
  content: string,
) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  if (id) {
    await db.update(additionalResources).set({ title, content }).where(eq(additionalResources.id, id));
    return id;
  }

  const result = await db.insert(additionalResources).values({
    projectId,
    producedContentId,
    resourceType: resourceType as any,
    title,
    content,
  });
  return Number(result.lastInsertRowid);
}

// Builds the "upstream context" block injected into the AI system prompt: the
// approved documents from earlier stages, so each module automatically has the
// pedagogical plan / sources / produced content as input, without the user
// having to paste it back in manually.
export async function getUpstreamContext(projectId: number, module: string): Promise<string> {
  const sections: string[] = [];

  if (module === "sources" || module === "production" || module === "resources") {
    const stage = await getPlanningStage(projectId);
    if (stage?.pedagogicalPlan) {
      sections.push(`## Plano Pedagógico (Planejamento, já validado)\n${stage.pedagogicalPlan}`);
    }
  }

  if (module === "production" || module === "resources") {
    const sources = await listSourceResearch(projectId);
    for (const source of sources) {
      const body = [source.sources, source.bibliography].filter(Boolean).join("\n\n");
      if (body) {
        sections.push(`## Pesquisa de Fontes: ${source.topic}\n${body}`);
      }
    }
  }

  if (module === "resources") {
    const produced = await listProducedContent(projectId);
    for (const item of produced) {
      sections.push(`## Conteúdo Produzido: ${item.topic}\n${item.content}`);
    }
  }

  return sections.join("\n\n---\n\n");
}

// App settings (single row, id=1) — the user-provided Azure OpenAI credentials.
// Uses the Azure OpenAI v1 API surface (Responses/Files/Vector Stores), which does
// not take an `api-version` query param, so that field is no longer required.
export type AzureConfig = {
  apiBase: string;
  deployment: string;
  apiKey: string;
  vectorStoreId: string | null;
};

export async function getAzureConfig(): Promise<AzureConfig | null> {
  const db = await getDb();
  if (!db) return null;

  const row = (await db.select().from(appSettings).limit(1))[0];
  if (!row?.azureApiBase || !row.azureDeployment || !row.azureApiKey) {
    return null;
  }

  return {
    apiBase: row.azureApiBase,
    deployment: row.azureDeployment,
    apiKey: row.azureApiKey,
    vectorStoreId: row.azureVectorStoreId ?? null,
  };
}

export async function setAzureConfig(config: { apiBase: string; deployment: string; apiKey: string }) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const values = {
    azureApiBase: config.apiBase,
    azureDeployment: config.deployment,
    azureApiKey: config.apiKey,
  };

  const existing = await db.select().from(appSettings).limit(1);
  if (existing.length > 0) {
    await db.update(appSettings).set(values).where(eq(appSettings.id, existing[0].id));
  } else {
    await db.insert(appSettings).values(values);
  }
}

export async function getVectorStoreId(): Promise<string | null> {
  const db = await getDb();
  if (!db) return null;

  const row = (await db.select().from(appSettings).limit(1))[0];
  return row?.azureVectorStoreId ?? null;
}

export async function setVectorStoreId(vectorStoreId: string) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const existing = await db.select().from(appSettings).limit(1);
  if (existing.length > 0) {
    await db.update(appSettings).set({ azureVectorStoreId: vectorStoreId }).where(eq(appSettings.id, existing[0].id));
  } else {
    await db.insert(appSettings).values({ azureVectorStoreId: vectorStoreId });
  }
}

// User-defined preferences (tone, form of address, writing style) that get appended
// to every module's system prompt — mirrors Claude.ai's "Instructions for Claude".
export async function getCustomInstructions(): Promise<string> {
  const db = await getDb();
  if (!db) return "";

  const row = (await db.select().from(appSettings).limit(1))[0];
  return row?.customInstructions ?? "";
}

export async function setCustomInstructions(customInstructions: string) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const existing = await db.select().from(appSettings).limit(1);
  if (existing.length > 0) {
    await db.update(appSettings).set({ customInstructions }).where(eq(appSettings.id, existing[0].id));
  } else {
    await db.insert(appSettings).values({ customInstructions });
  }
}
