import { describe, it, expect } from "vitest";
import { extForFilename, extractText, UnsupportedFileError } from "../fileExtract.js";

describe("extForFilename", () => {
  it("recognizes supported extensions case-insensitively", () => {
    expect(extForFilename("Contract.PDF")).toBe("pdf");
    expect(extForFilename("agreement.docx")).toBe("docx");
    expect(extForFilename("notes.txt")).toBe("txt");
    expect(extForFilename("readme.md")).toBe("md");
  });

  it("returns null for unsupported or missing extensions", () => {
    expect(extForFilename("legacy.doc")).toBeNull();
    expect(extForFilename("sheet.xlsx")).toBeNull();
    expect(extForFilename("no-extension")).toBeNull();
    expect(extForFilename("archive.tar.gz")).toBeNull();
  });
});

describe("extractText", () => {
  it("reads plain text files verbatim", async () => {
    const buf = Buffer.from("This is a Mutual NDA between Acme and Zeta.", "utf-8");
    const text = await extractText(buf, "draft.txt");
    expect(text).toContain("Mutual NDA");
  });

  it("rejects an unsupported extension with a helpful message", async () => {
    const buf = Buffer.from("irrelevant", "utf-8");
    await expect(extractText(buf, "legacy.doc")).rejects.toBeInstanceOf(UnsupportedFileError);
    await expect(extractText(buf, "legacy.doc")).rejects.toThrow(/\.docx/);
  });

  it("rejects a corrupted .docx without crashing", async () => {
    const buf = Buffer.from("not a real docx file", "utf-8");
    await expect(extractText(buf, "broken.docx")).rejects.toThrow(/could not read/i);
  });

  it("rejects a corrupted .pdf without crashing", async () => {
    const buf = Buffer.from("not a real pdf file", "utf-8");
    await expect(extractText(buf, "broken.pdf")).rejects.toThrow(/could not read/i);
  });
});
