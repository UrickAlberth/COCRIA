const ASSISTANT_CONFIG = {
  planning: { title: "CocrIA Planejamento", description: "Assistente para elaboração de planos pedagógicos" },
  sources: { title: "CocrIA Pesquisa de Fontes", description: "Assistente para pesquisa bibliográfica" },
  production: { title: "CocrIA Produção de Conteúdo", description: "Assistente para geração de material didático" },
  resources: { title: "CocrIA Recursos Adicionais", description: "Assistente para criação de recursos complementares" },
};

let activeTab = "planning";
let defaults = {};

async function renderPromptContent(assistantType) {
  activeTab = assistantType;
  const config = ASSISTANT_CONFIG[assistantType];
  const el = document.getElementById("prompt-content");

  el.innerHTML = `
    <div class="space-y-6">
      <div class="card p-6">
        <div class="flex items-start justify-between">
          <div class="flex items-center gap-3">
            <div class="p-2 bg-blue-50 rounded-lg">${iconSvg("sparkles", "w-5 h-5")}</div>
            <div>
              <h3 class="font-semibold text-lg">${config.title}</h3>
              <p class="text-sm text-muted-foreground">${config.description}</p>
            </div>
          </div>
          <span id="active-version-badge"></span>
        </div>
      </div>

      <div class="card p-6">
        <h3 class="font-semibold text-lg mb-1">Editar Prompt de Sistema</h3>
        <p class="text-sm text-muted-foreground mb-4">Customize o comportamento do assistente editando o prompt abaixo</p>
        <div id="prompt-editor-area">
          <div class="flex justify-center py-8"><div class="h-6 w-6 rounded-full border-2 border-primary border-t-transparent animate-spin"></div></div>
        </div>
      </div>

      <div class="card p-6">
        <h3 class="font-semibold text-lg mb-1">Histórico de Versões</h3>
        <p class="text-sm text-muted-foreground mb-4">Todas as versões anteriores do prompt</p>
        <div id="prompt-versions"></div>
      </div>
    </div>
  `;

  await loadVersions(assistantType);
}

async function loadVersions(assistantType) {
  let versions;
  try {
    versions = await trpc.query("prompts.getVersions", { assistantType });
  } catch (err) {
    toast.error(err.message);
    return;
  }
  if (activeTab !== assistantType) return; // tab changed while loading

  const activeVersion = versions.find((v) => v.isActive);
  const defaultPrompt = defaults[assistantType] || "";
  const currentPrompt = activeVersion ? activeVersion.promptContent : defaultPrompt;

  document.getElementById("active-version-badge").innerHTML = activeVersion
    ? `<span class="badge bg-green-100 text-green-800">Versão ${activeVersion.version}</span>`
    : "";

  document.getElementById("prompt-editor-area").innerHTML = `
    <textarea class="field-textarea font-mono text-sm" rows="12" id="prompt-textarea" placeholder="Cole o prompt aqui...">${escapeHtml(currentPrompt)}</textarea>
    <div class="flex gap-2 justify-end mt-4">
      <button type="button" class="btn-outline gap-2" id="prompt-reset">${iconSvg("x", "w-4 h-4")} Reverter para Padrão</button>
      <button type="button" class="btn-primary gap-2" id="prompt-save">${iconSvg("save", "w-4 h-4")} Salvar Nova Versão</button>
    </div>
  `;

  document.getElementById("prompt-reset").addEventListener("click", () => {
    document.getElementById("prompt-textarea").value = defaultPrompt;
    toast("Prompt revertido para padrão");
  });

  document.getElementById("prompt-save").addEventListener("click", async () => {
    const content = document.getElementById("prompt-textarea").value.trim();
    if (!content) {
      toast.error("Prompt não pode estar vazio");
      return;
    }
    const saveBtn = document.getElementById("prompt-save");
    saveBtn.disabled = true;
    try {
      await trpc.mutate("prompts.createVersion", { assistantType, promptContent: content });
      toast.success("Prompt atualizado com sucesso!");
      await loadVersions(assistantType);
    } catch (err) {
      toast.error("Erro ao atualizar prompt: " + err.message);
    } finally {
      saveBtn.disabled = false;
    }
  });

  const versionsEl = document.getElementById("prompt-versions");
  if (versions.length === 0) {
    versionsEl.innerHTML = `<p class="text-slate-600 text-center py-8">Nenhuma versão criada ainda</p>`;
  } else {
    versionsEl.innerHTML = `<div class="space-y-3">${versions
      .map(
        (v) => `
        <div class="p-4 border border-slate-200 rounded-lg flex items-start justify-between">
          <div class="flex-1">
            <div class="flex items-center gap-2 mb-2">
              <span class="font-medium text-slate-900">Versão ${v.version}</span>
              ${v.isActive ? '<span class="badge bg-green-100 text-green-800">Ativa</span>' : ""}
            </div>
            <p class="text-sm text-slate-600">Criada em ${new Date(v.createdAt).toLocaleDateString("pt-BR")} às ${new Date(v.createdAt).toLocaleTimeString("pt-BR")}</p>
          </div>
        </div>
      `
      )
      .join("")}</div>`;
  }
}

