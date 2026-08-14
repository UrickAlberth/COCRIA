// Shared "Configurar IA" button + modal. Include the markup block (see dashboard.html
// or project.html for the template) and this script on any page that needs it.

// Sensible defaults matching the reference Azure OpenAI setup — only the key is left blank.
const AZURE_DEFAULTS = {
  apiBase: "https://assistente-web-resource.services.ai.azure.com",
  deployment: "gpt-5.2-chat",
};

const AZURE_MODEL_OPTIONS = [
  "DeepSeek-V4-Pro",
  "DeepSeek-V4-Pro-2",
  "gpt-4.1-mini",
  "gpt-5.2",
  "gpt-5.2-chat",
  "gpt-5.3-chat",
  "gpt-5.3-chat-2",
  "gpt-5.4-mini",
  "gpt-5.4-mini-2",
  "gpt-5.4-pro",
  "gpt-5.5",
];

function initAISettings() {
  const btn = document.getElementById("ai-settings-btn");
  const dialog = document.getElementById("ai-settings-dialog");
  const form = document.getElementById("ai-settings-form");
  const baseInput = document.getElementById("ai-settings-base");
  const deploymentSelect = document.getElementById("ai-settings-deployment");
  const keyInput = document.getElementById("ai-settings-key");
  const status = document.getElementById("ai-settings-status");
  const saveBtn = document.getElementById("ai-settings-save");

  if (!btn || !dialog) return;

  const icon = document.getElementById("ai-settings-icon");
  if (icon) icon.innerHTML = iconSvg("key", "w-4 h-4");

  deploymentSelect.innerHTML = AZURE_MODEL_OPTIONS.map((m) => `<option value="${m}">${m}</option>`).join("");

  function setDeploymentValue(value) {
    const wanted = value || AZURE_DEFAULTS.deployment;
    // The saved model might not be one of the presets (e.g. set outside this UI) —
    // add it as an extra option rather than silently switching to a different one.
    if (![...deploymentSelect.options].some((o) => o.value === wanted)) {
      deploymentSelect.insertAdjacentHTML("afterbegin", `<option value="${wanted}">${wanted}</option>`);
    }
    deploymentSelect.value = wanted;
  }

  async function refreshStatus() {
    try {
      const result = await trpc.query("settings.getStatus");
      baseInput.value = result.apiBase || AZURE_DEFAULTS.apiBase;
      setDeploymentValue(result.deployment);
      status.textContent = result.hasAzureConfig
        ? "Uma configuração já está salva. Salvar novamente substitui a atual (a chave precisa ser colada de novo)."
        : "Nenhuma configuração salva ainda — os assistentes de IA não vão responder até você salvar uma.";
    } catch {
      /* ignore */
    }
  }

  function openSettings() {
    keyInput.value = "";
    refreshStatus();
    openDialog(dialog);
  }

  btn.addEventListener("click", openSettings);

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const apiBase = baseInput.value.trim();
    const deployment = deploymentSelect.value.trim();
    const apiKey = keyInput.value.trim();
    if (!apiBase || !deployment || !apiKey) {
      toast.error("Preencha todos os campos antes de salvar");
      return;
    }

    saveBtn.disabled = true;
    try {
      await trpc.mutate("settings.saveAzureConfig", { apiBase, deployment, apiKey });
      toast.success("Configuração da IA salva com sucesso");
      keyInput.value = "";
      closeDialog(dialog);
    } catch (err) {
      toast.error(err.message);
    } finally {
      saveBtn.disabled = false;
    }
  });

  // Exposed so pages can react to the "not configured" error from sendMessage and open this dialog directly.
  window.openAISettings = openSettings;
}

document.addEventListener("DOMContentLoaded", initAISettings);
