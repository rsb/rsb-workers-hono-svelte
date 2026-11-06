// Reads an api spec (`prd/<app>/api.md`) written in the vocabulary of the api
// story, chapter 11 (L26), into plain data. Line by line: every line is a
// heading, a labelled line, a list item, prose or blank. A line the
// vocabulary does not allow is a problem, reported with its line number.

export type Type =
  | { kind: "text" }
  | { kind: "boolean" }
  | { kind: "integer"; min: number | undefined }
  | { kind: "literal"; value: string | boolean }
  | { kind: "oneOf"; values: string[] }
  | { kind: "listOf"; shape: string }
  | { kind: "ref"; shape: string };

export type Field = {
  name: string;
  type: Type;
  optional: boolean;
  message: string | undefined;
};

/** An object rule: `at least N fields "message"`. */
export type AtLeast = { fields: number; message: string | undefined };

/** A named shape: an object with fields, or a list of another shape. */
export type Shape =
  | { name: string; doc: string | undefined; kind: "object"; fields: Field[]; atLeast: AtLeast | undefined }
  | { name: string; doc: string | undefined; kind: "list"; of: string };

/**
 * An error kind and its status. `carries` is the one extra member its error
 * has beside `kind` and `message`: `field` names the input that broke a rule,
 * `reason` says why a known caller is refused (PRD, Envelope). `reasons` is
 * the closed list a `reason` is one of, and is empty for any other kind.
 */
export type ErrorKind = { name: string; status: number; carries: "field" | "reason" | undefined; reasons: string[] };

/** An example's request, as the request line and body the spec writes. */
export type Request = {
  method: string;
  /** The path as sent, with its parameters filled in. */
  path: string;
  /** The path parameters, read from the path by the endpoint's template. */
  params: Record<string, string>;
  /** The query string's keys and values in order; a key given twice appears twice. */
  query: [string, string][];
  /** The parsed JSON body; undefined when the request has none. */
  body: unknown;
};

/** A worked example: a request, and the reply's status and whole envelope. */
export type Example = {
  name: string;
  /** Undefined for the examples every endpoint shares, which any request can cause. */
  request: Request | undefined;
  status: number;
  reply: unknown;
  line: number;
};

export type Endpoint = {
  method: string;
  path: string;
  serves: string;
  /**
   * The rules the endpoint's validator applies, by id, as `Applies:` writes
   * them; empty for `Applies: none`, undefined when the line is absent. That
   * each id is a rule, and that the validator applies them, is the join's.
   */
  applies: string[] | undefined;
  params: Field[];
  /** The query shape's name, inline or shared. */
  query: string | undefined;
  /** The body shape's name, inline or shared. */
  body: string | undefined;
  status: number;
  /** The reply shape's name, inline or shared. */
  reply: string;
  /** The kinds this endpoint adds to the ones every endpoint can return. */
  errors: string[];
  examples: Example[];
  line: number;
};

export type Spec = {
  title: string;
  /** The prose of "Every endpoint", as written: the rules no field can state. */
  everyProse: string;
  /** The kinds every endpoint can return, from "Every endpoint". */
  everyKinds: string[];
  /** The examples of the kinds every endpoint can return. */
  everyExamples: Example[];
  kinds: ErrorKind[];
  /** Every named shape, shared or inline, in the order the spec names it. */
  shapes: Shape[];
  /** The names of the shapes in "Shapes". */
  shared: string[];
  endpoints: Endpoint[];
};

export type Problem = { line: number; message: string };

export type Parsed = { ok: true; spec: Spec } | { ok: false; problems: Problem[] };

const SECTIONS = ["Every endpoint", "Errors", "Shapes", "Endpoints"] as const;
type Section = (typeof SECTIONS)[number];

const METHODS = ["GET", "POST", "PUT", "PATCH", "DELETE"];
const PARTS = ["Serves", "Applies", "Path", "Query", "Body", "Reply", "Errors", "Examples"] as const;
type Part = (typeof PARTS)[number];

const NAME = "[A-Za-z_][A-Za-z0-9_]*";

