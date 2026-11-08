import { describe, expect, it } from "vitest";
import { isPrivateAddress, assertPublicUrl } from "@/lib/security/ssrf";
import { backoffMs } from "@/lib/queue";
import { buildObjectKey } from "@/lib/storage";
import { chunkText } from "@/modules/knowledge/chunking";
import { csvToText, extractText, htmlToText } from "@/modules/knowledge/extraction";
import { fuseRankings } from "@/modules/knowledge/retrieval";
import { validateUpload } from "@/modules/knowledge/upload-validation";

const encode = (text: string) => new TextEncoder().encode(text);

describe("chunkText", () => {
  it("keeps short text in one titled chunk", () => {
    const chunks = chunkText("We deliver within Accra.", { title: "Delivery" });
    expect(chunks).toEqual([{ ordinal: 0, content: "Delivery\nWe deliver within Accra.", tokenEstimate: expect.any(Number) }]);
  });
  it("splits long text into bounded, overlapping chunks", () => {
    const paragraph = "Sentence about kente cloth and pricing. ".repeat(30);
    const chunks = chunkText(`${paragraph}\n\n${paragraph}\n\n${paragraph}`, { maxChars: 600, overlapChars: 80 });
    expect(chunks.length).toBeGreaterThan(3);
    expect(chunks.every((chunk) => chunk.content.length <= 700)).toBe(true);
    expect(chunks.map((chunk) => chunk.ordinal)).toEqual(chunks.map((_, index) => index));
  });
});

describe("extraction", () => {
  it("turns CSV rows into self-describing lines", () => {
    expect(csvToText("Product,Price\nKente dress,450\nShea butter,35")).toBe("Product: Kente dress; Price: 450\nProduct: Shea butter; Price: 35");
  });
  it("strips scripts and markup from HTML", () => {
    const text = htmlToText("<html><script>alert(1)</script><h1>Menu</h1><p>Jollof &amp; chicken</p></html>");
    expect(text).not.toContain("alert");
    expect(text).toContain("Jollof & chicken");
  });
  it("decodes text documents and removes NUL bytes", async () => {
    expect(await extractText(encode("Opening hours\u0000: 8am"), "txt")).toBe("Opening hours: 8am");
  });
});

describe("validateUpload", () => {
  it("accepts real PDFs and text files", () => {
    expect(validateUpload("menu.pdf", "application/pdf", encode("%PDF-1.7 rest")).kind).toBe("pdf");
    expect(validateUpload("faq.txt", "text/plain", encode("Hello there")).kind).toBe("txt");
  });
  it.each([
    ["virus.exe", "application/octet-stream", encode("MZ...")],
    ["fake.pdf", "application/pdf", encode("<html>not a pdf</html>")],
    ["fake.docx", "application/vnd.openxmlformats-officedocument.wordprocessingml.document", encode("plain text")],
    ["binary.txt", "text/plain", new Uint8Array([0, 1, 2, 3, 0, 0])],
    ["mismatch.pdf", "image/png", encode("%PDF-1.7")],
    ["empty.txt", "text/plain", new Uint8Array()],
  ])("rejects %s", (name, type, bytes) => {
    expect(() => validateUpload(name, type, bytes)).toThrow();
  });
});

describe("SSRF guard", () => {
  it.each(["127.0.0.1", "10.1.2.3", "172.20.0.1", "192.168.1.1", "169.254.169.254", "100.64.0.1", "0.0.0.0", "::1", "fd00::1", "fe80::1", "::ffff:127.0.0.1"])(
    "treats %s as private",
    (ip) => expect(isPrivateAddress(ip)).toBe(true),
  );
  it.each(["8.8.8.8", "41.66.0.1", "2001:4860:4860::8888"])("treats %s as public", (ip) => expect(isPrivateAddress(ip)).toBe(false));
  it.each(["http://example.com", "https://localhost/admin", "https://127.0.0.1/", "https://user:pass@example.com", "https://example.com:8443/", "https://[::1]/"])(
    "rejects %s",
    async (url) => {
      await expect(assertPublicUrl(url)).rejects.toThrow();
    },
  );
});

describe("queue and storage helpers", () => {
  it("backs off exponentially with a ceiling", () => {
    expect(backoffMs(1)).toBe(30_000);
    expect(backoffMs(2)).toBe(60_000);
    expect(backoffMs(20)).toBe(3_600_000);
  });
  it("builds tenant-prefixed safe object keys", () => {
    const key = buildObjectKey("biz_123", "knowledge", "../../Price List (2026).PDF");
    expect(key.startsWith("biz_123/knowledge/")).toBe(true);
    expect(key).not.toContain("..");
    expect(key.endsWith("price-list-2026-.pdf")).toBe(true);
  });
  it("fuses ranked lists so items found by both rank first", () => {
    const chunk = (id: string) => ({ id, sourceId: "s", title: "t", content: id, score: 0 });
    const fused = fuseRankings([[chunk("a"), chunk("b")], [chunk("b"), chunk("c")]], 3);
    expect(fused[0].id).toBe("b");
  });
});
