const MODULES = ["planning", "sources", "production", "resources"];

const MODULE_CONFIG = {
  planning: {
    title: "CocrIA Planejamento",
    description: "Elabore o plano pedagógico e matriz instrucional",
    icon: "bookOpen",
    color: "bg-blue-50 border-blue-200",
  },
  sources: {
    title: "CocrIA Pesquisa de Fontes",
    description: "Pesquise e consolide referências bibliográficas",
    icon: "users",
    color: "bg-purple-50 border-purple-200",
  },
  production: {
    title: "CocrIA Produção de Conteúdo",
    description: "Gere o material didático por tópicos",
    icon: "settings",
    color: "bg-green-50 border-green-200",
  },
  resources: {
    title: "CocrIA Recursos Adicionais",
    description: "Crie roteiros, atividades, podcasts e mais",
    icon: "plus",
    color: "bg-orange-50 border-orange-200",
  },
};

const SUBMITTABLE_FROM_STATUS = {
  planning: "draft",
  sources: "planning_validated",
  production: "sources_validated",
  resources: null,
};

const STATUS_SEQUENCE = [
  "draft",
  "awaiting_planning_validation",
  "planning_validated",
  "awaiting_sources_validation",
  "sources_validated",
  "in_production",
  "completed",
];

const STATUS_LABELS = {
  draft: "Rascunho",
  awaiting_planning_validation: "Aguardando validação",
  planning_validated: "Planejamento validado",
  awaiting_sources_validation: "Aguardando validação de fontes",
  sources_validated: "Fontes validadas",
  in_production: "Em produção",
  completed: "Concluído",
};

const AZURE_CONFIG_MISSING_MESSAGE = "AZURE_OPENAI_NOT_CONFIGURED";

function isModuleEnabled(key, status) {
  if (key === "planning") return true;
  if (key === "sources") return status !== "draft" && status !== "awaiting_planning_validation";
  if (key === "production") return status === "sources_validated" || status === "in_production" || status === "completed";
  if (key === "resources") return status === "in_production" || status === "completed";
  return false;
}

let projectId;
let project;
let validations;

function hasPendingValidation(key) {
  return validations.some((v) => v.stage === key && v.status === "pending");
}

function renderHeader() {
  document.getElementById("project-title").textContent = project.title;
  document.getElementById("project-description").textContent = project.description || "";
  document.getElementById("project-status").textContent = STATUS_LABELS[project.status] || project.status;

  const statusIndex = STATUS_SEQUENCE.indexOf(project.status);
  const percent = statusIndex >= 0 ? (statusIndex / (STATUS_SEQUENCE.length - 1)) * 100 : 0;
  document.getElementById("progress-bar").style.width = `${percent}%`;
  document.getElementById("progress-label").textContent = `Etapa ${Math.max(statusIndex, 0) + 1} de ${STATUS_SEQUENCE.length}`;

  MODULES.forEach((key) => {
    const trigger = document.querySelector(`[data-tab-trigger="${key}"]`);
    trigger.disabled = !isModuleEnabled(key, project.status);
  });
}

async function refreshProjectAndRender() {
  [project, validations] = await Promise.all([
    trpc.query("projects.getById", { projectId: Number(projectId) }),
    trpc.query("validations.getProjectValidations", { projectId: Number(projectId) }),
  ]);
  renderHeader();
  MODULES.forEach(renderModuleSection);
}

function blockedCardHtml(status) {
  return `
    <div class="card py-12 text-center">
      <div class="w-12 h-12 bg-slate-200 rounded-lg mx-auto mb-4 flex items-center justify-center">
        ${iconSvg("loader", "w-6 h-6 text-slate-400")}
      </div>
      <p class="text-slate-600 mb-4">Este módulo será desbloqueado após a conclusão da etapa anterior.</p>
      <p class="text-sm text-slate-500">Status atual: <strong>${status}</strong></p>
    </div>
  `;
}

