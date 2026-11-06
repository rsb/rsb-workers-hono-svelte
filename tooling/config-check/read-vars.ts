// The two places a Worker's vars are written: `vars` in wrangler.jsonc,
// and a `.dev.vars` file, which local dev lays over them.

/** JSON with comments, as wrangler.jsonc writes it: comments and trailing commas removed. */
export const parseJsonc = (text: string): unknown => {
  let out = "";
  let i = 0;
  while (i < text.length) {
    const char = text[i] as string;
    if (char === '"') {
      // A string, copied whole: a `//` inside one is not a comment.
      const start = i;
      i += 1;
      while (i < text.length && text[i] !== '"') {
        i += text[i] === "\\" ? 2 : 1;
      }
      i += 1;
      out += text.slice(start, i);
    } else if (text.startsWith("//", i)) {
      const end = text.indexOf("\n", i);
      i = end === -1 ? text.length : end;
    } else if (text.startsWith("/*", i)) {
      const end = text.indexOf("*/", i + 2);
      i = end === -1 ? text.length : end + 2;
    } else {
      out += char;
      i += 1;
    }
  }
  return JSON.parse(out.replace(/,(\s*[}\]])/g, "$1"));
};

/**
 * The `vars` of a wrangler.jsonc, as the Worker's env holds them: a string
 * var as a string, a JSON var as its value. An absent `vars` is none.
 */
export const wranglerVars = (text: string): Record<string, unknown> => {
  const config = parseJsonc(text) as { vars?: Record<string, unknown> };
  return { ...config.vars };
};

/** A `.dev.vars` file's entries: `KEY=value` lines, with `#` comments and blank lines skipped. */
export const devVars = (text: string): Record<string, string> => {
  const vars: Record<string, string> = {};
  for (const line of text.split("\n")) {
    const match = /^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*?)\s*$/.exec(line);
    if (match?.[1] !== undefined && match[2] !== undefined) {
      vars[match[1]] = match[2].replace(/^"(.*)"$/, "$1");
    }
  }
  return vars;
};
