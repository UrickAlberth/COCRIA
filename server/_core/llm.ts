import { requireAzureConfig, azureFetch, AZURE_CONFIG_MISSING_MESSAGE } from "./azureClient";

export { AZURE_CONFIG_MISSING_MESSAGE };

export type Role = "system" | "user" | "assistant" | "tool" | "function";

export type TextContent = {
  type: "text";
  text: string;
};

export type ImageContent = {
  type: "image_url";
  image_url: {
    url: string;
    detail?: "auto" | "low" | "high";
  };
};

export type FileContent = {
  type: "file_url";
  file_url: {
    /** A `data:<mime>;base64,...` URI — Azure's Responses API takes file bytes inline via `file_data`. */
    url: string;
    mime_type?: string;
    filename?: string;
  };
};

export type MessageContent = string | TextContent | ImageContent | FileContent;

export type Message = {
  role: Role;
  content: MessageContent | MessageContent[];
  name?: string;
  tool_call_id?: string;
};

export type InvokeParams = {
  messages: Message[];
  maxTokens?: number;
  max_tokens?: number;
};

export type InvokeResult = {
  id: string;
  created: number;
  model: string;
  choices: Array<{
    index: number;
    message: {
      role: Role;
      content: string;
    };
    finish_reason: string | null;
  }>;
  usage?: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
};

const flattenTextContent = (content: MessageContent | MessageContent[]): string => {
  const parts = Array.isArray(content) ? content : [content];
  return parts
    .map(part => {
      if (typeof part === "string") return part;
      if (part.type === "text") return part.text;
      return "";
    })
    .filter(Boolean)
    .join("\n");
};

// Maps our internal content parts to the Responses API's `input_text` /
// `input_image` / `input_file` shapes (file bytes travel inline as a data URI —
// no separate upload step, so attachments work without any file lifecycle to manage).
const toResponsesContentParts = (content: MessageContent | MessageContent[]) => {
  const parts = Array.isArray(content) ? content : [content];
  return parts.map(part => {
    if (typeof part === "string") {
      return { type: "input_text", text: part };
    }
    if (part.type === "text") {
      return { type: "input_text", text: part.text };
    }
    if (part.type === "image_url") {
      return { type: "input_image", image_url: part.image_url.url };
    }
    // file_url
    return {
      type: "input_file",
      filename: part.file_url.filename || "arquivo",
      file_data: part.file_url.url,
    };
  });
};

// Mirrors the Responses API output shape: prefers the convenience `output_text`
// field, falling back to walking `output[].content[]` for `output_text` parts.
function extractOutputText(data: any): string {
  if (typeof data?.output_text === "string" && data.output_text.trim()) {
    return data.output_text;
  }

  const texts: string[] = [];
  for (const item of data?.output ?? []) {
    if (item?.type !== "message") continue;
    for (const content of item.content ?? []) {
      if (content?.type === "output_text" && content.text) {
        texts.push(content.text);
      }
    }
  }
  return texts.join("\n").trim();
}

export async function invokeLLM(params: InvokeParams): Promise<InvokeResult> {
  const config = await requireAzureConfig();

  const systemText = params.messages
    .filter(m => m.role === "system")
    .map(m => flattenTextContent(m.content))
    .join("\n\n");

  const input = params.messages
    .filter(m => m.role === "user" || m.role === "assistant")
    .map(m => {
      const isPlainText = typeof m.content === "string" || (!Array.isArray(m.content) && m.content.type === "text");
      return {
        role: m.role,
        content: isPlainText ? flattenTextContent(m.content) : toResponsesContentParts(m.content),
      };
    });

  const body: Record<string, unknown> = {
    model: config.deployment,
    input,
    tool_choice: "auto",
  };

  if (systemText) {
    body.instructions = systemText;
  }

  // Built-in tools the model can call on its own (tool_choice: "auto" above lets
  // it decide when each is actually useful for the turn).
  const tools: Record<string, unknown>[] = [{ type: "web_search" }];
  if (config.vectorStoreId) {
    tools.push({ type: "file_search", vector_store_ids: [config.vectorStoreId], max_num_results: 10 });
  }
  body.tools = tools;

  const data = await azureFetch(config, "/responses", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });

  const content = extractOutputText(data);

  return {
    id: data?.id ?? `azure-${Date.now()}`,
    created: data?.created_at ?? Math.floor(Date.now() / 1000),
    model: data?.model ?? config.deployment,
    choices: [{
      index: 0,
      message: { role: "assistant", content },
      finish_reason: data?.status ?? null,
    }],
    usage: data?.usage ? {
      prompt_tokens: data.usage.input_tokens ?? 0,
      completion_tokens: data.usage.output_tokens ?? 0,
      total_tokens: data.usage.total_tokens ?? 0,
    } : undefined,
  };
}
