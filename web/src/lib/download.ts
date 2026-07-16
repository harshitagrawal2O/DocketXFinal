/** Trigger a browser download of a Blob under the given filename. */
export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  // Revoke on the next tick so the click has a chance to start the download.
  setTimeout(() => URL.revokeObjectURL(url), 0);
}

/** Filesystem-safe version of a document title for use as a download name. */
export function safeFileName(title: string): string {
  const base = title.trim().replace(/[\\/:*?"<>|]+/g, "-").replace(/\s+/g, " ").trim();
  return base.length > 0 ? base : "document";
}
