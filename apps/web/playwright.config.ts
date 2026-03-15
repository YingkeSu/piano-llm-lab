import path from "node:path";
import { fileURLToPath } from "node:url";

import { defineConfig } from "@playwright/test";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, "../..");

export default defineConfig({
  testDir: "./e2e",
  timeout: 90_000,
  expect: {
    timeout: 8_000,
  },
  use: {
    baseURL: "http://localhost:4173",
    headless: true,
  },
  webServer: [
    {
      command: "npm run dev -w @piano-llm-lab/api",
      url: "http://localhost:8787/api/health",
      cwd: rootDir,
      timeout: 120_000,
      reuseExistingServer: !process.env.CI,
    },
    {
      command: "npm run dev -w @piano-llm-lab/web -- --host localhost --port 4173",
      url: "http://localhost:4173",
      cwd: rootDir,
      timeout: 120_000,
      reuseExistingServer: !process.env.CI,
    },
  ],
});
