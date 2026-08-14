import { execSync } from "child_process";
import { ProxyAgent, setGlobalDispatcher } from "undici";

// Node's global fetch (undici) does not read the system's outbound proxy on its
// own — unlike curl/browsers, it tries to connect directly and fails on networks
// that require one (e.g. TJMG's). We look for a proxy in two places, in order:
//   1. Standard HTTP(S)_PROXY env vars, if the process happens to have them.
//   2. Windows' machine-wide WinHTTP proxy (`netsh winhttp show proxy`) — this is
//      how the proxy is actually configured on TJMG machines, and env vars are
//      usually NOT set in a regular terminal even though curl/browsers still work
//      (they read WinHTTP/system settings directly, which Node does not).
function detectWindowsWinHttpProxy(): string | undefined {
  if (process.platform !== "win32") return undefined;

  try {
    const output = execSync("netsh winhttp show proxy", { encoding: "utf8" });
    // Locale-agnostic: the label ("Proxy Server(s)" / "Servidor(es) Proxy" / etc.)
    // varies with the Windows display language, but the value itself always looks
    // like a "host:port" token, e.g. "10.0.1.32:3128". Grab the first one.
    const match = output.match(/\b((?:\d{1,3}\.){3}\d{1,3}|[a-zA-Z0-9.-]+):(\d{2,5})\b/);
    if (!match) return undefined;
    return `http://${match[0]}`;
  } catch {
    return undefined;
  }
}

const proxyUrl =
  process.env.HTTPS_PROXY ||
  process.env.https_proxy ||
  process.env.HTTP_PROXY ||
  process.env.http_proxy ||
  detectWindowsWinHttpProxy();

if (proxyUrl) {
  setGlobalDispatcher(new ProxyAgent(proxyUrl));
  console.log(`[Proxy] Routing outbound requests through ${proxyUrl}`);
} else {
  console.log("[Proxy] No outbound proxy detected — calling APIs directly.");
}