// ---- Base de Conhecimento (Azure Vector Store) ----

function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      // dataURL looks like "data:<mime>;base64,<data>" — strip the prefix.
      const result = String(reader.result);
      resolve(result.slice(result.indexOf(",") + 1));
    };
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

async function renderKnowledgeBaseTab() {
  activeTab = "knowledge-base";
  const el = document.getElementById("prompt-content");

  el.innerHTML = `
    <div class="space-y-6">
      <div class="card p-6">
        <div class="flex items-center gap-3">
          <div class="p-2 bg-blue-50 rounded-lg">${iconSvg("fileStack", "w-5 h-5")}</div>
          <div>
            <h3 class="font-semibold text-lg">Base de Conhecimento</h3>
            <p class="text-sm text-muted-foreground">Envie documentos PDF, TXT ou DOCX para os assistentes consultarem automaticamente durante as conversas (file_search).</p>
          </div>
        </div>
      </div>
      <div id="kb-content"></div>
    </div>
  `;

  await loadKnowledgeBase();
}

async function loadKnowledgeBase() {
  const el = document.getElementById("kb-content");
  el.innerHTML = `<div class="flex justify-center py-8"><div class="h-6 w-6 rounded-full border-2 border-primary border-t-transparent animate-spin"></div></div>`;

  let status;
  try {
    status = await trpc.query("knowledgeBase.getStatus");
  } catch (err) {
    el.innerHTML = `<div class="card p-6 text-center text-destructive text-sm">${escapeHtml(err.message)}</div>`;
    return;
  }
  if (activeTab !== "knowledge-base") return;

  if (!status.vectorStoreId) {
    el.innerHTML = `
      <div class="card p-6 text-center space-y-3">
        <p class="text-sm text-muted-foreground">Nenhuma Base de Conhecimento criada ainda.</p>
        <button type="button" class="btn-primary gap-2" id="kb-create">${iconSvg("plus", "w-4 h-4")} Criar Base de Conhecimento</button>
      </div>
    `;
    document.getElementById("kb-create").addEventListener("click", async (e) => {
      e.target.disabled = true;
      try {
        await trpc.mutate("knowledgeBase.create");
        toast.success("Base de Conhecimento criada");
        await loadKnowledgeBase();
      } catch (err) {
        toast.error(err.message);
        e.target.disabled = false;
      }
    });
    return;
  }

  el.innerHTML = `
    <div class="card p-6">
      <h3 class="font-semibold mb-1">Adicionar documentos</h3>
      <p class="text-sm text-muted-foreground mb-4">PDF, TXT ou DOCX.</p>
      <label class="flex flex-col items-center justify-center gap-2 border-2 border-dashed border-border rounded-lg p-8 cursor-pointer hover:border-primary/50 transition-colors">
        <input type="file" id="kb-file-input" class="hidden" multiple accept=".pdf,.txt,.docx,application/pdf,text/plain,application/vnd.openxmlformats-officedocument.wordprocessingml.document" />
        ${iconSvg("upload", "w-6 h-6 text-muted-foreground")}
        <span class="text-sm font-medium">Selecionar arquivos</span>
      </label>
      <p id="kb-upload-status" class="text-sm text-muted-foreground mt-3"></p>
    </div>

    <div class="card p-6 mt-6">
      <h3 class="font-semibold mb-4">Documentos indexados</h3>
      <div id="kb-file-list"></div>
    </div>
  `;

  document.getElementById("kb-file-input").addEventListener("change", async (e) => {
    const files = [...e.target.files];
    e.target.value = "";
    if (files.length === 0) return;

    const statusEl = document.getElementById("kb-upload-status");
    for (const file of files) {
      statusEl.textContent = `Enviando "${file.name}"...`;
      try {
        const base64Content = await fileToBase64(file);
        await trpc.mutate("knowledgeBase.uploadFile", {
          filename: file.name,
          mimeType: file.type,
          base64Content,
        });
      } catch (err) {
        toast.error(`Erro ao enviar "${file.name}": ${err.message}`);
      }
    }
    statusEl.textContent = `${files.length} arquivo(s) processado(s).`;
    await loadFileList();
  });

  await loadFileList();
}