/** Reads the type words of a field, after the colon, without `optional` or the message. */
export const parseType = (words: string): Type | string => {
  if (words === "text") {
    return { kind: "text" };
  }
  if (words === "boolean") {
    return { kind: "boolean" };
  }
  if (words === "integer") {
    return { kind: "integer", min: undefined };
  }

  const integer = /^integer, min (-?\d+)$/.exec(words);
  if (integer) {
    return { kind: "integer", min: Number(integer[1]) };
  }

  const literal = /^literal `(.+)`$/.exec(words);
  if (literal) {
    const value = literal[1] as string;
    if (value === "true" || value === "false") {
      return { kind: "literal", value: value === "true" };
    }
    const quoted = /^"(.*)"$/.exec(value);
    if (quoted) {
      return { kind: "literal", value: quoted[1] as string };
    }
    return `literal value ${value} is neither true, false nor quoted text`;
  }

  const oneOf = /^one of ((?:`"[^"`]*"`\s*)+)$/.exec(words);
  if (oneOf) {
    const values = [...(oneOf[1] as string).matchAll(/`"([^"`]*)"`/g)].map((m) => m[1] as string);
    return { kind: "oneOf", values };
  }

  const listOf = new RegExp(`^list of \`(${NAME})\`$`).exec(words);
  if (listOf) {
    return { kind: "listOf", shape: listOf[1] as string };
  }

  const ref = new RegExp(`^\`(${NAME})\`$`).exec(words);
  if (ref) {
    return { kind: "ref", shape: ref[1] as string };
  }

  return `unknown type "${words}"`;
};

/** Reads one field: `` - `name`: type, optional "message" ``. */
export const parseField = (line: string): Field | string => {
  const head = new RegExp(`^- \`(${NAME})\`: (.+)$`).exec(line);
  if (!head) {
    return 'a field is "- `name`: type"';
  }
  const name = head[1] as string;
  let rest = (head[2] as string).trim();

  let message: string | undefined;
  const quoted = /\s*"([^"]*)"$/.exec(rest);
  if (quoted) {
    message = quoted[1];
    rest = rest.slice(0, quoted.index).trim();
  }

  let optional = false;
  if (rest.endsWith(", optional")) {
    optional = true;
    rest = rest.slice(0, -", optional".length).trim();
  }

  const type = parseType(rest);
  if (typeof type === "string") {
    return `field ${name}: ${type}`;
  }
  return { name, type, optional, message };
};

/** Reads what follows a shape label: `` `Name` ``, then an optional object rule. */
const parseShapeHead = (text: string): { name: string; atLeast: AtLeast | undefined } | string => {
  const head = new RegExp(`^\`(${NAME})\`(?:, (.+))?$`).exec(text);
  if (!head) {
    return "a shape is named in code font: `Name`";
  }
  const name = head[1] as string;
  const rule = head[2];
  if (rule === undefined) {
    return { name, atLeast: undefined };
  }

  const atLeast = /^at least (\d+) fields?(?: "([^"]*)")?$/.exec(rule);
  if (!atLeast) {
    return `unknown object rule "${rule}"`;
  }
  return { name, atLeast: { fields: Number(atLeast[1]), message: atLeast[2] } };
};

/** Reads "none" or names in code font separated by commas; `refused` is the problem otherwise. */
const parseList = (text: string, name: string, refused: string): string[] | string => {
  if (text === "none") {
    return [];
  }
  const items = text.split(",").map((item) => item.trim());
  const names: string[] = [];
  for (const item of items) {
    const found = new RegExp(`^\`(${name})\`$`).exec(item);
    if (!found) {
      return refused;
    }
    names.push(found[1] as string);
  }
  return names;
};

const parseKinds = (text: string): string[] | string => parseList(text, NAME, 'errors are "none" or kinds in code font, separated by commas');

/** A rule id as the rules spec writes it: `title.length`. */
const RULE_ID = "[a-z][a-z_]*\\.[a-z][a-z_]*";

/** The parameters a path names in braces: `/todos/{id}` names `id`. */
export const pathParams = (path: string): string[] => {
  return [...path.matchAll(/\{([^}]+)\}/g)].map((m) => m[1] as string);
};

