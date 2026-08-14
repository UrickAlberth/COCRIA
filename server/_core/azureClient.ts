import { getAzureConfig, type AzureConfig } from "../db";

// Thrown when Azure OpenAI credentials haven't been saved yet — the frontend catches
// this message specifically to prompt the user to open the "Configurar IA" dialog.
export const AZURE_CONFIG_MISSING_MESSAGE = "AZURE_OPENAI_NOT_CONFIGURED";

export async function requireAzureConfig(): Promise<AzureConfig> {
  const config = await getAzureConfig();
  if (!config) throw new Error(AZURE_CONFIG_MISSING_MESSAGE);
  return config;
}

/**
 * Calls the Azure OpenAI v1 API surface (`/openai/v1/...` — Responses API, Files,
 * Vector Stores). No `api-version` query param is used on these routes.
 */
export async function azureFetch(config: AzureConfig, route: string, options: RequestInit = {}): Promise<any> {
  const apiBase = config.apiBase.replace(/\/+$/, "");
  const url = `${apiBase}/openai/v1${route}`;

  const headers: Record<string, string> = { "api-key": config.apiKey };
  if (options.headers) Object.assign(headers, options.headers as Record<string, string>);

  const response = await fetch(url, { ...options, headers });
  const text = await response.text();

  let data: any = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = null;
  }

  if (!response.ok) {
    const message = data?.error?.message || data?.message || (text ? text.slice(0, 400) : `${response.status} ${response.statusText}`);
    throw new Error(`Azure OpenAI: ${message}`);
  }

  return data;
}
