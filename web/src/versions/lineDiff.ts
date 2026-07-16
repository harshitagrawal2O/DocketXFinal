export interface DiffRow {
  kind: "same" | "add" | "del";
  text: string;
}

/**
 * Minimal LCS-based line diff for the version comparison view. Not a merge
 * engine — purely presentational. Legal document text is line-oriented enough
 * that this reads well without pulling in a diff dependency.
 */
export function lineDiff(fromText: string, toText: string): DiffRow[] {
  const a = fromText.split("\n");
  const b = toText.split("\n");
  const n = a.length;
  const m = b.length;

  // LCS length table.
  const lcs: number[][] = Array.from({ length: n + 1 }, () => new Array<number>(m + 1).fill(0));
  for (let i = n - 1; i >= 0; i--) {
    for (let j = m - 1; j >= 0; j--) {
      lcs[i]![j] = a[i] === b[j] ? lcs[i + 1]![j + 1]! + 1 : Math.max(lcs[i + 1]![j]!, lcs[i]![j + 1]!);
    }
  }

  const rows: DiffRow[] = [];
  let i = 0;
  let j = 0;
  while (i < n && j < m) {
    if (a[i] === b[j]) {
      rows.push({ kind: "same", text: a[i]! });
      i++;
      j++;
    } else if (lcs[i + 1]![j]! >= lcs[i]![j + 1]!) {
      rows.push({ kind: "del", text: a[i]! });
      i++;
    } else {
      rows.push({ kind: "add", text: b[j]! });
      j++;
    }
  }
  while (i < n) rows.push({ kind: "del", text: a[i++]! });
  while (j < m) rows.push({ kind: "add", text: b[j++]! });
  return rows;
}
