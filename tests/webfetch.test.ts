import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createServer, type Server } from "node:http";
import { fetchPage, findUrls, htmlToText, isPrivateAddress } from "@/lib/server/webfetch";

describe("isPrivateAddress", () => {
  it("flags internal ranges", () => {
    for (const ip of [
      "127.0.0.1",
      "10.1.2.3",
      "172.20.0.1",
      "192.168.1.1",
      "169.254.169.254",
      "100.64.0.1",
      "0.0.0.0",
      "::1",
      "fd00::1",
      "fe80::1",
      "::ffff:127.0.0.1",
      "224.0.0.1",
    ]) {
      expect(isPrivateAddress(ip), ip).toBe(true);
    }
  });
  it("allows public addresses", () => {
    for (const ip of ["8.8.8.8", "1.1.1.1", "172.32.0.1", "2606:4700:4700::1111"]) {
      expect(isPrivateAddress(ip), ip).toBe(false);
    }
  });
});

describe("findUrls", () => {
  it("extracts distinct links without trailing punctuation", () => {
    expect(findUrls("See https://example.com/a. Also (https://example.org/b) and https://example.com/a!")).toEqual([
      "https://example.com/a",
      "https://example.org/b",
    ]);
    expect(findUrls("ftp://x.com and javascript:alert(1)")).toEqual([]);
    expect(findUrls("a http://a.com b http://b.com c http://c.com d http://d.com")).toHaveLength(3);
  });
});

describe("htmlToText", () => {
  it("keeps the article, drops scripts and navigation", () => {
    const { title, text } = htmlToText(`<html><head><title>My &amp; Page</title><style>.x{}</style></head>
      <body><nav>Menu</nav><article><h1>Hello</h1><p>First&nbsp;para &#8212; ok.</p><ul><li>One</li><li>Two</li></ul>
      <script>alert(1)</script></article><footer>Footer</footer></body></html>`);
    expect(title).toBe("My & Page");
    expect(text).toContain("# Hello");
    expect(text).toContain("First para — ok.");
    expect(text).toContain("- One");
    expect(text).not.toMatch(/alert|Menu|Footer|\.x\{\}/);
  });
});

describe("fetchPage", () => {
  let server: Server;
  let base = "";
  beforeAll(async () => {
    server = createServer((req, res) => {
      if (req.url === "/page") {
        res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
        return res.end("<title>Test page</title><main><p>Useful content here.</p></main>");
      }
      if (req.url === "/redirect") {
        res.writeHead(302, { Location: "/page" });
        return res.end();
      }
      if (req.url === "/image") {
        res.writeHead(200, { "Content-Type": "image/png" });
        return res.end(Buffer.alloc(10));
      }
      res.writeHead(404);
      res.end();
    });
    await new Promise<void>((r) => server.listen(0, "127.0.0.1", r));
    base = `http://127.0.0.1:${(server.address() as { port: number }).port}`;
  });
  afterAll(() => new Promise<void>((r) => server.close(() => r())));

  it("reads HTML and follows redirects", async () => {
    const r = await fetchPage(`${base}/redirect`, { allowPrivate: true });
    expect(r).toMatchObject({ ok: true, title: "Test page", url: `${base}/page` });
    expect(r.text).toContain("Useful content here.");
  });

  it("rejects non-text content and errors", async () => {
    expect(await fetchPage(`${base}/image`, { allowPrivate: true })).toMatchObject({ ok: false });
    expect(await fetchPage(`${base}/missing`, { allowPrivate: true })).toMatchObject({ ok: false, error: "HTTP 404" });
  });

  it("blocks private targets by IP and by hostname", async () => {
    expect(await fetchPage(`${base}/page`)).toMatchObject({ ok: false, error: "Private addresses are not fetched" });
    const port = base.split(":").pop();
    expect(await fetchPage(`http://localhost:${port}/page`)).toMatchObject({
      ok: false,
      error: "Private addresses are not fetched",
    });
    expect(await fetchPage("http://169.254.169.254/latest/meta-data")).toMatchObject({ ok: false });
  });

  it("refuses credentials and other schemes", async () => {
    expect(await fetchPage("http://user:pw@example.com/")).toMatchObject({ ok: false });
    expect(await fetchPage("file:///etc/passwd")).toMatchObject({ ok: false });
  });
});
