import { expect, test } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

async function scan(page: import("@playwright/test").Page) {
  const results = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21aa"]).analyze();
  return results.violations.map((v) => `${v.id} (${v.impact}): ${v.nodes.map((n) => n.target.join(" ")).join(", ")}`);
}

test("home screen has no WCAG A/AA violations", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("textbox", { name: "Message" })).toBeVisible();
  expect(await scan(page)).toEqual([]);
});

test("chat and settings have no WCAG A/AA violations", async ({ page, isMobile }) => {
  await page.goto("/");
  const box = page.getByRole("textbox", { name: "Message" });
  await box.fill("Hello");
  await box.press("Enter");
  await expect(page.locator('[data-role="assistant"]').last()).toContainText("demo mode");
  expect(await scan(page)).toEqual([]);
  if (isMobile) await page.getByRole("button", { name: "Open sidebar" }).click();
  await page.getByRole("button", { name: "Settings" }).click();
  await expect(page.getByRole("dialog")).toBeVisible();
  expect(await scan(page)).toEqual([]);
});

test.describe("light theme", () => {
  test.use({ colorScheme: "light" });
  test("home screen has no WCAG A/AA violations", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByRole("textbox", { name: "Message" })).toBeVisible();
    expect(await scan(page)).toEqual([]);
  });
});

test("dialogs take focus and return it on close", async ({ page, isMobile }) => {
  test.skip(isMobile, "keyboard flow checked on desktop");
  await page.goto("/");
  const trigger = page.getByRole("button", { name: "Memory" });
  await trigger.focus();
  await page.keyboard.press("Enter");
  await expect(page.getByRole("dialog")).toBeVisible();
  await expect(page.getByRole("dialog")).toBeFocused();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).toBeHidden();
  await expect(trigger).toBeFocused();
});

test("no Content Security Policy violations during a chat", async ({ page }) => {
  const violations: string[] = [];
  page.on("console", (m) => /Content Security Policy|Refused to/.test(m.text()) && violations.push(m.text()));
  await page.goto("/");
  const box = page.getByRole("textbox", { name: "Message" });
  await box.fill("Hello");
  await box.press("Enter");
  await expect(page.locator('[data-role="assistant"]').last()).toContainText("demo mode");
  expect(violations).toEqual([]);
});
