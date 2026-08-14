import { z } from "zod";
import { protectedProcedure, router } from "../_core/trpc";
import { getAzureConfig, setAzureConfig, getCustomInstructions, setCustomInstructions } from "../db";

export const settingsRouter = router({
  // Never returns the actual key — only whether Azure OpenAI has been configured,
  // plus the non-secret fields so the form can be pre-filled for editing.
  getStatus: protectedProcedure.query(async () => {
    const config = await getAzureConfig();
    return {
      hasAzureConfig: Boolean(config),
      apiBase: config?.apiBase ?? "",
      deployment: config?.deployment ?? "",
    };
  }),

  saveAzureConfig: protectedProcedure
    .input(z.object({
      apiBase: z.string().min(1, "Endpoint é obrigatório"),
      deployment: z.string().min(1, "Modelo é obrigatório"),
      apiKey: z.string().min(1, "Chave é obrigatória"),
    }))
    .mutation(async ({ input }) => {
      await setAzureConfig({
        apiBase: input.apiBase.trim(),
        deployment: input.deployment.trim(),
        apiKey: input.apiKey.trim(),
      });
      return { success: true };
    }),

  // Preferências de tom/estilo aplicadas a todas as conversas ("Instruções para a IA").
  getCustomInstructions: protectedProcedure.query(async () => {
    return { customInstructions: await getCustomInstructions() };
  }),

  saveCustomInstructions: protectedProcedure
    .input(z.object({ customInstructions: z.string().max(10000, "Máximo de 10000 caracteres") }))
    .mutation(async ({ input }) => {
      await setCustomInstructions(input.customInstructions.trim());
      return { success: true };
    }),
});