function moduleHeaderHtml(key, config, enabled) {
  return `
    <div class="card border-2 ${config.color} p-6">
      <div class="flex items-start justify-between">
        <div class="flex items-center gap-3">
          <div class="p-2 bg-white rounded-lg">${iconSvg(config.icon, "w-5 h-5")}</div>
          <div>
            <h3 class="font-semibold text-lg">${config.title}</h3>
            <p class="text-sm text-muted-foreground">${config.description}</p>
          </div>
        </div>
        ${!enabled ? '<span class="badge bg-slate-200 text-slate-700">Bloqueado</span>' : ""}
      </div>
    </div>
  `;
}

function renderModuleSection(key) {
  const container = document.getElementById(`section-${key}`);
  const config = MODULE_CONFIG[key];
  const enabled = isModuleEnabled(key, project.status);

  if (!enabled) {
    container.innerHTML = `<div class="space-y-6">${moduleHeaderHtml(key, config, false)}${blockedCardHtml(project.status)}</div>`;
    return;
  }

  const pending = hasPendingValidation(key);
  const canSubmit = SUBMITTABLE_FROM_STATUS[key] !== null && project.status === SUBMITTABLE_FROM_STATUS[key] && !pending;

  container.innerHTML = `
    <div class="space-y-6">
      ${moduleHeaderHtml(key, config, true)}

      ${pending ? `
        <div class="card bg-yellow-50 border-yellow-200 p-4 flex items-center gap-3">
          ${iconSvg("loader", "w-4 h-4 text-yellow-700 animate-spin")}
          <p class="text-sm text-yellow-800">Aguardando validação da coordenação para esta etapa.</p>
        </div>
      ` : ""}

      ${canSubmit ? `
        <div class="flex justify-end">
          <button type="button" class="btn-primary gap-2" data-submit-btn>
            ${iconSvg("send", "w-4 h-4")}
            Enviar para validação
          </button>
        </div>
      ` : ""}

      <div class="flex gap-0 border rounded-lg overflow-hidden bg-card" style="height: 900px;" data-split>
        <div class="flex flex-col min-w-0" style="flex: 0 0 55%;" data-chat-pane></div>
        <div class="w-1 bg-border cursor-col-resize hover:bg-primary/30 shrink-0" data-resize-handle></div>
        <div class="flex flex-col min-w-0 flex-1" data-canvas-pane></div>
      </div>
    </div>
  `;

  const submitBtn = container.querySelector("[data-submit-btn]");
  if (submitBtn) {
    submitBtn.addEventListener("click", async () => {
      submitBtn.disabled = true;
      try {
        await trpc.mutate("validations.submit", { projectId: Number(projectId), stage: key });
        toast.success("Enviado para validação da coordenação");
        await refreshProjectAndRender();
      } catch (err) {
        toast.error(err.message);
        submitBtn.disabled = false;
      }
    });
  }

  setupResizableSplit(container.querySelector("[data-split]"));
  buildChatPane(key, container.querySelector("[data-chat-pane]"), container.querySelector("[data-canvas-pane]"));
  buildCanvasPane(key, container.querySelector("[data-canvas-pane]"));
}

function setupResizableSplit(splitEl) {
  const handle = splitEl.querySelector("[data-resize-handle]");
  const left = splitEl.querySelector("[data-chat-pane]");
  let dragging = false;

  handle.addEventListener("mousedown", () => {
    dragging = true;
    document.body.style.cursor = "col-resize";
    document.body.style.userSelect = "none";
  });

  window.addEventListener("mousemove", (e) => {
    if (!dragging) return;
    const rect = splitEl.getBoundingClientRect();
    let pct = ((e.clientX - rect.left) / rect.width) * 100;
    pct = Math.min(75, Math.max(25, pct));
    left.style.flex = `0 0 ${pct}%`;
  });

  window.addEventListener("mouseup", () => {
    if (!dragging) return;
    dragging = false;
    document.body.style.cursor = "";
    document.body.style.userSelect = "";
  });
}

// ---- Chat pane ----

const MAX_ATTACHMENT_BYTES = 20 * 1024 * 1024; // 20MB — travels inline as base64 in the request

function fileToDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

function buildChatPane(moduleKey, chatEl, canvasEl) {
  chatEl.innerHTML = `
    <div class="flex items-center justify-between px-4 py-2 border-b shrink-0">
      <span class="text-sm font-medium text-muted-foreground">Conversa</span>
      <button type="button" class="btn-ghost btn-sm gap-1.5" data-new-conversation title="Apaga o histórico desta etapa e começa do zero">
        ${iconSvg("refresh", "w-3.5 h-3.5")} Nova conversa
      </button>
    </div>
    <div class="flex-1 overflow-y-auto p-4 space-y-4" data-messages></div>
    <div class="px-4 pt-2 flex flex-wrap gap-2 hidden" data-attachments-preview></div>
    <form class="flex gap-2 p-4 border-t items-end" data-chat-form>
      <input type="file" class="hidden" multiple data-file-input />
      <button type="button" class="canvas-toolbar-btn shrink-0 h-9 w-9" data-attach-btn title="Anexar arquivo">${iconSvg("paperclip", "w-4 h-4")}</button>
      <textarea class="field-textarea flex-1 max-h-32 min-h-9" rows="1" placeholder="Faça uma pergunta ou descreva o que você precisa..." data-chat-input></textarea>
      <button type="submit" class="btn-primary btn-icon shrink-0" data-chat-send>${iconSvg("send", "w-4 h-4")}</button>
    </form>
  `;

  const messagesEl = chatEl.querySelector("[data-messages]");
  const form = chatEl.querySelector("[data-chat-form]");
  const input = chatEl.querySelector("[data-chat-input]");
  const sendBtn = chatEl.querySelector("[data-chat-send]");
  const newConversationBtn = chatEl.querySelector("[data-new-conversation]");
  const attachBtn = chatEl.querySelector("[data-attach-btn]");
  const fileInput = chatEl.querySelector("[data-file-input]");
  const attachmentsPreview = chatEl.querySelector("[data-attachments-preview]");

  let messages = [];
  let isLoading = false;
  let pendingAttachments = [];

  function renderAttachmentsPreview() {
    attachmentsPreview.classList.toggle("hidden", pendingAttachments.length === 0);
    attachmentsPreview.innerHTML = pendingAttachments
      .map(
        (a, i) => `
        <span class="inline-flex items-center gap-1.5 rounded-full bg-muted px-3 py-1 text-xs">
          ${iconSvg("fileText", "w-3.5 h-3.5 text-muted-foreground")}
          ${escapeHtml(a.filename)}
          <button type="button" class="text-muted-foreground hover:text-foreground" data-remove-attachment="${i}">${iconSvg("x", "w-3 h-3")}</button>
        </span>
      `
      )
      .join("");

    attachmentsPreview.querySelectorAll("[data-remove-attachment]").forEach((btn) => {
      btn.addEventListener("click", () => {
        pendingAttachments.splice(Number(btn.dataset.removeAttachment), 1);
        renderAttachmentsPreview();
      });
    });
  }

  attachBtn.addEventListener("click", () => fileInput.click());

  fileInput.addEventListener("change", async () => {
    const files = [...fileInput.files];
    fileInput.value = "";

    for (const file of files) {
      if (file.size > MAX_ATTACHMENT_BYTES) {
        toast.error(`"${file.name}" é maior que 20MB e não foi anexado.`);
        continue;
      }
      try {
        const dataUrl = await fileToDataUrl(file);
        pendingAttachments.push({ filename: file.name, mimeType: file.type || "application/octet-stream", dataUrl });
      } catch (err) {
        toast.error(`Não foi possível ler "${file.name}".`);
      }
    }
    renderAttachmentsPreview();
  });

  function renderMessages() {
    if (messages.length === 0) {
      messagesEl.innerHTML = `
        <div class="h-full flex flex-col items-center justify-center gap-3 text-muted-foreground">
          ${iconSvg("sparkles", "w-10 h-10 opacity-20")}
          <p class="text-sm">Comece uma conversa com a IA</p>
        </div>
      `;
      return;
    }

    messagesEl.innerHTML = messages
      .map((m, i) => {
        if (m.role === "user") {
          const attachmentChips = m.attachments?.length
            ? `<div class="mt-2 flex flex-wrap gap-1.5">${m.attachments
                .map(
                  (a) => `
                <span class="inline-flex items-center gap-1 rounded-full bg-primary-foreground/15 px-2.5 py-0.5 text-xs">
                  ${iconSvg("fileText", "w-3 h-3")} ${escapeHtml(a.filename)}
                </span>
              `
                )
                .join("")}</div>`
            : "";
          return `
            <div class="flex gap-3 justify-end items-start">
              <div class="max-w-[80%] rounded-lg px-4 py-2.5 bg-primary text-primary-foreground">
                <p class="whitespace-pre-wrap text-sm">${escapeHtml(m.content)}</p>
                ${attachmentChips}
              </div>
              <div class="size-8 shrink-0 mt-1 rounded-full bg-secondary flex items-center justify-center">
                ${iconSvg("user", "size-4")}
              </div>
            </div>
          `;
        }
        const webSearchBadge = m.webSearchUsed
          ? `<div class="mb-2 inline-flex items-center gap-1.5 rounded-full bg-blue-100 text-blue-800 px-2.5 py-0.5 text-xs font-medium">
              ${iconSvg("globe", "size-3.5")} Pesquisou na internet
            </div>`
          : "";
        const sourcesList = m.citations?.length
          ? `<div class="mt-2 pt-2 border-t border-black/10">
              <p class="text-xs font-medium text-muted-foreground mb-1">Fontes:</p>
              <ul class="space-y-1">
                ${m.citations
                  .map(
                    (c) => `
                  <li class="text-xs truncate">
                    <a href="${c.url}" target="_blank" rel="noopener noreferrer" class="text-blue-700 hover:underline" title="${escapeHtml(c.url)}">${escapeHtml(c.title)}</a>
                  </li>
                `
                  )
                  .join("")}
              </ul>
            </div>`
          : "";
        return `
          <div class="flex gap-3 justify-start items-start">
            <div class="size-8 shrink-0 mt-1 rounded-full bg-primary/10 flex items-center justify-center">
              ${iconSvg("sparkles", "size-4 text-primary")}
            </div>
            <div class="max-w-[80%] rounded-lg px-4 py-2.5 bg-muted">
              ${webSearchBadge}
              <div class="prose max-w-none">${marked.parse(m.content)}</div>
              ${sourcesList}
              <button type="button" class="mt-2 inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground" data-save-msg="${i}">
                ${iconSvg("bookmarkPlus", "size-3.5")}
                Salvar no Canvas
              </button>
            </div>
          </div>
        `;
      })
      .join("");

    if (isLoading) {
      messagesEl.insertAdjacentHTML(
        "beforeend",
        `<div class="flex items-start gap-3">
          <div class="size-8 shrink-0 mt-1 rounded-full bg-primary/10 flex items-center justify-center">${iconSvg("sparkles", "size-4 text-primary")}</div>
          <div class="rounded-lg bg-muted px-4 py-2.5">${iconSvg("loader", "size-4 animate-spin text-muted-foreground")}</div>
        </div>`
      );
    }

    messagesEl.querySelectorAll("[data-save-msg]").forEach((btn) => {
      btn.addEventListener("click", () => {
        const msg = messages[Number(btn.dataset.saveMsg)];
        canvasEl.dispatchEvent(new CustomEvent("open-draft", { detail: msg.content }));
      });
    });

    messagesEl.scrollTop = messagesEl.scrollHeight;
  }

  (async () => {
    try {
      const history = await trpc.query("projects.getChatHistory", { projectId: Number(projectId), module: moduleKey });
      messages = history
        .filter((m) => m.role !== "system")
        .map((m) => {
          const citations = m.sources ? JSON.parse(m.sources) : [];
          return { role: m.role, content: m.message, citations, webSearchUsed: citations.length > 0 };
        });
      renderMessages();
    } catch (err) {
      toast.error(err.message);
    }
  })();

  newConversationBtn.addEventListener("click", async () => {
    if (!confirm("Iniciar nova conversa? Isso apaga o histórico desta etapa (o que já foi salvo no Canvas continua guardado).")) return;

    newConversationBtn.disabled = true;
    try {
      await trpc.mutate("projects.clearChatHistory", { projectId: Number(projectId), module: moduleKey });
      messages = [];
      renderMessages();
      toast.success("Conversa reiniciada");
    } catch (err) {
      toast.error(err.message);
    } finally {
      newConversationBtn.disabled = false;
    }
  });

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const content = input.value.trim();
    if ((!content && pendingAttachments.length === 0) || isLoading) return;

    const attachmentsToSend = pendingAttachments;
    pendingAttachments = [];
    renderAttachmentsPreview();

    messages.push({ role: "user", content, attachments: attachmentsToSend });
    input.value = "";
    isLoading = true;
    sendBtn.disabled = true;
    renderMessages();

    try {
      const response = await trpc.mutate("projects.sendMessage", {
        projectId: Number(projectId),
        module: moduleKey,
        message: content,
        conversationHistory: messages.slice(0, -1).map((m) => ({ role: m.role, content: m.content })),
        attachments: attachmentsToSend.length
          ? attachmentsToSend.map((a) => ({ filename: a.filename, mimeType: a.mimeType, dataUrl: a.dataUrl }))
          : undefined,
      });
      messages.push({ role: "assistant", content: response.message, webSearchUsed: response.webSearchUsed, citations: response.citations });
    } catch (err) {
      if (err.message && err.message.includes(AZURE_CONFIG_MISSING_MESSAGE)) {
        toast.error("IA não configurada. Configure o Azure OpenAI para continuar.", {
          action: { label: "Configurar IA", onClick: () => window.openAISettings && window.openAISettings() },
        });
      } else {
        toast.error("Não foi possível obter resposta da IA. Tente novamente.");
      }
      messages.pop();
    } finally {
      isLoading = false;
      sendBtn.disabled = false;
      renderMessages();
    }
  });

  input.addEventListener("keydown", (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      form.requestSubmit();
    }
  });
}