type Lines = { text: string; line: number }[];

/** Splits a section into its `###` blocks. Lines before the first heading are returned as `lead`. */
const blocks = (lines: Lines) => {
  const lead: Lines = [];
  const found: { heading: string; line: number; body: Lines }[] = [];
  for (const entry of lines) {
    if (entry.text.startsWith("### ")) {
      found.push({ heading: entry.text.slice(4).trim(), line: entry.line, body: [] });
      continue;
    }
    const current = found.at(-1);
    if (current) {
      current.body.push(entry);
    } else {
      lead.push(entry);
    }
  }
  return { lead, found };
};

const nonBlank = (lines: Lines) => lines.filter((entry) => entry.text.trim() !== "");

/** Splits lines at the first `Examples:` line: the lines before it, and the lines after it. */
const splitExamples = (lines: Lines) => {
  const at = lines.findIndex((entry) => entry.text === "Examples:");
  if (at === -1) {
    return { before: lines, examples: undefined };
  }
  return { before: lines.slice(0, at), examples: lines.slice(at + 1) };
};

type Token = { kind: "line"; text: string; line: number } | { kind: "json"; text: string; line: number };

/** Reads lines as labelled lines and ```json blocks, skipping blank lines outside the blocks. */
const tokens = (lines: Lines, problem: (line: number, message: string) => void): Token[] => {
  const found: Token[] = [];
  let block: { text: string[]; line: number } | undefined;
  for (const entry of lines) {
    if (block) {
      if (entry.text.trim() === "```") {
        found.push({ kind: "json", text: block.text.join("\n"), line: block.line });
        block = undefined;
      } else {
        block.text.push(entry.text);
      }
      continue;
    }
    if (entry.text.startsWith("```")) {
      if (entry.text !== "```json") {
        problem(entry.line, "an example's block is ```json");
      }
      block = { text: [], line: entry.line };
      continue;
    }
    if (entry.text.trim() !== "") {
      found.push({ kind: "line", text: entry.text, line: entry.line });
    }
  }
  if (block) {
    problem(block.line, "this ```json block is not closed");
  }
  return found;
};

/** Reads a request line's query string into its keys and values, in order. */
const parseQuery = (text: string): [string, string][] => {
  if (text === "") {
    return [];
  }
  return text.split("&").map((pair) => {
    const at = pair.indexOf("=");
    const key = at === -1 ? pair : pair.slice(0, at);
    const value = at === -1 ? "" : pair.slice(at + 1);
    const decode = (part: string) => decodeURIComponent(part.replaceAll("+", " "));
    return [decode(key), decode(value)] as [string, string];
  });
};

/** Matches a path as sent against a template such as `/todos/{id}`; undefined when it does not match. */
export const matchPath = (template: string, path: string): Record<string, string> | undefined => {
  const want = template.split("/");
  const got = path.split("/");
  if (want.length !== got.length) {
    return undefined;
  }
  const params: Record<string, string> = {};
  for (const [index, part] of want.entries()) {
    const sent = got[index] as string;
    const param = /^\{([^}]+)\}$/.exec(part);
    if (param) {
      if (sent === "") {
        return undefined;
      }
      params[param[1] as string] = decodeURIComponent(sent);
    } else if (part !== sent) {
      return undefined;
    }
  }
  return params;
};

/**
 * Reads the examples after an `Examples:` line. Each is `Example: name`, then
 * `` Request: `METHOD /path?query` `` and its ```json body when it has one,
 * then `Reply: status` and the ```json envelope. `withRequest` is false for
 * the examples every endpoint shares, which have no request.
 */
