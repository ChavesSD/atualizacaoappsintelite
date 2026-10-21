import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "tests/e2e",
  testMatch: /.*\.spec\.ts/,
  timeout: 120_000,
  fullyParallel: false,
  workers: 1,
  reporter: [["list"]],
  globalSetup: "./tests/e2e/global-setup.ts",
  use: { baseURL: "http://localhost:3200", trace: "retain-on-failure", screenshot: "only-on-failure", locale: "pt-BR" },
  projects: [
    // O fluxo do cliente é validado em viewport de celular (requisito de aceite nº 2).
    { name: "mobile", use: { ...devices["Pixel 7"] } },
    // Acessibilidade também em tela grande (o admin é usado principalmente no computador).
    { name: "desktop", testMatch: /a11y\.spec\.ts/, use: { viewport: { width: 1280, height: 800 } } },
  ],
});
