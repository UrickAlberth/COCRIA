const STATUS_LABELS = {
  draft: "Rascunho",
  awaiting_planning_validation: "Aguardando validação",
  planning_validated: "Planejamento validado",
  awaiting_sources_validation: "Aguardando validação de fontes",
  sources_validated: "Fontes validadas",
  in_production: "Em produção",
  completed: "Concluído",
};

const STATUS_COLORS = {
  draft: "bg-slate-100 text-slate-800",
  awaiting_planning_validation: "bg-yellow-100 text-yellow-800",
  planning_validated: "bg-blue-100 text-blue-800",
  awaiting_sources_validation: "bg-yellow-100 text-yellow-800",
  sources_validated: "bg-blue-100 text-blue-800",
  in_production: "bg-purple-100 text-purple-800",
  completed: "bg-green-100 text-green-800",
};

const MODULE_LABELS = {
  planning: "Planejamento",
  sources: "Pesquisa de Fontes",
  production: "Produção de Conteúdo",
  resources: "Recursos Adicionais",
  completed: "Concluído",
};

const MODULE_ICONS = {
  planning: "bookOpen",
  sources: "users",
  production: "settings",
  resources: "plus",
  completed: "checkCircle",
};

function renderProjectCard(project) {
  const div = document.createElement("div");
  div.className = "card hover:shadow-lg transition-shadow cursor-pointer p-6";
  div.innerHTML = `
    <div class="flex items-start justify-between mb-2">
      <div class="flex-1">
        <h4 class="text-lg font-semibold">${escapeHtml(project.title)}</h4>
        <p class="text-sm text-muted-foreground mt-1">${escapeHtml(project.description || "")}</p>
      </div>
      <span class="badge ${STATUS_COLORS[project.status] || "bg-slate-100 text-slate-800"} shrink-0 ml-2">
        ${STATUS_LABELS[project.status] || project.status}
      </span>
    </div>
    <div class="flex items-center gap-2 text-sm text-slate-600 mt-3">
      <span>${iconSvg(MODULE_ICONS[project.currentModule] || "bookOpen", "w-4 h-4")}</span>
      <span>${MODULE_LABELS[project.currentModule] || project.currentModule}</span>
    </div>
    <p class="text-xs text-slate-500 mt-2">Criado em ${new Date(project.createdAt).toLocaleDateString("pt-BR")}</p>
  `;
  div.addEventListener("click", () => {
    window.location.href = `project.html?id=${project.id}`;
  });
  return div;
}

async function loadProjects() {
  const grid = document.getElementById("projects-grid");
  const loading = document.getElementById("projects-loading");
  const empty = document.getElementById("projects-empty");

  loading.classList.remove("hidden");
  empty.classList.add("hidden");
  grid.innerHTML = "";

  try {
    const projects = await trpc.query("projects.list");
    loading.classList.add("hidden");

    if (projects.length === 0) {
      empty.classList.remove("hidden");
      return;
    }

    projects.forEach((p) => grid.appendChild(renderProjectCard(p)));
  } catch (err) {
    loading.classList.add("hidden");
    toast.error(err.message);
  }
}

document.addEventListener("DOMContentLoaded", async () => {
  document.getElementById("dash-logo").innerHTML = iconSvg("bookOpen", "w-6 h-6");
  document.getElementById("icon-validations").innerHTML = iconSvg("clipboardCheck", "w-4 h-4");
  document.getElementById("icon-prompts").innerHTML = iconSvg("settings", "w-4 h-4");
  document.getElementById("icon-lock").innerHTML = iconSvg("lock", "w-3 h-3");
  document.getElementById("icon-plus").innerHTML = iconSvg("plus", "w-4 h-4");

  const user = await requireAuth();
  if (!user) return;

  document.getElementById("user-name").textContent = user.name || "";
  document.getElementById("welcome-name").textContent = (user.name || "").split(" ")[0];
  document.getElementById("user-role").textContent =
    user.role === "coordinator" ? "Coordenação" : user.role === "content_creator" ? "Conteudista" : "Administrador";

  if (user.role === "coordinator" || user.role === "admin") {
    document.getElementById("admin-links").classList.remove("hidden");
  }

  document.getElementById("loading").classList.add("hidden");
  document.getElementById("app").classList.remove("hidden");

  loadProjects();

  const newProjectDialog = document.getElementById("new-project-dialog");
  const openNewProject = () => {
    document.getElementById("new-project-title").value = "";
    document.getElementById("new-project-description").value = "";
    openDialog(newProjectDialog);
  };
  document.getElementById("new-project-btn").addEventListener("click", openNewProject);
  document.getElementById("empty-new-project-btn").addEventListener("click", openNewProject);

  document.getElementById("new-project-form").addEventListener("submit", async (e) => {
    e.preventDefault();
    const title = document.getElementById("new-project-title").value.trim();
    if (!title) return;

    const submitBtn = document.getElementById("new-project-submit");
    submitBtn.disabled = true;
    try {
      await trpc.mutate("projects.create", {
        title,
        description: document.getElementById("new-project-description").value.trim() || undefined,
      });
      closeDialog(newProjectDialog);
      loadProjects();
    } catch (err) {
      toast.error(err.message);
    } finally {
      submitBtn.disabled = false;
    }
  });
});
