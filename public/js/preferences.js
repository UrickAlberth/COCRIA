// Shared "Preferências" button + modal (like Claude.ai's "Instructions for Claude").
// Stores free-text tone/style preferences that get appended to every module's
// system prompt on the server. Include the markup block (see dashboard.html or
// project.html) and this script on any page that needs the button.

function initPreferences() {
  const btn = document.getElementById("preferences-btn");
  const dialog = document.getElementById("preferences-dialog");
  const form = document.getElementById("preferences-form");
  const textarea = document.getElementById("preferences-textarea");
  const count = document.getElementById("preferences-count");
  const saveBtn = document.getElementById("preferences-save");

  if (!btn || !dialog) return;

  const icon = document.getElementById("preferences-icon");
  if (icon) icon.innerHTML = iconSvg("settings", "w-4 h-4");

  function updateCount() {
    count.textContent = String(textarea.value.length);
  }

  textarea.addEventListener("input", updateCount);

  async function openPreferences() {
    try {
      const result = await trpc.query("settings.getCustomInstructions");
      textarea.value = result.customInstructions || "";
    } catch {
      textarea.value = "";
    }
    updateCount();
    openDialog(dialog);
  }

  btn.addEventListener("click", openPreferences);

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    saveBtn.disabled = true;
    try {
      await trpc.mutate("settings.saveCustomInstructions", { customInstructions: textarea.value });
      toast.success("Preferências salvas");
      closeDialog(dialog);
    } catch (err) {
      toast.error(err.message);
    } finally {
      saveBtn.disabled = false;
    }
  });
}

document.addEventListener("DOMContentLoaded", initPreferences);