// ---- Canvas pane (Google Docs / ChatGPT Canvas style editor) ----

const STYLE_OPTIONS = [
  { value: "p", label: "Parágrafo" },
  { value: "h1", label: "Título 1" },
  { value: "h2", label: "Título 2" },
  { value: "h3", label: "Título 3" },
];

const FORMAT_BUTTONS = [
  { cmd: "bold", icon: "bold", title: "Negrito" },
  { cmd: "italic", icon: "italic", title: "Itálico" },
  { sep: true },
  { cmd: "insertUnorderedList", icon: "list", title: "Lista com marcadores" },
  { cmd: "insertOrderedList", icon: "listOrdered", title: "Lista numerada" },
  { sep: true },
  { cmd: "undo", icon: "undo", title: "Desfazer" },
  { cmd: "redo", icon: "redo", title: "Refazer" },
];

function buildCanvasPane(moduleKey, canvasEl) {
  canvasEl.innerHTML = `
    <div class="flex items-center gap-2 px-3 py-2 border-b shrink-0">
      <div class="relative shrink-0">
        <button type="button" class="btn-ghost btn-sm gap-1.5" data-doc-menu-btn>
          ${iconSvg("fileStack", "w-4 h-4")}
          <span class="hidden sm:inline">Documentos</span>
          ${iconSvg("chevronDown", "w-3.5 h-3.5")}
        </button>
        <div class="hidden absolute z-20 mt-1 w-64 rounded-lg border bg-card shadow-lg py-1 max-h-72 overflow-y-auto" data-doc-menu></div>
      </div>
      <input class="canvas-title-input" data-editor-title placeholder="Título do documento" disabled />
      <button type="button" class="canvas-toolbar-btn shrink-0" data-canvas-new title="Novo documento">${iconSvg("plus", "w-4 h-4")}</button>
      <button type="button" class="btn-primary btn-sm gap-1.5 shrink-0" data-editor-save disabled>${iconSvg("save", "w-3.5 h-3.5")} Salvar</button>
    </div>

    <div class="canvas-toolbar" data-format-toolbar>
      <select class="canvas-style-select" data-cmd-style disabled>
        ${STYLE_OPTIONS.map((o) => `<option value="${o.value}">${o.label}</option>`).join("")}
      </select>
      <span class="canvas-toolbar-sep"></span>
      ${FORMAT_BUTTONS.map((b) =>
        b.sep
          ? `<span class="canvas-toolbar-sep"></span>`
          : `<button type="button" class="canvas-toolbar-btn" data-cmd="${b.cmd}" title="${b.title}" disabled>${iconSvg(b.icon, "w-4 h-4")}</button>`
      ).join("")}
      <div class="flex-1"></div>
      <button type="button" class="canvas-toolbar-btn" data-print title="Imprimir" disabled>${iconSvg("printer", "w-4 h-4")}</button>
    </div>

    <div class="canvas-page-wrap">
      <div class="canvas-page is-empty" data-editor-content contenteditable="false" data-placeholder="Selecione um documento em &quot;Documentos&quot; ou clique em + para criar um novo."></div>
    </div>
  `;

  const menuBtn = canvasEl.querySelector("[data-doc-menu-btn]");
  const menuEl = canvasEl.querySelector("[data-doc-menu]");
  const titleInput = canvasEl.querySelector("[data-editor-title]");
  const saveBtn = canvasEl.querySelector("[data-editor-save]");
  const newBtn = canvasEl.querySelector("[data-canvas-new]");
  const printBtn = canvasEl.querySelector("[data-print]");
  const styleSelect = canvasEl.querySelector("[data-cmd-style]");
  const pageEl = canvasEl.querySelector("[data-editor-content]");
  const toolbarButtons = canvasEl.querySelectorAll("[data-cmd]");

  let docs = [];
  let selectedId = null;
  let isEditing = false;

  function setEditingEnabled(enabled) {
    isEditing = enabled;
    pageEl.contentEditable = String(enabled);
    titleInput.disabled = !enabled;
    saveBtn.disabled = !enabled;
    styleSelect.disabled = !enabled;
    printBtn.disabled = !enabled;
    toolbarButtons.forEach((b) => (b.disabled = !enabled));
  }

  function updateEmptyState() {
    const isEmpty = pageEl.textContent.trim().length === 0;
    pageEl.classList.toggle("is-empty", isEmpty);
  }

  async function loadDocs() {
    try {
      docs = await trpc.query("documents.list", { projectId: Number(projectId), module: moduleKey });
      renderMenu();
    } catch (err) {
      toast.error(err.message);
    }
  }

  function renderMenu() {
    if (docs.length === 0) {
      menuEl.innerHTML = `<p class="text-xs text-muted-foreground px-3 py-4 text-center">Nenhum documento salvo ainda.</p>`;
      return;
    }
    menuEl.innerHTML = docs
      .map(
        (d) => `
        <button type="button" class="w-full flex items-start gap-2 px-3 py-2 text-left text-sm hover:bg-accent transition-colors ${d.id === selectedId ? "bg-accent" : ""}" data-doc-id="${d.id}">
          ${iconSvg("fileText", "size-4 mt-0.5 shrink-0 text-muted-foreground")}
          <span class="truncate">${escapeHtml(d.title)}</span>
        </button>
      `
      )
      .join("");

    menuEl.querySelectorAll("[data-doc-id]").forEach((btn) => {
      btn.addEventListener("click", () => {
        const doc = docs.find((d) => d.id === Number(btn.dataset.docId));
        openDoc(doc.id, doc.title, doc.content);
        menuEl.classList.add("hidden");
      });
    });
  }

  function openDoc(id, title, content) {
    selectedId = id;
    titleInput.value = title;
    pageEl.innerHTML = content ? marked.parse(content) : "";
    updateEmptyState();
    setEditingEnabled(true);
    pageEl.focus();
  }

  menuBtn.addEventListener("click", (e) => {
    e.stopPropagation();
    menuEl.classList.toggle("hidden");
  });
  document.addEventListener("click", () => menuEl.classList.add("hidden"));
  menuEl.addEventListener("click", (e) => e.stopPropagation());

  newBtn.addEventListener("click", () => openDoc(null, "", ""));

  canvasEl.addEventListener("open-draft", (e) => openDoc(null, "", e.detail));

  pageEl.addEventListener("input", updateEmptyState);

  toolbarButtons.forEach((btn) => {
    btn.addEventListener("click", () => {
      pageEl.focus();
      document.execCommand(btn.dataset.cmd, false, null);
      updateEmptyState();
      refreshToolbarState();
    });
  });

  styleSelect.addEventListener("change", () => {
    pageEl.focus();
    document.execCommand("formatBlock", false, styleSelect.value);
  });

  function refreshToolbarState() {
    toolbarButtons.forEach((btn) => {
      try {
        btn.classList.toggle("is-active", document.queryCommandState(btn.dataset.cmd));
      } catch {
        /* ignore unsupported commands */
      }
    });
  }

  document.addEventListener("selectionchange", () => {
    if (document.activeElement === pageEl) refreshToolbarState();
  });

  printBtn.addEventListener("click", () => {
    const w = window.open("", "_blank");
    w.document.write(`<html><head><title>${escapeHtml(titleInput.value)}</title><link rel="stylesheet" href="/css/app.css"></head><body class="canvas-page" style="box-shadow:none;border:none;">${pageEl.innerHTML}</body></html>`);
    w.document.close();
    w.focus();
    w.print();
  });

  saveBtn.addEventListener("click", async () => {
    const t = titleInput.value.trim();
    if (!t) {
      toast.error("Dê um título ao documento antes de salvar");
      titleInput.focus();
      return;
    }
    const turndown = new TurndownService({ headingStyle: "atx", bulletListMarker: "-" });
    const content = turndown.turndown(pageEl.innerHTML);

    saveBtn.disabled = true;
    try {
      const result = await trpc.mutate("documents.save", { projectId: Number(projectId), module: moduleKey, id: selectedId ?? undefined, title: t, content });
      selectedId = result.id ?? selectedId;
      toast.success("Documento salvo no canvas");
      await loadDocs();
    } catch (err) {
      toast.error(err.message);
    } finally {
      saveBtn.disabled = false;
    }
  });

  loadDocs();
}

