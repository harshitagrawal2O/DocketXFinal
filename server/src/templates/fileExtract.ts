import mammoth from "mammoth";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { pathToFileURL } from "node:url";

const require = createRequire(import.meta.url);
// pdfjs-dist needs on-disk paths to its bundled standard fonts/cmaps for
// correct glyph-to-text mapping on real-world PDFs (not every PDF embeds its
// own font program). Resolved via require so it's correct however npm
// workspace hoisting placed the package, not hardcoded to a relative path.
const pdfjsDistDir = dirname(require.resolve("pdfjs-dist/package.json"));
const standardFontDataUrl = `${pathToFileURL(join(pdfjsDistDir, "standard_fonts")).href}/`;
const cMapUrl = `${pathToFileURL(join(pdfjsDistDir, "cmaps")).href}/`;

/**
 * Extract plain text from an uploaded document (PDF / DOCX / TXT) so it can
 * feed the same analyzeTemplate() pipeline as pasted text. Confidentiality
 * (invariant #7): never log file/document CONTENT — only filename, mimetype,
 * size, and error messages on failure.
 */

export const MAX_UPLOAD_BYTES = 20 * 1024 * 1024; // 20MB

export type SupportedExt = "pdf" | "docx" | "txt" | "md";

export function extForFilename(filename: string): SupportedExt | null {
  const m = /\.([a-z0-9]+)$/i.exec(filename);
  const ext = m?.[1]?.toLowerCase();
  if (ext === "pdf" || ext === "docx" || ext === "txt" || ext === "md") return ext;
  return null;
}

export class UnsupportedFileError extends Error {}
export class FileParseError extends Error {}

/** Cost/abuse guard: a template only needs to see so much of a document. */
const MAX_PDF_PAGES = 200;

async function extractPdfText(buffer: Buffer): Promise<string> {
  const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
  const loadingTask = pdfjs.getDocument({
    data: new Uint8Array(buffer),
    standardFontDataUrl,
    cMapUrl,
    cMapPacked: true,
    useSystemFonts: false,
  });
  const doc = await loadingTask.promise;

  try {
    const pageCount = Math.min(doc.numPages, MAX_PDF_PAGES);
    const pageTexts: string[] = [];
    for (let pageNum = 1; pageNum <= pageCount; pageNum++) {
      const page = await doc.getPage(pageNum);
      const content = await page.getTextContent();
      const pageText = content.items.map((item) => ("str" in item ? item.str : "")).join(" ");
      pageTexts.push(pageText);
      page.cleanup();
    }
    if (doc.numPages > MAX_PDF_PAGES) {
      pageTexts.push(`\n[Truncated — only the first ${MAX_PDF_PAGES} of ${doc.numPages} pages were analyzed.]`);
    }
    return pageTexts.join("\n\n");
  } finally {
    await loadingTask.destroy();
  }
}

/** Extract text from a file buffer. Throws UnsupportedFileError / FileParseError with a user-safe message. */
export async function extractText(buffer: Buffer, filename: string): Promise<string> {
  const ext = extForFilename(filename);
  if (!ext) {
    throw new UnsupportedFileError(
      "Unsupported file type. Please upload a .pdf, .docx, or .txt file (legacy .doc is not supported — save it as .docx first).",
    );
  }

  try {
    if (ext === "txt" || ext === "md") {
      return buffer.toString("utf-8");
    }
    if (ext === "docx") {
      const result = await mammoth.extractRawText({ buffer });
      return result.value;
    }
    // ext === "pdf" — pdfjs-dist (the actively-maintained official Mozilla
    // library) rather than pdf-parse, whose bundled pdf.js fork is stale and
    // rejects some spec-valid PDFs with a hard-to-diagnose "bad XRef entry".
    return await extractPdfText(buffer);
  } catch (err) {
    console.error(`[templates] failed to extract text from a .${ext} upload:`, (err as Error).message);
    throw new FileParseError(
      `Could not read that ${ext.toUpperCase()} file — it may be corrupted, password-protected, or a scanned image without selectable text.`,
    );
  }
}
