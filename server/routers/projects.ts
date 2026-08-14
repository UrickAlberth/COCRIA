import { z } from "zod";
import { protectedProcedure, coordinatorProcedure, router } from "../_core/trpc";
import {
  createProject,
  getUserProjects,
  getProjectById,
  updateProjectStatus,
  getPlanningStage,
  createOrUpdatePlanningStage,
  getChatHistory,
  saveChatMessage,
  deleteChatHistory,
  getActiveSystemPrompt,
  getUpstreamContext,
  getCustomInstructions,
} from "../db";
import { invokeLLM } from "../_core/llm";

export const projectsRouter = router({
  // List all projects for the current user
  list: protectedProcedure.query(async ({ ctx }) => {
    return await getUserProjects(ctx.user.id);
  }),

  // Get a specific project
  getById: protectedProcedure
    .input(z.object({ projectId: z.number() }))
    .query(async ({ input }) => {
      return await getProjectById(input.projectId);
    }),

  // Create a new project
  create: protectedProcedure
    .input(z.object({
      title: z.string().min(1, "Título é obrigatório"),
      description: z.string().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const result = await createProject(ctx.user.id, input.title, input.description);
      return result;
    }),

  // Update project status (only for coordinators)
  updateStatus: coordinatorProcedure
    .input(z.object({
      projectId: z.number(),
      status: z.string(),
      currentModule: z.string(),
    }))
    .mutation(async ({ input }) => {
      return await updateProjectStatus(input.projectId, input.status, input.currentModule);
    }),

  // Get planning stage for a project
  getPlanningStage: protectedProcedure
    .input(z.object({ projectId: z.number() }))
    .query(async ({ input }) => {
      return await getPlanningStage(input.projectId);
    }),

  // Save planning stage data
  savePlanningStage: protectedProcedure
    .input(z.object({
      projectId: z.number(),
      theme: z.string().optional(),
      institutionalProblem: z.string().optional(),
      generalObjective: z.string().optional(),
      specificObjectives: z.string().optional(),
      targetAudience: z.string().optional(),
      methodology: z.string().optional(),
      programmaticContent: z.string().optional(),
      pedagogicalPlan: z.string().optional(),
      instructionalMatrix: z.string().optional(),
      status: z.string().optional(),
    }))
    .mutation(async ({ input }) => {
      const { projectId, ...data } = input;
      return await createOrUpdatePlanningStage(projectId, data);
    }),

  // Get chat history for a module
  getChatHistory: protectedProcedure
    .input(z.object({
      projectId: z.number(),
      module: z.enum(["planning", "sources", "production", "resources"]),
    }))
    .query(async ({ input }) => {
      return await getChatHistory(input.projectId, input.module);
    }),

  // Clear chat history for a module, starting that stage's conversation over
  clearChatHistory: protectedProcedure
    .input(z.object({
      projectId: z.number(),
      module: z.enum(["planning", "sources", "production", "resources"]),
    }))
    .mutation(async ({ input }) => {
      await deleteChatHistory(input.projectId, input.module);
      return { success: true };
    }),

  // Send message to AI assistant and get response
  sendMessage: protectedProcedure
    .input(z.object({
      projectId: z.number(),
      module: z.enum(["planning", "sources", "production", "resources"]),
      message: z.string(),
      conversationHistory: z.array(z.object({
        role: z.enum(["user", "assistant"]),
        content: z.string(),
      })).optional(),
      attachments: z.array(z.object({
        filename: z.string(),
        mimeType: z.string(),
        // "data:<mime>;base64,...." — sent inline to the model, no upload/storage step.
        dataUrl: z.string(),
      })).optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      if (!input.message.trim() && !input.attachments?.length) {
        throw new Error("Mensagem vazia");
      }

      // Save user message (annotate with attached filenames so history stays readable)
      const messageForHistory = input.attachments?.length
        ? `${input.message.trim()}\n\n📎 ${input.attachments.map(a => a.filename).join(", ")}`.trim()
        : input.message;
      await saveChatMessage(input.projectId, ctx.user.id, input.module, "user", messageForHistory);

      // Get the active system prompt for this module
      const systemPrompt = await getActiveSystemPrompt(input.module);
      if (!systemPrompt) {
        throw new Error(`Nenhum prompt de sistema ativo para o módulo ${input.module}`);
      }

      // Automatically feed in the approved documents from earlier stages (e.g. the
      // validated pedagogical plan) so the assistant has them as input without the
      // user needing to paste anything back in.
      const upstreamContext = await getUpstreamContext(input.projectId, input.module);
      let systemContent = upstreamContext
        ? `${systemPrompt.promptContent}\n\n---\n\nContexto do projeto (documentos já aprovados de etapas anteriores):\n\n${upstreamContext}`
        : systemPrompt.promptContent;

      // User-defined tone/style preferences, applied to every conversation.
      const customInstructions = await getCustomInstructions();
      if (customInstructions) {
        systemContent += `\n\n---\n\nInstruções de preferência do usuário (siga o tom e estilo abaixo em todas as respostas):\n\n${customInstructions}`;
      }

      // Attach files to just this turn's user message (not resent on later turns —
      // the model's own reply carries forward whatever it took from the file).
      const userContent = input.attachments?.length
        ? [
            ...(input.message.trim() ? [{ type: "text" as const, text: input.message }] : []),
            ...input.attachments.map(a =>
              a.mimeType.startsWith("image/")
                ? { type: "image_url" as const, image_url: { url: a.dataUrl } }
                : { type: "file_url" as const, file_url: { url: a.dataUrl, mime_type: a.mimeType, filename: a.filename } }
            ),
          ]
        : input.message;

      // Build conversation messages
      const messages: any[] = [
        { role: "system", content: systemContent },
        ...(input.conversationHistory || []).map(msg => ({
          role: msg.role as "user" | "assistant",
          content: msg.content,
        })),
        { role: "user", content: userContent },
      ];

      // Call LLM
      const response = await invokeLLM({
        messages: messages as any,
      });

      const assistantContent = response.choices[0]?.message?.content;
      const assistantMessage = typeof assistantContent === 'string' ? assistantContent : JSON.stringify(assistantContent);

      // Save assistant response
      await saveChatMessage(input.projectId, ctx.user.id, input.module, "assistant", assistantMessage);

      return {
        message: assistantMessage,
        role: "assistant",
      };
    }),
});