// ---- Consolidated tab ----

const CONSOLIDATED_MODULE_LABELS = {
  planning: { title: "Planejamento", icon: "bookOpen" },
  sources: { title: "Pesquisa de Fontes", icon: "users" },
  production: { title: "Produção de Conteúdo", icon: "settings" },
  resources: { title: "Recursos Adicionais", icon: "plus" },
};

async function loadConsolidated() {
  const el = document.getElementById("consolidated-content");
  el.innerHTML = `<div class="flex justify-center py-12"><div class="h-6 w-6 rounded-full border-2 border-primary border-t-transparent animate-spin"></div></div>`;

  let data;
  try {
    data = await trpc.query("documents.listAll", { projectId: Number(projectId) });
  } catch (err) {
    toast.error(err.message);
    return;
  }

  const total = MODULES.reduce((sum, m) => sum + data[m].length, 0);
  if (total === 0) {
    el.innerHTML = `
      <div class="card py-12 text-center">
        ${iconSvg("fileText", "w-10 h-10 text-slate-300 mx-auto mb-3")}
        <p class="text-slate-600">Nenhum documento salvo no canvas ainda.</p>
        <p class="text-sm text-slate-500 mt-1">Salve respostas da IA ou crie documentos manualmente em cada módulo para vê-los aqui.</p>
      </div>
    `;
    return;
  }

  el.innerHTML = "";
  MODULES.forEach((moduleKey) => {
    const docs = data[moduleKey];
    if (docs.length === 0) return;
    const { title, icon } = CONSOLIDATED_MODULE_LABELS[moduleKey];

    const section = document.createElement("div");
    section.className = "space-y-3 mb-6";
    section.innerHTML = `
      <div class="flex items-center gap-2 text-slate-700 font-medium">
        ${iconSvg(icon, "w-4 h-4")} ${title} <span class="text-xs text-slate-400">(${docs.length})</span>
      </div>
      <div data-doc-cards class="space-y-3"></div>
    `;
    el.appendChild(section);

    const cardsEl = section.querySelector("[data-doc-cards]");
    docs.forEach((doc) => cardsEl.appendChild(buildConsolidatedCard(moduleKey, doc)));
  });
}

