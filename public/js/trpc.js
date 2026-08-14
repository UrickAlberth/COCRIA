// Minimal tRPC HTTP client for vanilla JS — no batching, no superjson (server
// transformer was removed so this is plain JSON over fetch).

async function trpcRequest(method, path, input) {
  const opts = { method, credentials: "include" };
  let url = `/api/trpc/${path}`;

  if (method === "GET") {
    if (input !== undefined) {
      url += `?input=${encodeURIComponent(JSON.stringify(input))}`;
    }
  } else {
    opts.headers = { "content-type": "application/json" };
    opts.body = JSON.stringify(input ?? {});
  }

  const res = await fetch(url, opts);
  const json = await res.json().catch(() => null);

  if (!res.ok || json?.error) {
    const message = json?.error?.message || `Request failed (${res.status})`;
    throw new Error(message);
  }

  return json.result.data;
}

const trpc = {
  query: (path, input) => trpcRequest("GET", path, input),
  mutate: (path, input) => trpcRequest("POST", path, input),
};
