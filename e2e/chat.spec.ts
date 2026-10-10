import { expect, test } from "@playwright/test";
import { makePdf } from "../tests/fixtures/make-docs";

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

test("JavaScript code blocks run in a sandbox", async ({ page }) => {
  await page.goto("/");
  await page.getByTestId("model-picker").click();
  await page.getByRole("option", { name: "echo-1" }).click();
  const box = page.getByRole("textbox", { name: "Message" });
  await box.fill("Please write some code");
  await box.press("Enter");
  const reply = page.locator('[data-role="assistant"]').last();
  const run = reply.getByRole("button", { name: "Run" });
  await expect(run).toHaveCount(3);

  await run.nth(0).click();
  const outputs = reply.getByRole("status", { name: "Code output" });
  await expect(outputs.first()).toContainText("sum 6");
  await expect(outputs.first()).toContainText('"ok": true');

  // An endless loop is stopped without freezing the page.
  await run.nth(1).click();
  await expect(reply.getByText("Stopped after 5 seconds.")).toBeVisible({ timeout: 15_000 });

  // The sandbox has no page APIs and no network.
  await run.nth(2).click();
  await expect(outputs.nth(2)).toContainText("undefined undefined");
  // Even a no-cors request to AEGIS's own server is refused.
  await expect(outputs.nth(2)).toContainText("Failed to fetch");
  await expect(outputs.nth(2)).not.toContainText("network allowed");
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

test("reads an attached PDF and sends it as context", async ({ page }) => {
  await page.goto("/");
  await page.locator('input[type="file"]').setInputFiles({
    name: "notes.pdf",
    mimeType: "application/pdf",
    buffer: Buffer.from(makePdf(["Photosynthesis converts light into chemical energy"])),
  });
  await expect(page.getByText("notes.pdf (1 pages)")).toBeVisible();
  const box = page.getByRole("textbox", { name: "Message" });
  await box.fill("Summarize this");
  await box.press("Enter");
  await expect(page.locator('[data-role="user"]').last()).toContainText("notes.pdf");
  await expect(page.locator('[data-role="assistant"]').last()).toContainText("Summarize this");
});

test("rejects a fake PDF with a clear message", async ({ page }) => {
  await page.goto("/");
  await page.locator('input[type="file"]').setInputFiles({
    name: "fake.pdf",
    mimeType: "application/pdf",
    buffer: Buffer.from("not really a pdf"),
  });
  await expect(page.getByText("Only PDF and Word (.docx) documents can be read.")).toBeVisible();
});

test("real provider path: streams, uses memory and learns new facts", async ({ page, isMobile }) => {
  await page.goto("/");
  await page.getByTestId("model-picker").click();
  await page.getByRole("option", { name: "echo-1" }).click();

  const box = page.getByRole("textbox", { name: "Message" });
  await box.fill("I am training to become a pilot, any study tips?");
  await box.press("Enter");
  await expect(page.locator('[data-role="assistant"]').last()).toContainText(
    "Echo: I am training to become a pilot, any study tips?",
  );
  await expect(page.getByRole("status")).toContainText("Learned");

  await box.fill("What should I study tomorrow?");
  await box.press("Enter");
  await expect(page.locator('[data-role="assistant"]').last()).toContainText("[memories received]");

  if (isMobile) await page.getByRole("button", { name: "Open sidebar" }).click();
  await page.getByRole("button", { name: "Memory" }).click();
  await expect(page.getByTestId("memory-list")).toContainText("User is training to be a pilot");
});

test("link reader refuses private addresses and shows it", async ({ page }) => {
  await page.goto("/");
  const box = page.getByRole("textbox", { name: "Message" });
  await box.fill("Summarize http://127.0.0.1:3199/v1/health please");
  await box.press("Enter");
  const sources = page.getByTestId("sources");
  await expect(sources).toContainText("127.0.0.1");
  await expect(sources.locator("a")).toHaveAttribute("title", /Private addresses are not fetched/);
});

test("voice input fills the message box", async ({ page }) => {
  await page.addInitScript(() => {
    class FakeRecognition {
      lang = "";
      continuous = false;
      interimResults = false;
      onresult: ((e: unknown) => void) | null = null;
      onend: (() => void) | null = null;
      onerror: ((e: unknown) => void) | null = null;
      start() {
        setTimeout(() => {
          this.onresult?.({ resultIndex: 0, results: [{ isFinal: true, 0: { transcript: "plan my study week" } }] });
          this.onend?.();
        }, 50);
      }
      stop() {
        this.onend?.();
      }
    }
    (window as unknown as { SpeechRecognition: unknown }).SpeechRecognition = FakeRecognition;
  });
  await page.goto("/");
  await page.getByRole("button", { name: "Voice input" }).click();
  await expect(page.getByRole("textbox", { name: "Message" })).toHaveValue("plan my study week");
});

test("research mode searches the web and shows sources", async ({ page }) => {
  await page.goto("/");
  await page.getByTestId("model-picker").click();
  await page.getByRole("option", { name: "echo-1" }).click();
  await page.getByRole("combobox", { name: "Assistant mode" }).selectOption("research");
  await expect(page.getByRole("button", { name: "Search the web" })).toHaveAttribute("aria-pressed", "true");

  const box = page.getByRole("textbox", { name: "Message" });
  await box.fill("How do pilots study weather?");
  await box.press("Enter");
  const reply = page.locator('[data-role="assistant"]').last();
  await expect(reply).toContainText("[search received]");
  await expect(reply).toContainText("[research mode]");
  await expect(page.getByTestId("sources")).toContainText("Pilot training basics");
});

test("agent mode uses tools and asks before saving a memory", async ({ page, isMobile }) => {
  await page.goto("/");
  await page.getByTestId("model-picker").click();
  await page.getByRole("option", { name: "echo-1" }).click();
  await page.getByRole("combobox", { name: "Assistant mode" }).selectOption("agent");

  const box = page.getByRole("textbox", { name: "Message" });
  await box.fill("What is 6 times 7? Remember it's my favorite number.");
  await box.press("Enter");
  const reply = page.locator('[data-role="assistant"]').last();
  await expect(reply).toContainText("Agent result: 42");
  await expect(page.getByTestId("agent-steps")).toContainText("Calculated 6*7 = 42");

  const card = page.getByTestId("agent-action");
  await expect(card).toContainText("Remember: “Favorite number is 42”");
  // Nothing is saved until the user approves.
  if (isMobile) await page.getByRole("button", { name: "Open sidebar" }).click();
  await page.getByRole("button", { name: "Memory" }).click();
  await expect(page.getByTestId("memory-list")).not.toContainText("Favorite number is 42");
  await page.getByRole("button", { name: "Close", exact: true }).click();
  if (isMobile) await page.getByRole("complementary").getByRole("button", { name: "Close sidebar" }).click();

  await card.getByRole("button", { name: "Approve" }).click();
  await expect(card).toContainText("Approved");
  await page.reload();
  if (isMobile) await page.getByRole("button", { name: "Open sidebar" }).click();
  await page.getByRole("button", { name: "Memory" }).click();
  await expect(page.getByTestId("memory-list")).toContainText("Favorite number is 42");
  await page.getByRole("button", { name: "Close", exact: true }).click();
  if (isMobile) await page.getByRole("complementary").getByRole("button", { name: "Close sidebar" }).click();

  // The decision is stored with the chat.
  if (isMobile) await page.getByRole("button", { name: "Open sidebar" }).click();
  await page
    .getByRole("button", { name: /What is 6 times 7/ })
    .first()
    .click();
  await expect(page.getByTestId("agent-action")).toContainText("Approved");
});

test("works offline after the first visit", async ({ page, context, browserName, isMobile }) => {
  test.skip(browserName !== "chromium", "service worker test uses Chromium");
  await page.goto("/");
  const box = page.getByRole("textbox", { name: "Message" });
  await box.fill("Offline check");
  await box.press("Enter");
  await expect(page.locator('[data-role="assistant"]').last()).toContainText("Offline check");
  // Wait until the service worker controls the page and has cached the shell.
  await page.evaluate(async () => {
    await navigator.serviceWorker.ready;
    if (!navigator.serviceWorker.controller) {
      await new Promise((r) => navigator.serviceWorker.addEventListener("controllerchange", r, { once: true }));
    }
  });
  await page.reload();
  await page.waitForFunction(async () => (await caches.keys()).some((k) => k.startsWith("aegis-assets")));

  await context.setOffline(true);
  await page.reload();
  await expect(page.getByTestId("offline-banner")).toBeVisible();
  await expect(page.getByRole("textbox", { name: "Message" })).toBeVisible();
  if (isMobile) await page.getByRole("button", { name: "Open sidebar" }).click();
  await page.getByRole("button", { name: "Offline check" }).first().click();
  await expect(page.locator('[data-role="assistant"]').last()).toContainText("Offline check");
  await context.setOffline(false);
  await expect(page.getByTestId("offline-banner")).toBeHidden();
});
