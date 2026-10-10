import { defineConfig, devices } from "@playwright/test";

const PORT = Number(process.env.E2E_PORT ?? 3100);
const FAKE = PORT + 99;

export default defineConfig({
  testDir: "./e2e",
  timeout: 30_000,
  // The first request on a cold CI server can exceed the 5s default.
  expect: { timeout: 10_000 },
  retries: process.env.CI ? 1 : 0,
  use: {
    baseURL: `http://127.0.0.1:${PORT}`,
    launchOptions: process.env.PLAYWRIGHT_CHROMIUM_PATH ? { executablePath: process.env.PLAYWRIGHT_CHROMIUM_PATH } : {},
  },
  projects: [
    { name: "desktop", use: { ...devices["Desktop Chrome"] } },
    { name: "mobile", use: { ...devices["Pixel 7"] } },
  ],
  webServer: [
    {
      command: `node e2e/fake-provider.mjs`,
      url: `http://127.0.0.1:${FAKE}/v1/health`,
      env: { FAKE_PROVIDER_PORT: String(FAKE) },
    },
    {
      // Production build with the offline demo model as default plus a fake
      // OpenAI-compatible provider. No real keys, no network.
      command: `npx next start -p ${PORT}`,
      url: `http://127.0.0.1:${PORT}/api/health`,
      reuseExistingServer: false,
      env: {
        AEGIS_DEMO_MODE: "true",
        // The whole suite shares one IP; the limiter itself is covered by unit tests.
        AEGIS_RATE_LIMIT_PER_MIN: "1000",
        AEGIS_DEFAULT_MODEL: "demo:aegis-demo",
        CUSTOM_OPENAI_BASE_URL: `http://127.0.0.1:${FAKE}/v1`,
        CUSTOM_OPENAI_LABEL: "Fake",
        SEARXNG_URL: `http://127.0.0.1:${FAKE}`,
      },
    },
  ],
});
