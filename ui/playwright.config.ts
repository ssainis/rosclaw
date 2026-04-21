import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./e2e",
  timeout: 30_000,
  use: {
    baseURL: "http://127.0.0.1:4174",
    headless: true,
  },
  webServer: {
    command: "pnpm dev --host 127.0.0.1 --port 4174",
    port: 4174,
    timeout: 60_000,
    reuseExistingServer: false,
  },
});
