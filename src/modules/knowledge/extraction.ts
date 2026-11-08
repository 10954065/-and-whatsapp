import Papa from "papaparse";

export type DocumentKind = "pdf" | "docx" | "txt" | "md" | "csv" | "html";

const MAX_TEXT_CHARS = 400_000;

/** Converts an HTML page to readable text (scripts, styles and markup removed). */
export function htmlToText(html: string): string {
  return html
    .replace(/<(script|style|noscript|svg|iframe)[\s\S]*?<\/\1>/gi, " ")
    .replace(/<\/(p|div|li|h[1-6]|tr|section|article|br)>/gi, "\n")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/[ \t]+/g, " ")
    .replace(/\n\s*\n+/g, "\n\n")
    .trim();
}

/** CSV rows become "Column: value; Column: value" lines so each row is self-describing. */
export function csvToText(csv: string): string {
  const parsed = Papa.parse<Record<string, string>>(csv.trim(), { header: true, skipEmptyLines: true });
  if (!parsed.meta.fields?.length) return csv.trim();
  return parsed.data
    .map((row) =>
      Object.entries(row)
        .filter(([, value]) => value !== undefined && String(value).trim() !== "")
        .map(([key, value]) => `${key.trim()}: ${String(value).trim()}`)
        .join("; "),
    )
    .filter(Boolean)
    .join("\n");
}

/** Extracts plain text from an uploaded document. Never executes document content. */
export async function extractText(bytes: Uint8Array, kind: DocumentKind): Promise<string> {
  let text: string;
  switch (kind) {
    case "pdf": {
      const { extractText: extractPdf, getDocumentProxy } = await import("unpdf");
      const pdf = await getDocumentProxy(new Uint8Array(bytes));
      const result = await extractPdf(pdf, { mergePages: true });
      text = Array.isArray(result.text) ? result.text.join("\n") : result.text;
      break;
    }
    case "docx": {
      const mammoth = await import("mammoth");
      const result = await mammoth.extractRawText({ buffer: Buffer.from(bytes) });
      text = result.value;
      break;
    }
    case "csv":
      text = csvToText(new TextDecoder().decode(bytes));
      break;
    case "html":
      text = htmlToText(new TextDecoder().decode(bytes));
      break;
    default:
      text = new TextDecoder().decode(bytes);
  }
  return text.replace(/\u0000/g, "").trim().slice(0, MAX_TEXT_CHARS);
}
