import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { protectedProcedure, router } from "../_core/trpc";
import {
  getPlanningStage,
  createOrUpdatePlanningStage,
  listSourceResearch,
  createOrUpdateSourceResearch,
  listProducedContent,
  createOrUpdateProducedContent,
  listAdditionalResources,
  createOrUpdateAdditionalResource,
} from "../db";

// Unified "canvas document" shape shown to the frontend, regardless of which
// module-specific table it is actually backed by.
type CanvasDocument = {
  id: number;
  title: string;
  content: string;
  updatedAt: Date;
};

const MODULE = z.enum(["planning", "sources", "production", "resources"]);
type ModuleType = z.infer<typeof MODULE>;

async function listDocumentsForModule(projectId: number, module: ModuleType): Promise<CanvasDocument[]> {
  if (module === "planning") {
    const stage = await getPlanningStage(projectId);
    if (!stage || !stage.pedagogicalPlan) return [];
    return [{
      id: stage.id,
      title: "Plano Pedagógico",
      content: stage.pedagogicalPlan,
      updatedAt: stage.updatedAt,
    }];
  }

  if (module === "sources") {
    const rows = await listSourceResearch(projectId);
    return rows.map(row => ({
      id: row.id,
      title: row.topic,
      content: row.sources ?? "",
      updatedAt: row.updatedAt,
    }));
  }

  if (module === "production") {
    const rows = await listProducedContent(projectId);
    return rows.map(row => ({
      id: row.id,
      title: row.topic,
      content: row.content,
      updatedAt: row.updatedAt,
    }));
  }

  const rows = await listAdditionalResources(projectId);
  return rows.map(row => ({
    id: row.id,
    title: row.title,
    content: row.content,
    updatedAt: row.updatedAt,
  }));
}

export const documentsRouter = router({
  list: protectedProcedure
    .input(z.object({ projectId: z.number(), module: MODULE }))
    .query(async ({ input }) => listDocumentsForModule(input.projectId, input.module)),

  // Consolidated view: every document from every module of the project, grouped by module.
  listAll: protectedProcedure
    .input(z.object({ projectId: z.number() }))
    .query(async ({ input }) => {
      const modules: ModuleType[] = ["planning", "sources", "production", "resources"];
      const results = await Promise.all(modules.map(module => listDocumentsForModule(input.projectId, module)));
      return {
        planning: results[0],
        sources: results[1],
        production: results[2],
        resources: results[3],
      };
    }),

  save: protectedProcedure
    .input(z.object({
      projectId: z.number(),
      module: MODULE,
      id: z.number().optional(),
      title: z.string().min(1, "Título é obrigatório"),
      content: z.string(),
    }))
    .mutation(async ({ input }) => {
      const { projectId, module, id, title, content } = input;

      if (module === "planning") {
        await createOrUpdatePlanningStage(projectId, { pedagogicalPlan: content });
        return { success: true };
      }

      if (module === "sources") {
        const planningStage = await getPlanningStage(projectId);
        if (!planningStage) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "Salve o plano pedagógico antes de criar documentos de fontes.",
          });
        }
        const docId = await createOrUpdateSourceResearch(id ?? null, projectId, planningStage.id, title, content);
        return { success: true, id: docId };
      }

      if (module === "production") {
        const sources = await listSourceResearch(projectId);
        if (sources.length === 0) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "Crie ao menos um documento de fontes antes de produzir conteúdo.",
          });
        }
        const docId = await createOrUpdateProducedContent(id ?? null, projectId, sources[0].id, title, content);
        return { success: true, id: docId };
      }

      const produced = await listProducedContent(projectId);
      if (produced.length === 0) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Produza ao menos um conteúdo antes de criar recursos adicionais.",
        });
      }
      const docId = await createOrUpdateAdditionalResource(id ?? null, projectId, produced[0].id, "mind_map", title, content);
      return { success: true, id: docId };
    }),
});
