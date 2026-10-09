import { expect, test } from "@playwright/test";

test("sends a message, streams a reply and keeps it after reload", async ({ page, isMobile }) => {
  await page.goto("/");
  const box = page.getByRole("textbox", { name: "Message" });
  await box.fill("Hello AEGIS");
  await box.press("Enter");

  const reply = page.locator('[data-role="assistant"]').last();
  await expect(reply).toContainText("demo mode");
  await expect(reply).toContainText("Hello AEGIS");
  await expect(page.getByTestId("chat-title")).toHaveText("Hello AEGIS");

  await page.reload();
  // On mobile the sidebar is a drawer.
  if (isMobile) await page.getByRole("button", { name: "Open sidebar" }).click();
  await page.getByRole("button", { name: "Hello AEGIS" }).first().click();
  await expect(page.locator('[data-role="assistant"]')).toContainText("demo mode");
});

test("remember that … saves a memory", async ({ page, isMobile }) => {
  await page.goto("/");
  const box = page.getByRole("textbox", { name: "Message" });
  await box.fill("Remember that my favourite language is Rust. Thanks!");
  await box.press("Enter");
  await expect(page.getByRole("status")).toContainText("Remembered");
  await expect(page.locator('[data-role="assistant"]').last()).toContainText("demo mode");

  if (isMobile) await page.getByRole("button", { name: "Open sidebar" }).click();
  await page.getByRole("button", { name: "Memory" }).click();
  await expect(page.getByTestId("memory-list")).toContainText("My favourite language is Rust");
});

test("workspaces carry their own chats", async ({ page, isMobile }) => {
  await page.goto("/");
  if (isMobile) await page.getByRole("button", { name: "Open sidebar" }).click();
  await page.getByRole("button", { name: "New workspace" }).click();
  await page.getByPlaceholder("e.g. Thesis, Startup, Spanish practice").fill("Thesis");
  await page.getByRole("button", { name: "Save" }).click();
  await expect(page.getByTestId("chat-title")).toHaveText("Thesis");
  const box = page.getByRole("textbox", { name: "Message" });
  await box.fill("Outline chapter one");
  await box.press("Enter");
  await expect(page.locator('[data-role="assistant"]').last()).toContainText("demo mode");
});

test("health endpoint reports status without secrets", async ({ request }) => {
  const res = await request.get("/api/health");
  expect(res.ok()).toBe(true);
  const body = await res.json();
  expect(body).toMatchObject({ status: "ok", demo: true });
  expect(JSON.stringify(body)).not.toMatch(/key/i);
});
