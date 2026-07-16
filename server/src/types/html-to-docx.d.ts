// html-to-docx ships no TypeScript types. Minimal declaration for our usage.
declare module "html-to-docx" {
  interface DocxOptions {
    orientation?: "portrait" | "landscape";
    margins?: { top?: number; right?: number; bottom?: number; left?: number };
    title?: string;
    [key: string]: unknown;
  }
  /** Returns a .docx as a Buffer/Blob/ArrayBuffer depending on environment. */
  export default function HTMLtoDOCX(
    htmlString: string,
    headerHTMLString?: string | null,
    documentOptions?: DocxOptions,
    footerHTMLString?: string | null,
  ): Promise<Buffer>;
}