async function loadFileList() {
  const listEl = document.getElementById("kb-file-list");
  if (!listEl) return;
  listEl.innerHTML = `<div class="flex justify-center py-6"><div class="h-5 w-5 rounded-full border-2 border-primary border-t-transparent animate-spin"></div></div>`;

  let files;
  try {
    files = await trpc.query("knowledgeBase.listFiles");
  } catch (err) {
    listEl.innerHTML = `<p class="text-sm text-destructive">${escapeHtml(err.message)}</p>`;
    return;
  }
  if (activeTab !== "knowledge-base") return;

  if (files.length === 0) {
    listEl.innerHTML = `<p class="text-sm text-muted-foreground text-center py-4">Nenhum documento indexado ainda.</p>`;
    return;
  }

  listEl.innerHTML = files
    .map(
      (f) => `
      <div class="flex items-center gap-2 p-2.5 rounded-md bg-muted mb-2">
        ${iconSvg("fileText", "w-4 h-4 shrink-0 text-muted-foreground")}
        <span class="flex-1 min-w-0 truncate text-sm" title="${escapeHtml(f.filename)}">${escapeHtml(f.filename)}</span>
        <button type="button" class="canvas-toolbar-btn" data-delete-file="${escapeHtml(f.id)}" title="Remover">${iconSvg("x", "w-4 h-4")}</button>
      </div>
    `
    )
    .join("");

  listEl.querySelectorAll("[data-delete-file]").forEach((btn) => {
    btn.addEventListener("click", async () => {
      if (!confirm("Remover este documento da Base de Conhecimento?")) return;
      btn.disabled = true;
      try {
        await trpc.mutate("knowledgeBase.deleteFile", { fileId: btn.dataset.deleteFile });
        await loadFileList();
      } catch (err) {
        toast.error(err.message);
        btn.disabled = false;
      }
    });
  });
}

document.addEventListener("DOMContentLoaded", async () => {
  document.getElementById("icon-back").innerHTML = iconSvg("arrowLeft", "w-4 h-4");
  document.querySelectorAll(".icon-sparkles").forEach((el) => (el.innerHTML = iconSvg("sparkles", "w-5 h-5")));
  document.getElementById("icon-kb").innerHTML = iconSvg("fileStack", "w-5 h-5");

  const user = await requireAuth();
  if (!user) return;

  if (user.role !== "coordinator" && user.role !== "admin") {
    document.getElementById("loading").classList.add("hidden");
    document.getElementById("no-access").classList.remove("hidden");
    return;
  }

  try {
    defaults = await trpc.query("prompts.getDefaults");
  } catch {
    defaults = {};
  }

  document.getElementById("loading").classList.add("hidden");
  document.getElementById("app").classList.remove("hidden");

  document.querySelectorAll("#prompt-tabs [data-tab-trigger]").forEach((btn) => {
    btn.addEventListener("click", () => {
      document.querySelectorAll("#prompt-tabs [data-tab-trigger]").forEach((b) => b.classList.remove("tab-active"));
      btn.classList.add("tab-active");
      if (btn.dataset.tabTrigger === "knowledge-base") {
        renderKnowledgeBaseTab();
      } else {
        renderPromptContent(btn.dataset.tabTrigger);
      }
    });
  });

  renderPromptContent("planning");
});
