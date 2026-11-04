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

export type ErrorKind = { name: string; withField: boolean };

export type Endpoint = {
  method: string;
  path: string;
  serves: string;
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
  line: number;
};

export type Spec = {
  title: string;
  /** The kinds every endpoint can return, from "Every endpoint". */
  everyKinds: string[];
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
const PARTS = ["Serves", "Path", "Query", "Body", "Reply", "Errors"] as const;
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

const parseKinds = (text: string): string[] | string => {
  if (text === "none") {
    return [];
  }
  const items = text.split(",").map((item) => item.trim());
  const kinds: string[] = [];
  for (const item of items) {
    const kind = new RegExp(`^\`(${NAME})\`$`).exec(item);
    if (!kind) {
      return 'errors are "none" or kinds in code font, separated by commas';
    }
    kinds.push(kind[1] as string);
  }
  return kinds;
};

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
  for (const entry of nonBlank(sections.get("Errors") ?? [])) {
    const kind = new RegExp(`^- \`(${NAME})\`(, with field)?$`).exec(entry.text);
    if (!kind) {
      problem(entry.line, 'an error is "- `kind`" or "- `kind`, with field"');
      continue;
    }
    kinds.push({ name: kind[1] as string, withField: kind[2] !== undefined });
  }
  const kindNames = new Set(kinds.map((kind) => kind.name));

  // Every endpoint: prose, and one "Errors:" line naming the kinds every endpoint can return.
  let everyKinds: string[] | undefined;
  for (const entry of nonBlank(sections.get("Every endpoint") ?? [])) {
    const line = /^Errors:\s+(.*)$/.exec(entry.text);
    if (!line) {
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
      params: [],
      query: undefined,
      body: undefined,
      status: 0,
      reply: "",
      errors: [],
      line: block.line,
    };

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

    for (const entry of nonBlank(block.body)) {
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
  return { ok: true, spec: { title, everyKinds, kinds, shapes, shared, endpoints } };
};
