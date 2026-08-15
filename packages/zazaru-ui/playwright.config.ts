import { defineConfig, devices } from "@playwright/test";
export default defineConfig({ testDir: "./visual-tests", use: { baseURL: "http://127.0.0.1:6111", trace: "retain-on-failure" }, webServer: { command: "npm run showcase", url: "http://127.0.0.1:6111", reuseExistingServer: true, timeout: 120000 }, projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }] });
