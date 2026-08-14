document.addEventListener("DOMContentLoaded", async () => {
  document.getElementById("login-logo").innerHTML = iconSvg("bookOpen", "w-6 h-6");

  // Already authenticated? skip straight to the dashboard.
  const user = await getCurrentUser();
  if (user) {
    window.location.href = "dashboard.html";
    return;
  }

  initTabs(document.getElementById("login-tabs").parentElement);

  const loginForm = document.getElementById("login-form");
  const loginError = document.getElementById("login-error");
  const loginSubmit = document.getElementById("login-submit");

  loginForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    loginError.classList.add("hidden");
    loginSubmit.disabled = true;

    try {
      await trpc.mutate("auth.login", {
        email: document.getElementById("login-email").value,
        password: document.getElementById("login-password").value,
      });
      window.location.href = "dashboard.html";
    } catch (err) {
      loginError.textContent = err.message;
      loginError.classList.remove("hidden");
    } finally {
      loginSubmit.disabled = false;
    }
  });

  const registerForm = document.getElementById("register-form");
  const registerError = document.getElementById("register-error");
  const registerSubmit = document.getElementById("register-submit");

  registerForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    registerError.classList.add("hidden");
    registerSubmit.disabled = true;

    try {
      await trpc.mutate("auth.register", {
        name: document.getElementById("register-name").value,
        email: document.getElementById("register-email").value,
        password: document.getElementById("register-password").value,
      });
      window.location.href = "dashboard.html";
    } catch (err) {
      registerError.textContent = err.message;
      registerError.classList.remove("hidden");
    } finally {
      registerSubmit.disabled = false;
    }
  });
});
