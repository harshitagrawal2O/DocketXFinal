/**
 * Tolerant incremental extractor for streaming tool-input JSON.
 *
 * The model streams its stage_changes tool input as partial JSON. We can't
 * JSON.parse an incomplete buffer, so to stream each hunk's newText token-by-
 * token we scan the raw buffer for `"newText"` string values and return their
 * current (possibly incomplete) decoded contents, in order. The Nth value
 * corresponds to hunk index N. Callers diff against previously-emitted lengths
 * to compute per-hunk deltas (see runner). Handles JSON string escapes and a
 * value that is still open at the end of the buffer.
 */
export function extractNewTexts(raw: string): string[] {
  const results: string[] = [];
  const key = '"newText"';
  let searchFrom = 0;

  for (;;) {
    const keyIdx = raw.indexOf(key, searchFrom);
    if (keyIdx === -1) break;

    // Find the opening quote of the value after the colon.
    let i = keyIdx + key.length;
    while (i < raw.length && raw[i] !== '"' && raw[i] !== "}") i++;
    if (i >= raw.length || raw[i] !== '"') {
      // colon/whitespace only so far, value not started
      searchFrom = keyIdx + key.length;
      if (i >= raw.length) break;
      searchFrom = i;
      continue;
    }

    // Decode the string value starting after the opening quote.
    i++; // past opening quote
    let out = "";
    let closed = false;
    while (i < raw.length) {
      const ch = raw[i]!;
      if (ch === "\\") {
        const next = raw[i + 1];
        if (next === undefined) break; // escape split across chunks; stop here
        switch (next) {
          case "n": out += "\n"; break;
          case "t": out += "\t"; break;
          case "r": out += "\r"; break;
          case '"': out += '"'; break;
          case "\\": out += "\\"; break;
          case "/": out += "/"; break;
          case "u": {
            const hex = raw.slice(i + 2, i + 6);
            if (hex.length === 4) {
              out += String.fromCharCode(parseInt(hex, 16));
              i += 4;
            }
            break;
          }
          default: out += next;
        }
        i += 2;
        continue;
      }
      if (ch === '"') {
        closed = true;
        i++;
        break;
      }
      out += ch;
      i++;
    }

    results.push(out);
    searchFrom = closed ? i : raw.length;
    if (!closed) break; // last value is still streaming; nothing after it yet
  }

  return results;
}
