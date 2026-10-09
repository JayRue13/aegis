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
