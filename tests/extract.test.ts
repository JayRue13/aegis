import { describe, expect, it } from "vitest";
import { detectKind, extractText } from "@/lib/server/extract";
import { makeDocx, makePdf } from "./fixtures/make-docs";

describe("detectKind", () => {
  it("uses magic bytes, not just the extension", () => {
    const pdf = makePdf(["x"]);
    expect(detectKind("a.pdf", "application/pdf", pdf.subarray(0, 8))).toBe("pdf");
    expect(detectKind("fake.pdf", "application/pdf", new TextEncoder().encode("hello"))).toBeNull();
    expect(detectKind("a.docx", "", new Uint8Array([0x50, 0x4b, 3, 4]))).toBe("docx");
    expect(detectKind("a.zip", "application/zip", new Uint8Array([0x50, 0x4b, 3, 4]))).toBeNull();
  });
});

describe("extractText", () => {
  it("reads PDF text with page markers", async () => {
    const { text, pages } = await extractText("pdf", makePdf(["Quarterly report", "Revenue grew 12 percent"]));
    expect(pages).toBe(1);
    expect(text).toContain("--- Page 1 ---");
    expect(text).toContain("Quarterly report");
    expect(text).toContain("Revenue grew 12 percent");
  });

  it("reads DOCX paragraphs", async () => {
    const { text } = await extractText("docx", await makeDocx(["Chapter One", "It was a bright cold day."]));
    expect(text).toBe("Chapter One\n\nIt was a bright cold day.");
  });
});
