import { expect, test } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

for (const story of ["settings-inspector", "command-palette-composition", "data-management-composition"]) {
  test(`${story} visual and accessibility`, async ({ page }) => {
    await page.goto(`/?story=showcase--${story}`);
    await page.locator("#ladle-root").waitFor();
    expect(await new AxeBuilder({ page }).analyze()).toMatchObject({ violations: [] });
    await expect(page).toHaveScreenshot(`${story}.png`, { fullPage: true, animations: "disabled" });
  });
}

for (const story of ["runtime", "repository", "pipeline"]) {
  test(`${story} dashboard visual and accessibility`, async ({ page }) => {
    await page.goto(`/?story=dashboard-examples--${story}`);
    await page.locator("#ladle-root").waitFor();
    expect(await new AxeBuilder({ page }).analyze()).toMatchObject({ violations: [] });
    await expect(page).toHaveScreenshot(`${story}-dashboard.png`, { fullPage: true, animations: "disabled" });
  });
}

test("reduced motion removes component transitions", async ({ page }) => { await page.emulateMedia({ reducedMotion: "reduce" }); await page.goto("/?story=showcase--forms"); await expect(page.locator(".z-spinner").first()).toHaveCSS("animation-duration", "0.001s"); });
