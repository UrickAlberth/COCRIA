// Shared auth helpers used by every protected page.

async function getCurrentUser() {
  try {
    return await trpc.query("auth.me");
  } catch {
    return null;
  }
}

/** Redirects to login.html if there is no session; returns the user otherwise. */
async function requireAuth() {
  const user = await getCurrentUser();
  if (!user) {
    window.location.href = "login.html";
    return null;
  }
  return user;
}

async function logout() {
  await trpc.mutate("auth.logout");
  window.location.href = "login.html";
}