function buildConsolidatedCard(moduleKey, doc) {
  const card = document.createElement("div");
  card.className = "card p-4";

  function renderView() {
    card.innerHTML = `
      <div class="flex items-start justify-between gap-2 mb-2">
        <h4 class="font-semibold">${escapeHtml(doc.title)}</h4>
        <button type="button" class="btn-ghost btn-sm gap-1.5 shrink-0" data-edit>${iconSvg("pencil", "w-4 h-4")} Editar</button>
      </div>
      <div class="prose max-w-none text-sm">${marked.parse(doc.content)}</div>
    `;
    card.querySelector("[data-edit]").addEventListener("click", renderEdit);
  }

  function renderEdit() {
    card.innerHTML = `
      <div class="flex items-start justify-between gap-2 mb-2">
        <input class="field-input font-semibold" data-title value="${escapeHtml(doc.title)}" />
        <div class="flex gap-1 shrink-0">
          <button type="button" class="btn-ghost btn-sm btn-icon" data-cancel>${iconSvg("x", "w-4 h-4")}</button>
          <button type="button" class="btn-primary btn-sm gap-1.5" data-save>${iconSvg("save", "w-4 h-4")} Salvar</button>
        </div>
      </div>
      <textarea class="field-textarea font-mono text-sm" style="min-height: 200px;" data-content>${escapeHtml(doc.content)}</textarea>
    `;
    card.querySelector("[data-cancel]").addEventListener("click", renderView);
    card.querySelector("[data-save]").addEventListener("click", async () => {
      const title = card.querySelector("[data-title]").value;
      const content = card.querySelector("[data-content]").value;
      try {
        await trpc.mutate("documents.save", { projectId: Number(projectId), module: moduleKey, id: doc.id, title, content });
        doc.title = title;
        doc.content = content;
        toast.success("Documento atualizado");
        renderView();
      } catch (err) {
        toast.error(err.message);
      }
    });
  }

  renderView();
  return card;
}

