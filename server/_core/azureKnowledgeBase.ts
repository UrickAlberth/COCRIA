import { getVectorStoreId, setVectorStoreId } from "../db";
import { azureFetch, requireAzureConfig } from "./azureClient";

export async function createVectorStore(name: string): Promise<string> {
  const config = await requireAzureConfig();

  const data = await azureFetch(config, "/vector_stores", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ name }),
  });

  if (!data?.id) {
    throw new Error("Azure não retornou um id para o Vector Store.");
  }

  await setVectorStoreId(data.id);
  return data.id as string;
}

export type KnowledgeBaseFile = {
  id: string;
  filename: string;
};

export async function listKnowledgeBaseFiles(): Promise<KnowledgeBaseFile[]> {
  const config = await requireAzureConfig();
  const vectorStoreId = await getVectorStoreId();
  if (!vectorStoreId) return [];

  const data = await azureFetch(config, `/vector_stores/${encodeURIComponent(vectorStoreId)}/files?limit=100&order=desc`);

  return (data?.data ?? []).map((file: any) => ({
    id: file.id,
    filename: file.attributes?.original_filename || file.filename || file.id,
  }));
}

// Uploads a file to Azure and attaches it to the configured Vector Store, polling
// until indexing completes (or fails/times out) — mirrors the reference flow.
export async function uploadKnowledgeBaseFile(filename: string, mimeType: string, buffer: Buffer): Promise<{ fileId: string; status: string }> {
  const config = await requireAzureConfig();
  const vectorStoreId = await getVectorStoreId();
  if (!vectorStoreId) {
    throw new Error("Crie a Base de Conhecimento antes de enviar arquivos.");
  }

  const form = new FormData();
  form.append("purpose", "assistants");
  form.append("file", new Blob([buffer], { type: mimeType || "application/octet-stream" }), filename);

  const uploaded = await azureFetch(config, "/files", { method: "POST", body: form });
  if (!uploaded?.id) {
    throw new Error("Upload falhou: resposta sem id.");
  }

  // Azure may expect different payload shapes for attaching a file to a vector
  // store batch depending on the API version rollout — try a few variants.
  const attachPayloads = [
    { files: [{ file_id: uploaded.id, attributes: { original_filename: filename } }] },
    { file_ids: [uploaded.id] },
    { file_id: uploaded.id },
    { files: [uploaded.id] },
  ];

  let batch: any = null;
  let lastErr: unknown = null;
  for (const payload of attachPayloads) {
    try {
      batch = await azureFetch(config, `/vector_stores/${encodeURIComponent(vectorStoreId)}/file_batches`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (batch) break;
    } catch (err) {
      lastErr = err;
    }
  }

  if (!batch) {
    throw lastErr instanceof Error ? lastErr : new Error("Falha ao anexar arquivo ao Vector Store.");
  }

  const start = Date.now();
  while (Date.now() - start < 180_000) {
    const status = await azureFetch(config, `/vector_stores/${encodeURIComponent(vectorStoreId)}/file_batches/${encodeURIComponent(batch.id)}`);
    if (status.status === "completed") {
      return { fileId: uploaded.id, status: status.status };
    }
    if (["failed", "cancelled"].includes(status.status)) {
      throw new Error(`Indexação do documento terminou com status: ${status.status}`);
    }
    await new Promise(resolve => setTimeout(resolve, 1500));
  }

  throw new Error("Tempo limite aguardando a indexação do documento.");
}

export async function deleteKnowledgeBaseFile(fileId: string): Promise<void> {
  const config = await requireAzureConfig();
  const vectorStoreId = await getVectorStoreId();
  if (!vectorStoreId) {
    throw new Error("Base de Conhecimento não configurada.");
  }

  await azureFetch(config, `/vector_stores/${encodeURIComponent(vectorStoreId)}/files/${encodeURIComponent(fileId)}`, {
    method: "DELETE",
  });
}
