import path from "path";

export const ENV = {
  appId: process.env.VITE_APP_ID ?? "",
  cookieSecret: process.env.JWT_SECRET ?? "dev-only-insecure-secret-change-me",
  // Local, zero-config SQLite file. No external database server required.
  sqliteFilePath: process.env.SQLITE_FILE_PATH ?? path.join(process.cwd(), "data", "cocria.sqlite"),
  isProduction: process.env.NODE_ENV === "production",
  forgeApiUrl: process.env.BUILT_IN_FORGE_API_URL ?? "",
  forgeApiKey: process.env.BUILT_IN_FORGE_API_KEY ?? "",
};
