import { z } from "zod";
import { protectedProcedure, coordinatorProcedure, router } from "../_core/trpc";
import {
  getActiveSystemPrompt,
  getSystemPromptVersions,
  createSystemPrompt,
  updateSystemPromptActive,
} from "../db";
import { systemPrompts } from "../prompts/system-prompts";

export const promptsRouter = router({
  // Get active prompt for an assistant type
  getActive: protectedProcedure
    .input(z.object({
      assistantType: z.enum(["planning", "sources", "production", "resources"]),
    }))
    .query(async ({ input }) => {
      const prompt = await getActiveSystemPrompt(input.assistantType);
      return prompt;
    }),

  // Get all versions of a prompt
  getVersions: coordinatorProcedure
    .input(z.object({
      assistantType: z.enum(["planning", "sources", "production", "resources"]),
    }))
    .query(async ({ input }) => {
      return await getSystemPromptVersions(input.assistantType);
    }),

  // Create a new version of a prompt (coordinator only)
  createVersion: coordinatorProcedure
    .input(z.object({
      assistantType: z.enum(["planning", "sources", "production", "resources"]),
      promptContent: z.string().min(10, "Prompt deve ter pelo menos 10 caracteres"),
    }))
    .mutation(async ({ ctx, input }) => {
      // Deactivate all previous versions
      const versions = await getSystemPromptVersions(input.assistantType);
      for (const version of versions) {
        if (version.isActive) {
          await updateSystemPromptActive(version.id, false);
        }
      }

      // Create new version
      return await createSystemPrompt(
        input.assistantType,
        input.promptContent,
        ctx.user.id
      );
    }),

  // Update active status of a prompt version
  updateActive: coordinatorProcedure
    .input(z.object({
      promptId: z.number(),
      isActive: z.boolean(),
    }))
    .mutation(async ({ input }) => {
      return await updateSystemPromptActive(input.promptId, input.isActive);
    }),

  // Get default prompts
  getDefaults: protectedProcedure.query(async () => {
    return systemPrompts;
  }),
});
