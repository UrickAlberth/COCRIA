import { defineConfig } from "drizzle-kit";
import path from "path";

const sqliteFilePath = process.env.SQLITE_FILE_PATH ?? path.join(process.cwd(), "data", "cocria.sqlite");

export default defineConfig({
  schema: "./drizzle/schema.ts",
  out: "./drizzle/migrations",
  dialect: "sqlite",
  dbCredentials: {
    url: sqliteFilePath,
  },
});