const parseExamples = (
  lines: Lines,
  withRequest: boolean,
  problem: (line: number, message: string) => void,
): Example[] => {
  const examples: Example[] = [];
  const found = tokens(lines, problem);
  const json = (token: Token | undefined, what: string, line: number): { value: unknown } | undefined => {
    if (token?.kind !== "json") {
      problem(line, `${what} is a \`\`\`json block on the next lines`);
      return undefined;
    }
    try {
      return { value: JSON.parse(token.text) };
    } catch (error) {
      problem(token.line, `${what} is not JSON: ${(error as Error).message}`);
      return undefined;
    }
  };

  let index = 0;
  while (index < found.length) {
    const token = found[index] as Token;
    index += 1;
    const head = token.kind === "line" ? /^Example: (.+)$/.exec(token.text) : null;
    if (!head) {
      problem(token.line, "an example starts with \"Example: name\"");
      continue;
    }
    const example: Example = { name: (head[1] as string).trim(), request: undefined, status: 0, reply: undefined, line: token.line };
    if (examples.some((other) => other.name === example.name)) {
      problem(token.line, `example "${example.name}" is already given`);
    }

    let next = found[index];
    const request = next?.kind === "line" ? /^Request: `([A-Z]+) (\/[^`\s?]*)(?:\?([^`\s]*))?`$/.exec(next.text) : null;
    if (next?.kind === "line" && next.text.startsWith("Request:") && !request) {
      problem(next.line, "Request: is the request line in code font: Request: `GET /todos?completed=true`");
    }
    if (request && next) {
      index += 1;
      const requestLine = next.line;
      let body: unknown;
      if (found[index]?.kind === "json") {
        body = json(found[index], "a request body", requestLine)?.value;
        index += 1;
      }
      example.request = {
        method: request[1] as string,
        path: request[2] as string,
        params: {},
        query: parseQuery(request[3] ?? ""),
        body,
      };
      if (!withRequest) {
        problem(requestLine, "an example every endpoint shares has no Request:");
      }
    } else if (withRequest) {
      problem(token.line, `example "${example.name}" has no Request:`);
    }

    next = found[index];
    const reply = next?.kind === "line" ? /^Reply: (\d{3})$/.exec(next.text) : null;
    if (!reply || !next) {
      problem(next?.line ?? token.line, `example "${example.name}" has no "Reply: status" after its request`);
      continue;
    }
    index += 1;
    example.status = Number(reply[1]);
    const envelope = json(found[index], "a reply", next.line);
    if (found[index]?.kind === "json") {
      index += 1;
    }
    if (envelope === undefined) {
      continue;
    }
    example.reply = envelope.value;
    examples.push(example);
  }
  return examples;
};

const isObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

/** The reply's error kind when it is a failure envelope, true for a success, else a problem. */
const envelopeOf = (reply: unknown): { ok: true } | { ok: false; kind: string; reason: unknown } | string => {
  if (!isObject(reply) || typeof reply.ok !== "boolean") {
    return "a reply is the whole envelope: { \"ok\": true, \"data\": … } or { \"ok\": false, \"error\": … }";
  }
  if (reply.ok) {
    return { ok: true };
  }
  if (!isObject(reply.error) || typeof reply.error.kind !== "string") {
    return "a failure's error has a kind";
  }
  return { ok: false, kind: reply.error.kind, reason: reply.error.reason };
};

export const parse = (source: string): Parsed => {
  const problems: Problem[] = [];
  const problem = (line: number, message: string) => {
    problems.push({ line, message });
  };

  const all = source.split("\n").map((text, index) => ({ text: text.trimEnd(), line: index + 1 }));

  // Title and sections.
  let title = "";
  const sections = new Map<Section, Lines>();
  let current: Lines | undefined;
  const order: Section[] = [];
  for (const entry of all) {
    if (entry.text.startsWith("# ")) {
      title = entry.text.slice(2).trim();
      continue;
    }
    if (entry.text.startsWith("## ")) {
      const name = entry.text.slice(3).trim() as Section;
      if (!SECTIONS.includes(name)) {
        problem(entry.line, `unknown section "${name}"; the sections are ${SECTIONS.join(", ")}`);
        current = undefined;
        continue;
      }
      current = [];
      sections.set(name, current);
      order.push(name);
      continue;
    }
    current?.push(entry);
  }

  const expected = SECTIONS.filter((name) => order.includes(name));
  if (order.join() !== expected.join()) {
    problem(1, `sections are out of order; the order is ${SECTIONS.join(", ")}`);
  }
  for (const name of SECTIONS) {
    if (!sections.has(name)) {
      problem(1, `section "${name}" is missing`);
    }
  }

  // Errors.
  const kinds: ErrorKind[] = [];
  const kindShape =
    'an error is "- `kind`: status", "- `kind`: status, with field" or "- `kind`: status, with reason: a | b"';
  for (const entry of nonBlank(sections.get("Errors") ?? [])) {
    const kind = new RegExp(`^- \`(${NAME})\`: (\\d{3})(?:, with (field|reason)(?:: (.+))?)?$`).exec(entry.text);
    if (!kind) {
      problem(entry.line, kindShape);
      continue;
    }
    const name = kind[1] as string;
    const carries = kind[3] as "field" | "reason" | undefined;
    const list = kind[4];
    if (carries !== "reason" && list !== undefined) {
      problem(entry.line, kindShape);
      continue;
    }
    const reasons = list === undefined ? [] : list.split(" | ");
    if (carries === "reason") {
      if (reasons.length === 0) {
        problem(entry.line, `kind ${name} carries a reason, so it lists them: "with reason: a | b"`);
      }
      for (const reason of reasons) {
        if (!new RegExp(`^${NAME}$`).test(reason)) {
          problem(entry.line, `kind ${name}'s reason "${reason}" is not a name`);
        }
      }
      const twice = reasons.filter((reason, index) => reasons.indexOf(reason) !== index);
      for (const reason of new Set(twice)) {
        problem(entry.line, `kind ${name} lists the reason ${reason} twice`);
      }
      // The contract's `Reason` is one list, so it is exact only while one kind carries it.
      const earlier = kinds.find((other) => other.carries === "reason");
      if (earlier !== undefined) {
        problem(entry.line, `kind ${name} carries a reason, and so does ${earlier.name}; one kind carries a reason`);
      }
    }
    kinds.push({ name, status: Number(kind[2]), carries, reasons });
  }
  const kindNames = new Set(kinds.map((kind) => kind.name));
  const statusOf = new Map(kinds.map((kind) => [kind.name, kind.status]));
  const reasonsOf = new Map(kinds.filter((kind) => kind.carries === "reason").map((kind) => [kind.name, kind.reasons]));

  /** Checks a reply against the kinds it may have and the statuses they map to; true for a success. */
  const checkReply = (example: Example, allowed: string[], success: number | undefined) => {
    const envelope = envelopeOf(example.reply);
    if (typeof envelope === "string") {
      problem(example.line, `example "${example.name}": ${envelope}`);
      return;
    }
    if (envelope.ok) {
      if (success === undefined) {
        problem(example.line, `example "${example.name}" is a success; the examples every endpoint shares are failures`);
      } else if (example.status !== success) {
        problem(example.line, `example "${example.name}" replies ${example.status}; a success replies ${success}`);
      }
      return;
    }
    if (!allowed.includes(envelope.kind)) {
      problem(example.line, `example "${example.name}" fails with ${envelope.kind}, which is not among ${allowed.join(", ")}`);
      return;
    }
    const status = statusOf.get(envelope.kind);
    if (example.status !== status) {
      problem(example.line, `example "${example.name}" replies ${example.status}; ${envelope.kind} replies ${status}`);
    }
    const reasons = reasonsOf.get(envelope.kind);
    if (reasons !== undefined && !reasons.includes(envelope.reason as string)) {
      problem(example.line, `example "${example.name}" gives the reason ${String(envelope.reason)}, which is not among ${reasons.join(", ")}`);
    }
  };

  /** The kinds the examples fail with, and whether any succeeds. */
  const covered = (examples: Example[]) => {
    const failures = new Set<string>();
    let success = false;
    for (const example of examples) {
      const envelope = envelopeOf(example.reply);
      if (typeof envelope === "string") {
        continue;
      }
      if (envelope.ok) {
        success = true;
      } else {
        failures.add(envelope.kind);
      }
    }
    return { failures, success };
  };

  // Every endpoint: prose, and one "Errors:" line naming the kinds every endpoint can return.
  let everyKinds: string[] | undefined;
  const every = splitExamples(sections.get("Every endpoint") ?? []);
  const prose: string[] = [];
  for (const entry of every.before) {
    const line = /^Errors:\s+(.*)$/.exec(entry.text);
    if (!line) {
      prose.push(entry.text);
      continue;
    }
    if (everyKinds !== undefined) {
      problem(entry.line, "Errors: is given twice");
      continue;
    }
    const kinds = parseKinds((line[1] as string).trim());
    if (typeof kinds === "string") {
      problem(entry.line, kinds);
      continue;
    }
    for (const kind of kinds) {
      if (!kindNames.has(kind)) {
        problem(entry.line, `kind ${kind} is not in Errors`);
      }
    }
    everyKinds = kinds;
  }
  if (everyKinds === undefined) {
    problem(1, 'Every endpoint has no Errors: line; write "Errors: none" when there are none');
    everyKinds = [];
  }
  const everyExamples = parseExamples(every.examples ?? [], false, problem);
  for (const example of everyExamples) {
    checkReply(example, everyKinds, undefined);
  }
  const everyCovered = covered(everyExamples).failures;
  for (const kind of everyKinds) {
    if (!everyCovered.has(kind)) {
      problem(1, `Every endpoint has no example of ${kind}`);
    }
  }

  // Shapes.
  const shapes: Shape[] = [];
  const shared: string[] = [];
  const shapeLines = new Map<string, number>();
  const addShape = (shape: Shape, line: number) => {
    if (shapeLines.has(shape.name)) {
      problem(line, `shape ${shape.name} is already named on line ${shapeLines.get(shape.name)}`);
      return;
    }
    shapeLines.set(shape.name, line);
    shapes.push(shape);
  };

  const shapeBlocks = blocks(sections.get("Shapes") ?? []);
  for (const entry of nonBlank(shapeBlocks.lead)) {
    problem(entry.line, "a shape starts with a ### heading");
  }
  for (const block of shapeBlocks.found) {
    const head = parseShapeHead(block.heading);
    if (typeof head === "string") {
      problem(block.line, head);
      continue;
    }

    const docs: string[] = [];
    const fields: Field[] = [];
    let listOf: string | undefined;
    for (const entry of nonBlank(block.body)) {
      if (entry.text.startsWith("- ")) {
        const field = parseField(entry.text);
        if (typeof field === "string") {
          problem(entry.line, field);
          continue;
        }
        fields.push(field);
        continue;
      }
      const list = new RegExp(`^list of \`(${NAME})\`$`).exec(entry.text);
      if (list) {
        listOf = list[1];
        continue;
      }
      if (fields.length > 0 || listOf !== undefined) {
        problem(entry.line, "prose goes before the fields");
        continue;
      }
      docs.push(entry.text.trim());
    }

    const doc = docs.length > 0 ? docs.join(" ") : undefined;
    if (listOf !== undefined) {
      if (fields.length > 0 || head.atLeast) {
        problem(block.line, `shape ${head.name} is a list, so it has no fields or object rule`);
      }
      addShape({ name: head.name, doc, kind: "list", of: listOf }, block.line);
    } else {
      addShape({ name: head.name, doc, kind: "object", fields, atLeast: head.atLeast }, block.line);
    }
    shared.push(head.name);
  }

  // Endpoints.
  const endpoints: Endpoint[] = [];
  const endpointBlocks = blocks(sections.get("Endpoints") ?? []);
  for (const entry of nonBlank(endpointBlocks.lead)) {
    problem(entry.line, "an endpoint starts with a ### heading");
  }
  const seen = new Map<string, number>();
  for (const block of endpointBlocks.found) {
    const head = /^`([A-Z]+) (\/[^`\s]*)`$/.exec(block.heading);
    if (!head) {
      problem(block.line, "an endpoint heading is the method and path in code font: `GET /todos`");
      continue;
    }
    const method = head[1] as string;
    const path = head[2] as string;
    if (!METHODS.includes(method)) {
      problem(block.line, `unknown method ${method}`);
    }
    const key = `${method} ${path}`;
    if (seen.has(key)) {
      problem(block.line, `${key} is already defined on line ${seen.get(key)}`);
    }
    seen.set(key, block.line);

    const endpoint: Endpoint = {
      method,
      path,
      serves: "",
      applies: undefined,
      params: [],
      query: undefined,
      body: undefined,
      status: 0,
      reply: "",
      errors: [],
      examples: [],
      line: block.line,
    };
    const split = splitExamples(block.body);

    // Each part is a labelled line; Path, Query, Body and Reply may have fields under them.
    let part: Part | undefined;
    let lastPart = -1;
    let inline: { name: string; atLeast: AtLeast | undefined; fields: Field[]; line: number } | undefined;
    const seenParts = new Set<Part>();
    const closeInline = () => {
      if (inline && inline.fields.length > 0) {
        addShape(
          { name: inline.name, doc: undefined, kind: "object", fields: inline.fields, atLeast: inline.atLeast },
          inline.line,
        );
      } else if (inline?.atLeast) {
        problem(inline.line, `shape ${inline.name} has an object rule but no fields`);
      }
      inline = undefined;
    };

    for (const entry of nonBlank(split.before)) {
      if (entry.text.startsWith("- ")) {
        if (part !== "Path" && inline === undefined) {
          problem(entry.line, "a field belongs under Path:, or under a shape named in Query:, Body: or Reply:");
          continue;
        }
        const field = parseField(entry.text);
        if (typeof field === "string") {
          problem(entry.line, field);
          continue;
        }
        if (part === "Path") {
          if (field.optional || field.message !== undefined) {
            problem(entry.line, "a path parameter has no optional and no message");
          }
          endpoint.params.push(field);
        } else {
          inline?.fields.push(field);
        }
        continue;
      }

      const labelled = /^([A-Z][a-z]+):(?:\s+(.*))?$/.exec(entry.text);
      if (!labelled) {
        problem(entry.line, `an endpoint holds only ${PARTS.map((p) => `${p}:`).join(", ")} and fields`);
        continue;
      }
      closeInline();
      const label = labelled[1] as Part;
      const text = (labelled[2] ?? "").trim();
      const index = PARTS.indexOf(label);
      if (index === -1) {
        problem(entry.line, `unknown part ${label}:; the parts are ${PARTS.join(", ")}`);
        part = undefined;
        continue;
      }
      if (seenParts.has(label)) {
        problem(entry.line, `${label}: is given twice`);
      }
      if (index < lastPart) {
        problem(entry.line, `${label}: is out of order; the order is ${PARTS.join(", ")}`);
      }
      seenParts.add(label);
      lastPart = index;
      part = label;

      if (label === "Serves") {
        endpoint.serves = text.replace(/\.$/, "");
        continue;
      }
      if (label === "Applies") {
        const ids = parseList(
          text.replace(/\.$/, ""),
          RULE_ID,
          'Applies: is "none" or rule ids in code font, separated by commas',
        );
        if (typeof ids === "string") {
          problem(entry.line, ids);
          continue;
        }
        const twice = ids.filter((id, at) => ids.indexOf(id) !== at);
        if (twice.length > 0) {
          problem(entry.line, `Applies: names ${twice.join(", ")} twice`);
        }
        endpoint.applies = ids;
        continue;
      }
      if (label === "Path") {
        if (text !== "") {
          problem(entry.line, "Path: has its parameters as fields under it");
        }
        continue;
      }
      if (label === "Errors") {
        const kinds = parseKinds(text);
        if (typeof kinds === "string") {
          problem(entry.line, kinds);
          continue;
        }
        for (const kind of kinds) {
          if (!kindNames.has(kind)) {
            problem(entry.line, `kind ${kind} is not in Errors`);
          }
          if (everyKinds.includes(kind)) {
            problem(entry.line, `kind ${kind} is one every endpoint can return; list only the kinds it adds`);
          }
        }
        endpoint.errors = kinds;
        continue;
      }

      let shapeText = text;
      if (label === "Reply") {
        const status = /^(\d{3}) (.+)$/.exec(text);
        if (!status) {
          problem(entry.line, "Reply: is the status, then the shape: Reply: 200 `Name`");
          continue;
        }
        endpoint.status = Number(status[1]);
        shapeText = status[2] as string;
      }
      const shape = parseShapeHead(shapeText);
      if (typeof shape === "string") {
        problem(entry.line, shape);
        continue;
      }
      inline = { name: shape.name, atLeast: shape.atLeast, fields: [], line: entry.line };
      if (label === "Query") {
        endpoint.query = shape.name;
      } else if (label === "Body") {
        endpoint.body = shape.name;
      } else {
        endpoint.reply = shape.name;
      }
    }
    closeInline();

    if (endpoint.serves === "") {
      problem(block.line, `${key} has no Serves:`);
    }
    if (endpoint.reply === "") {
      problem(block.line, `${key} has no Reply:`);
    }
    if (!seenParts.has("Errors")) {
      problem(block.line, `${key} has no Errors:; write "Errors: none" when it adds none`);
    }
    const named = pathParams(path);
    const given = endpoint.params.map((param) => param.name);
    if (named.join() !== given.join()) {
      problem(block.line, `${key} names {${named.join("}, {")}} in its path but Path: lists ${given.join(", ") || "none"}`);
    }

    if (split.examples === undefined) {
      problem(block.line, `${key} has no Examples:`);
    } else {
      endpoint.examples = parseExamples(split.examples, true, problem);
    }
    for (const example of endpoint.examples) {
      const request = example.request;
      if (request === undefined) {
        continue;
      }
      if (request.method !== method) {
        problem(example.line, `example "${example.name}" sends ${request.method}; ${key} is ${method}`);
      }
      const params = matchPath(path, request.path);
      if (params === undefined) {
        problem(example.line, `example "${example.name}" sends ${request.path}, which does not match ${path}`);
      } else {
        request.params = params;
      }
      if (endpoint.body === undefined && request.body !== undefined) {
        problem(example.line, `example "${example.name}" sends a body; ${key} takes none`);
      }
      if (endpoint.body !== undefined && request.body === undefined) {
        problem(example.line, `example "${example.name}" sends no body; ${key} takes ${endpoint.body}`);
      }
      if (endpoint.query === undefined && request.query.length > 0) {
        problem(example.line, `example "${example.name}" sends a query; ${key} takes none`);
      }
      checkReply(example, [...everyKinds, ...endpoint.errors], endpoint.status);
    }
    const endpointCovered = covered(endpoint.examples);
    if (split.examples !== undefined && !endpointCovered.success) {
      problem(block.line, `${key} has no example that succeeds`);
    }
    for (const kind of endpoint.errors) {
      if (split.examples !== undefined && !everyKinds.includes(kind) && !endpointCovered.failures.has(kind)) {
        problem(block.line, `${key} has no example of ${kind}`);
      }
    }
    endpoints.push(endpoint);
  }

  // Every shape named in a part, in a field or in a list exists.
  const shapeNames = new Set(shapes.map((shape) => shape.name));
  const mustExist = (name: string | undefined, line: number) => {
    if (name !== undefined && name !== "" && !shapeNames.has(name)) {
      problem(line, `shape ${name} is not defined`);
    }
  };
  for (const shape of shapes) {
    const line = shapeLines.get(shape.name) ?? 1;
    if (shape.kind === "list") {
      mustExist(shape.of, line);
      continue;
    }
    for (const field of shape.fields) {
      if (field.type.kind === "ref" || field.type.kind === "listOf") {
        mustExist(field.type.shape, line);
      }
    }
  }
  for (const endpoint of endpoints) {
    mustExist(endpoint.query, endpoint.line);
    mustExist(endpoint.body, endpoint.line);
    mustExist(endpoint.reply, endpoint.line);
  }

  if (problems.length > 0) {
    problems.sort((a, b) => a.line - b.line);
    return { ok: false, problems };
  }
  return { ok: true, spec: { title, everyProse: prose.join("\n").trim(), everyKinds, everyExamples, kinds, shapes, shared, endpoints } };
};
