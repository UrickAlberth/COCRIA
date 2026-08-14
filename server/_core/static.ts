import express, { type Express } from "express";
import path from "path";

// Serves the plain HTML/CSS/JS frontend from public/. Same behavior in dev and
// production — no bundler, no HMR, just static files + a 404 fallback.
export function servePublic(app: Express) {
  const publicDir = path.resolve(process.cwd(), "public");
  app.use(express.static(publicDir));
  app.use((_req, res) => {
    res.status(404).sendFile(path.join(publicDir, "404.html"));
  });
}
