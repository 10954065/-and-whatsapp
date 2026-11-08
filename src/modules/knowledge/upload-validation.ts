import { fail } from "@/lib/monitoring/errors";
import type { DocumentKind } from "@/modules/knowledge/extraction";

export const MAX_UPLOAD_BYTES = 10 * 1024 * 1024;

const TYPES: Record<string, { kind: DocumentKind; mimeTypes: string[] }> = {
  pdf: { kind: "pdf", mimeTypes: ["application/pdf"] },
  docx: { kind: "docx", mimeTypes: ["application/vnd.openxmlformats-officedocument.wordprocessingml.document"] },
  txt: { kind: "txt", mimeTypes: ["text/plain"] },
  md: { kind: "md", mimeTypes: ["text/markdown", "text/plain", "text/x-markdown"] },
  csv: { kind: "csv", mimeTypes: ["text/csv", "application/vnd.ms-excel", "text/plain"] },
};

function startsWith(bytes: Uint8Array, signature: number[]): boolean {
  return signature.every((byte, index) => bytes[index] === byte);
}

function looksLikeText(bytes: Uint8Array): boolean {
  const sample = bytes.subarray(0, 4_096);
  let suspicious = 0;
  for (const byte of sample) {
    if (byte === 0) return false;
    if (byte < 9 || (byte > 13 && byte < 32)) suspicious += 1;
  }
  return suspicious / Math.max(1, sample.length) < 0.02;
}

/**
 * Accepts only PDF, DOCX, TXT, MD and CSV, and checks that the file *content* matches the
 * claimed type (magic bytes / text heuristics) — the extension and MIME type alone are not
 * trusted. Files are only ever parsed for text, never executed or served back as HTML.
 */
export function validateUpload(fileName: string, mimeType: string, bytes: Uint8Array): { kind: DocumentKind; extension: string } {
  if (bytes.byteLength === 0) throw fail.validation("The file is empty.");
  if (bytes.byteLength > MAX_UPLOAD_BYTES) throw fail.validation("Files must be 10 MB or smaller.");
  const extension = fileName.toLowerCase().split(".").pop() ?? "";
  const type = TYPES[extension];
  if (!type) throw fail.validation("Upload a PDF, Word (.docx), text, Markdown or CSV file.");
  if (mimeType && !type.mimeTypes.includes(mimeType) && mimeType !== "application/octet-stream") {
    throw fail.validation("The file type does not match its extension.");
  }
  const contentMatches =
    type.kind === "pdf"
      ? startsWith(bytes, [0x25, 0x50, 0x44, 0x46, 0x2d])
      : type.kind === "docx"
        ? startsWith(bytes, [0x50, 0x4b, 0x03, 0x04])
        : looksLikeText(bytes);
  if (!contentMatches) throw fail.validation("The file content does not match its type.");
  return { kind: type.kind, extension };
}
