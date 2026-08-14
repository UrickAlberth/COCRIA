import { z } from "zod";
import { protectedProcedure, router } from "../_core/trpc";
import { getVectorStoreId } from "../db";
import {
  createVectorStore,
  listKnowledgeBaseFiles,
  uploadKnowledgeBaseFile,
  deleteKnowledgeBaseFile,
} from "../_core/azureKnowledgeBase";

export const knowledgeBaseRouter = router({
  getStatus: protectedProcedure.query(async () => {
    const vectorStoreId = await getVectorStoreId();
    return { vectorStoreId };
  }),

  create: protectedProcedure.mutation(async () => {
    const vectorStoreId = await createVectorStore("Base de Conhecimento - CocrIA");
    return { vectorStoreId };
  }),

  listFiles: protectedProcedure.query(async () => {
    return await listKnowledgeBaseFiles();
  }),

  // Files travel as base64 over the tRPC JSON body — simplest path given the app
  // has no multipart upload middleware set up, and knowledge-base documents are
  // small enough (well under the 50mb JSON body limit) for the ~33% overhead to be fine.
  uploadFile: protectedProcedure
    .input(z.object({
      filename: z.string().min(1),
      mimeType: z.string().optional(),
      base64Content: z.string().min(1),
    }))
    .mutation(async ({ input }) => {
      const buffer = Buffer.from(input.base64Content, "base64");
      return await uploadKnowledgeBaseFile(input.filename, input.mimeType ?? "application/octet-stream", buffer);
    }),

  deleteFile: protectedProcedure
    .input(z.object({ fileId: z.string().min(1) }))
    .mutation(async ({ input }) => {
      await deleteKnowledgeBaseFile(input.fileId);
      return { success: true };
    }),
});