// ---- Init ----

document.addEventListener("DOMContentLoaded", async () => {
  document.getElementById("icon-back").innerHTML = iconSvg("arrowLeft", "w-4 h-4");
  document.getElementById("icon-planning").innerHTML = iconSvg("bookOpen", "w-5 h-5");
  document.getElementById("icon-sources").innerHTML = iconSvg("users", "w-5 h-5");
  document.getElementById("icon-production").innerHTML = iconSvg("settings", "w-5 h-5");
  document.getElementById("icon-resources").innerHTML = iconSvg("plus", "w-5 h-5");
  document.getElementById("icon-consolidated").innerHTML = iconSvg("fileStack", "w-5 h-5");
  document.getElementById("icon-filestack-wrap").innerHTML = iconSvg("fileStack", "w-5 h-5");

  const user = await requireAuth();
  if (!user) return;

  projectId = new URLSearchParams(location.search).get("id");
  if (!projectId) {
    window.location.href = "dashboard.html";
    return;
  }

  try {
    await refreshProjectAndRender();
  } catch (err) {
    console.error("project init failed", err);
    toast.error(err.message);
    window.location.href = "dashboard.html";
    return;
  }

  document.getElementById("loading").classList.add("hidden");
  document.getElementById("app").classList.remove("hidden");

  initTabs(document.getElementById("app"), {
    onChange: (value) => {
      if (value === "consolidated") loadConsolidated();
    },
  });
});
