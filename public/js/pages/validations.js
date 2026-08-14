const STAGE_LABELS = {
  planning: "Planejamento pedagógico",
  sources: "Pesquisa de fontes",
  production: "Produção de conteúdo",
};

const STATUS_BADGE = {
  pending: { label: "Pendente", cls: "bg-yellow-100 text-yellow-800" },
  approved: { label: "Aprovada", cls: "bg-green-100 text-green-800" },
  rejected: { label: "Rejeitada", cls: "bg-red-100 text-red-800" },
};

let rejectingValidation = null;

function renderValidationCard(v, showActions) {
  const div = document.createElement("div");
  div.className = "p-4 border border-slate-200 rounded-lg";
  const badge = STATUS_BADGE[v.status];

  div.innerHTML = `
    <div class="flex items-start justify-between mb-3">
      <div>
        <h4 class="font-medium text-slate-900">${escapeHtml(v.projectTitle)}</h4>
        <p class="text-sm text-slate-600">${STAGE_LABELS[v.stage] || v.stage}</p>
      </div>
      <span class="badge ${badge.cls}">${badge.label}</span>
    </div>
    ${v.submittedAt ? `<p class="text-sm text-slate-600 mb-2">Submetido em ${new Date(v.submittedAt).toLocaleString("pt-BR")}</p>` : ""}
    ${v.comments ? `<p class="text-sm text-slate-600 mb-4 italic">"${escapeHtml(v.comments)}"</p>` : ""}
    ${showActions ? `
      <div class="flex gap-2">
        <button type="button" class="btn-primary btn-sm gap-2" data-approve>${iconSvg("checkCircle", "w-4 h-4")} Aprovar</button>
        <button type="button" class="btn-destructive btn-sm gap-2" data-reject>${iconSvg("xCircle", "w-4 h-4")} Rejeitar</button>
      </div>
    ` : ""}
  `;

  if (showActions) {
    div.querySelector("[data-approve]").addEventListener("click", async (e) => {
      e.target.closest("button").disabled = true;
      try {
        await trpc.mutate("validations.approve", { validationId: v.id, projectId: v.projectId, stage: v.stage });
        toast.success("Validação aprovada — o projeto avançou de etapa");
        loadAll();
      } catch (err) {
        toast.error(err.message);
      }
    });

    div.querySelector("[data-reject]").addEventListener("click", () => {
      rejectingValidation = v;
      document.getElementById("reject-project-title").textContent = v.projectTitle;
      document.getElementById("reject-comments").value = "";
      openDialog("reject-dialog");
    });
  }

  return div;
}

async function loadList(listId, procedure, input, showActions) {
  const el = document.getElementById(listId);
  el.innerHTML = `<div class="flex justify-center py-8"><div class="h-6 w-6 rounded-full border-2 border-primary border-t-transparent animate-spin"></div></div>`;
  try {
    const items = await trpc.query(procedure, input);
    if (items.length === 0) {
      el.innerHTML = `<p class="text-slate-600 text-center py-8">Nenhum item encontrado</p>`;
      return;
    }
    el.innerHTML = "";
    items.forEach((v) => el.appendChild(renderValidationCard(v, showActions)));
  } catch (err) {
    el.innerHTML = `<p class="text-slate-600 text-center py-8">Erro ao carregar</p>`;
    toast.error(err.message);
  }
}

function loadAll() {
  loadList("pending-list", "validations.listPending", undefined, true);
  loadList("approved-list", "validations.listByStatus", { status: "approved" }, false);
  loadList("rejected-list", "validations.listByStatus", { status: "rejected" }, false);
}

document.addEventListener("DOMContentLoaded", async () => {
  document.getElementById("icon-back").innerHTML = iconSvg("arrowLeft", "w-4 h-4");
  document.getElementById("icon-clock").innerHTML = iconSvg("clock", "w-4 h-4");
  document.getElementById("icon-check").innerHTML = iconSvg("checkCircle", "w-4 h-4");
  document.getElementById("icon-xcircle").innerHTML = iconSvg("xCircle", "w-4 h-4");

  const user = await requireAuth();
  if (!user) return;

  if (user.role !== "coordinator" && user.role !== "admin") {
    document.getElementById("loading").classList.add("hidden");
    document.getElementById("no-access").classList.remove("hidden");
    return;
  }

  document.getElementById("loading").classList.add("hidden");
  document.getElementById("app").classList.remove("hidden");

  initTabs(document.getElementById("app"));
  loadAll();

  document.getElementById("reject-confirm").addEventListener("click", async () => {
    const comments = document.getElementById("reject-comments").value;
    if (comments.trim().length < 10) {
      toast.error("Comentário deve ter pelo menos 10 caracteres");
      return;
    }

    try {
      await trpc.mutate("validations.reject", {
        validationId: rejectingValidation.id,
        projectId: rejectingValidation.projectId,
        stage: rejectingValidation.stage,
        comments,
      });
      toast.success("Validação rejeitada");
      closeDialog("reject-dialog");
      loadAll();
    } catch (err) {
      toast.error(err.message);
    }
  });
});
