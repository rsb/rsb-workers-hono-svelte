// Writes `apps/api/entry-chains.md` from the chains (L24): the links every
// chain shares, once, then one block per entry point, its entry chain on one
// line and a row per link. The columns line up across the whole file.

import type { Chains, Row } from "./chains.ts";

const fence = "```";

/** Each row as `label  path  symbols`, padded to the widths given. */
const rowLines = (rows: Row[], labelWidth: number, pathWidth: number) =>
  rows.map((row) => {
    const label = row.label.padEnd(labelWidth);
    if (row.symbols.length === 0) {
      return `${label}${row.path}`;
    }
    const path = row.path.padEnd(pathWidth);
    return `${label}${path}${row.symbols.join(", ")}`;
  });

/** The index, as the text to write. */
export const emitIndex = (chains: Chains, source: string, script: string) => {
  const every = [...chains.shared, ...chains.chains.flatMap((chain) => chain.rows)];
  const labelWidth = Math.max(...every.map((row) => row.label.length)) + 2;
  const pathWidth = Math.max(...every.map((row) => row.path.length)) + 2;

  const lines = [
    `Generated from ${source} by ${script}. Do not edit: change the code and regenerate.`,
    "",
    "# Entry chains",
    "",
    "Every entry point of the api, one block each: its entry chain on one",
    "line, then one row per link, with the file and the exported symbols",
    "that are the link. `→` is a direct call; `⇢` crosses a port, where",
    "construct picks the implementation. A probe runs no unit, so its",
    "block ends at the probe; a unit that declares no port reads nothing",
    "of its own, so its block ends at the unit. Private symbols are not",
    "links.",
    "",
    "## Shared links",
    "",
    "Every entry chain may pass through these. The gates run first, on",
    "every request, in the order construct lists them; then each route",
    "answers its unit's row with the runner's verdict before its handler.",
    "",
    `${fence}text`,
    ...rowLines(chains.shared, labelWidth, pathWidth),
    fence,
  ];
  for (const chain of chains.chains) {
    lines.push("", `## ${chain.key}`, "", `${fence}text`, chain.line, "", ...rowLines(chain.rows, labelWidth, pathWidth), fence);
  }
  return `${lines.join("\n")}\n`;
};
