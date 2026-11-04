// Reads a rules spec (`prd/<app>/rules.md`) into plain data and checks it
// against its own vocabulary (L29, L31, L34). The vocabulary is the spec's
// "How an input is written" and "How a rule is written". Line by line:
// within a block, every line is prose, a labelled line, a list item or
// blank, and a line the vocabulary does not allow is a problem, reported
// with its line number.

export type FieldType = "text" | "boolean";

export type InputField = {
  name: string;
  type: FieldType;
  trimmed: boolean;
  optional: boolean;
  rules: string[];
  line: number;
};

export type Input = {
  name: string;
  doc: string;
  area: string;
  /** The business file that exports the input's type; undefined when it `Builds:` a field. */
  type: string | undefined;
  /** The one field the input is built as; undefined when it has a `Type:`. */
  builds: string | undefined;
  rules: string[];
  fields: InputField[];
  line: number;
};

export type Bound = { kind: "number"; value: number } | { kind: "parameter"; name: string };

export type Form =
  | { kind: "length"; least: Bound; most: Bound }
  | { kind: "atLeast"; count: number; fields: string[] }
  | { kind: "custom" };

export type RuleKind = "input" | "state" | "guarantee";

export type Parameter = { name: string; constant: string };

export type Violation = { name: string; condition: string | undefined };

export type Rule = {
  id: string;
  statement: string;
  kind: RuleKind;
  form: Form | undefined;
  parameters: Parameter[];
  violations: Violation[];
  source: string;
  line: number;
};

export type Constant = { name: string; value: number; doc: string; line: number };

export type Spec = { constants: Constant[]; inputs: Input[]; rules: Rule[] };

export type SpecProblem = { line: number; message: string };

export type Parsed = { ok: true; spec: Spec } | { ok: false; problems: SpecProblem[] };

/** A rule id: `<subject>.<property>`, each part lower-case words joined by `_`. */
export const ID = /^[a-z]+(?:_[a-z]+)*\.[a-z]+(?:_[a-z]+)*$/;

const KINDS: readonly RuleKind[] = ["input", "state", "guarantee"];

/** The violation conditions each form allows. */
const CONDITIONS: Record<Form["kind"], readonly string[]> = {
  length: ["below", "above"],
  atLeast: ["fewer"],
  custom: [],
};

type Line = { text: string; line: number };

/** The text inside one pair of backticks, or undefined when it is not that. */
const code = (text: string) => /^`([^`]+)`$/.exec(text.trim())?.[1];

/** A list item and the items indented under it. */
type Item = { text: string; line: number; children: Line[] };

/** A block, read into its prose, its labelled lines and its lists. */
type Block = {
  heading: string;
  line: number;
  prose: string[];
  labels: Map<string, Line>;
  lists: Map<string, { line: number; items: Item[] }>;
};

const LABEL = /^([A-Z][a-z]+):(?: (.*))?$/;

/**
 * Reads a `###` block. Prose comes first, then labelled lines. A label with
 * no value on its line heads a list. A labelled value may continue on the
 * lines after it, until a blank line.
 */
const readBlock = (heading: Line, body: Line[], problems: SpecProblem[]): Block => {
  const block: Block = { heading: heading.text, line: heading.line, prose: [], labels: new Map(), lists: new Map() };
  let open: Line | undefined;
  let list: Item[] | undefined;
  for (const entry of body) {
    const text = entry.text;
    if (text.trim() === "") {
      open = undefined;
      continue;
    }
    const label = LABEL.exec(text);
    if (label !== null) {
      const [, name = "", value] = label;
      if (block.labels.has(name) || block.lists.has(name)) {
        problems.push({ line: entry.line, message: `${name}: is given twice` });
      }
      if (value === undefined) {
        list = [];
        block.lists.set(name, { line: entry.line, items: list });
        open = undefined;
      } else {
        open = { text: value, line: entry.line };
        block.labels.set(name, open);
        list = undefined;
      }
      continue;
    }
    if (list !== undefined && text.startsWith("- ")) {
      list.push({ text: text.slice(2), line: entry.line, children: [] });
      continue;
    }
    const parent = list?.at(-1);
    if (parent !== undefined && text.startsWith("  - ")) {
      parent.children.push({ text: text.slice(4), line: entry.line });
      continue;
    }
    if (open !== undefined) {
      open.text = `${open.text} ${text.trim()}`;
      continue;
    }
    if (block.labels.size === 0 && block.lists.size === 0) {
      block.prose.push(text.trim());
      continue;
    }
    problems.push({ line: entry.line, message: `not part of the vocabulary: ${text.trim()}` });
  }
  return block;
};

/** Splits lines into the blocks under each heading of the given depth. */
const split = (lines: Line[], marker: string) => {
  const blocks: { heading: Line; body: Line[] }[] = [];
  const before: Line[] = [];
  for (const entry of lines) {
    if (entry.text.startsWith(marker)) {
      blocks.push({ heading: { text: entry.text.slice(marker.length).trim(), line: entry.line }, body: [] });
      continue;
    }
    const last = blocks.at(-1);
    if (last === undefined) {
      before.push(entry);
    } else {
      last.body.push(entry);
    }
  }
  return { before, blocks };
};

const parseBound = (text: string): Bound | undefined => {
  if (/^\d+$/.test(text)) {
    return { kind: "number", value: Number(text) };
  }
  const name = code(text);
  if (name === undefined) {
    return undefined;
  }
  return { kind: "parameter", name };
};

/** A `Form:` value: `length, <least> to <most>`, `at least <n> of <fields>` or `custom`. */
export const parseForm = (text: string): Form | undefined => {
  if (text === "custom") {
    return { kind: "custom" };
  }
  const length = /^length, (\S+) to (\S+)$/.exec(text);
  if (length !== null) {
    const least = parseBound(length[1] ?? "");
    const most = parseBound(length[2] ?? "");
    if (least === undefined || most === undefined) {
      return undefined;
    }
    return { kind: "length", least, most };
  }
  const atLeast = /^at least (\d+) of (.+)$/.exec(text);
  if (atLeast !== null) {
    const fields = (atLeast[2] ?? "").split(", ").map(code);
    if (fields.some((field) => field === undefined)) {
      return undefined;
    }
    return { kind: "atLeast", count: Number(atLeast[1]), fields: fields as string[] };
  }
  return undefined;
};

/** A field item: `` `name`: type[, trimmed][, optional] ``. */
export const parseField = (text: string): Omit<InputField, "rules" | "line"> | undefined => {
  const match = /^`([a-z][A-Za-z]*)`: (text|boolean)((?:, trimmed)?)((?:, optional)?)$/.exec(text);
  if (match === null) {
    return undefined;
  }
  const [, name = "", type = "text", trimmed, optional] = match;
  return { name, type: type as FieldType, trimmed: trimmed !== "", optional: optional !== "" };
};

/** A list of ids, one per item, each alone in backticks. */
const ids = (items: Item[], problems: SpecProblem[]) => {
  const found: string[] = [];
  for (const item of items) {
    const id = code(item.text);
    if (id === undefined) {
      problems.push({ line: item.line, message: `expected one rule id in backticks: ${item.text}` });
      continue;
    }
    found.push(id);
  }
  return found;
};

const parseInput = (block: Block, problems: SpecProblem[]): Input | undefined => {
  const name = code(block.heading);
  if (name === undefined || !/^[A-Z][A-Za-z]*$/.test(name)) {
    problems.push({ line: block.line, message: `an input's heading is its name in backticks: ${block.heading}` });
    return undefined;
  }
  for (const label of block.labels.keys()) {
    if (!["Area", "Type", "Builds"].includes(label)) {
      problems.push({ line: block.labels.get(label)?.line ?? block.line, message: `an input has no ${label}:` });
    }
  }
  for (const label of block.lists.keys()) {
    if (!["Rules", "Fields"].includes(label)) {
      problems.push({ line: block.lists.get(label)?.line ?? block.line, message: `an input has no ${label}:` });
    }
  }
  const area = code(block.labels.get("Area")?.text ?? "");
  if (area === undefined) {
    problems.push({ line: block.line, message: `${name} needs Area: in backticks` });
  }
  const typeLine = block.labels.get("Type");
  const buildsLine = block.labels.get("Builds");
  const type = typeLine === undefined ? undefined : code(typeLine.text);
  const builds = buildsLine === undefined ? undefined : code(buildsLine.text);
  if ((type === undefined) === (builds === undefined)) {
    problems.push({ line: block.line, message: `${name} needs Type: or Builds:, one of them, in backticks` });
  }
  const fieldsList = block.lists.get("Fields");
  if (fieldsList === undefined || fieldsList.items.length === 0) {
    problems.push({ line: block.line, message: `${name} needs Fields:` });
  }
  const fields: InputField[] = [];
  for (const item of fieldsList?.items ?? []) {
    const field = parseField(item.text);
    if (field === undefined) {
      problems.push({ line: item.line, message: `a field is \`name\`: type[, trimmed][, optional]: ${item.text}` });
      continue;
    }
    if (fields.some((other) => other.name === field.name)) {
      problems.push({ line: item.line, message: `${name} lists ${field.name} twice` });
    }
    const rules = ids(
      item.children.map((child) => ({ ...child, children: [] })),
      problems,
    );
    fields.push({ ...field, rules, line: item.line });
  }
  return {
    name,
    doc: block.prose.join(" "),
    area: area ?? "",
    type,
    builds,
    rules: ids(block.lists.get("Rules")?.items ?? [], problems),
    fields,
    line: block.line,
  };
};

/** A `` - `name`: value `` item, with the value as written. */
const named = (item: Item) => /^`([a-z][a-z_]*)`: (.+)$/.exec(item.text);

const parseRule = (block: Block, problems: SpecProblem[]): Rule | undefined => {
  const id = code(block.heading);
  if (id === undefined) {
    problems.push({ line: block.line, message: `a rule's heading is its id in backticks: ${block.heading}` });
    return undefined;
  }
  if (!ID.test(id)) {
    problems.push({
      line: block.line,
      message: `${id} is not <subject>.<property>, each part lower-case words joined by _`,
    });
  }
  for (const label of block.labels.keys()) {
    if (!["Kind", "Form", "Source"].includes(label)) {
      problems.push({ line: block.labels.get(label)?.line ?? block.line, message: `a rule has no ${label}:` });
    }
  }
  for (const label of block.lists.keys()) {
    if (!["Parameters", "Violations"].includes(label)) {
      problems.push({ line: block.lists.get(label)?.line ?? block.line, message: `a rule has no ${label}:` });
    }
  }
  if (block.prose.length === 0) {
    problems.push({ line: block.line, message: `${id} needs its statement` });
  }
  const kindText = block.labels.get("Kind")?.text;
  const kind = KINDS.find((each) => each === kindText);
  if (kind === undefined) {
    problems.push({ line: block.line, message: `${id} needs Kind: one of ${KINDS.join(", ")}` });
  }
  const source = block.labels.get("Source")?.text;
  if (source === undefined || source.trim() === "") {
    problems.push({ line: block.line, message: `${id} needs Source: (L31)` });
  }
  const formLine = block.labels.get("Form");
  let form: Form | undefined;
  if (formLine !== undefined) {
    form = parseForm(formLine.text);
    if (form === undefined) {
      problems.push({ line: formLine.line, message: `not a form: ${formLine.text}` });
    }
  }
  const parameters: Parameter[] = [];
  for (const item of block.lists.get("Parameters")?.items ?? []) {
    const match = named(item);
    const constant = code(match?.[2] ?? "");
    if (match === null || constant === undefined) {
      problems.push({ line: item.line, message: `a parameter is \`name\`: \`CONSTANT\`: ${item.text}` });
      continue;
    }
    parameters.push({ name: match[1] ?? "", constant });
  }
  const violations: Violation[] = [];
  for (const item of block.lists.get("Violations")?.items ?? []) {
    const match = named(item);
    const alone = code(item.text);
    if (match === null && alone === undefined) {
      problems.push({ line: item.line, message: `a violation is \`name\`: condition: ${item.text}` });
      continue;
    }
    violations.push({ name: match?.[1] ?? alone ?? "", condition: match?.[2] });
  }
  return {
    id,
    statement: block.prose.join(" "),
    kind: kind ?? "input",
    form,
    parameters,
    violations,
    source: source ?? "",
    line: block.line,
  };
};

const parseConstants = (body: Line[], problems: SpecProblem[]) => {
  const constants: Constant[] = [];
  for (const entry of body) {
    if (entry.text.trim() === "") {
      continue;
    }
    const match = /^- `([A-Z][A-Z0-9_]*)`: (\d+)\. (.+)$/.exec(entry.text);
    const last = constants.at(-1);
    if (match === null && last !== undefined && entry.text.startsWith("  ")) {
      last.doc = `${last.doc} ${entry.text.trim()}`;
      continue;
    }
    if (match === null) {
      problems.push({ line: entry.line, message: `a constant is - \`NAME\`: number. What it is.: ${entry.text}` });
      continue;
    }
    constants.push({ name: match[1] ?? "", value: Number(match[2]), doc: match[3] ?? "", line: entry.line });
  }
  return constants;
};

/** Checks the parts of a spec against each other: what a parse of one block cannot see. */
export const validate = (spec: Spec): SpecProblem[] => {
  const problems: SpecProblem[] = [];
  const constants = new Map(spec.constants.map((constant) => [constant.name, constant]));
  const rules = new Map<string, Rule>();
  for (const rule of spec.rules) {
    if (rules.has(rule.id)) {
      problems.push({ line: rule.line, message: `${rule.id} is defined twice` });
    }
    rules.set(rule.id, rule);
  }
  const names = new Set<string>();
  for (const input of spec.inputs) {
    if (names.has(input.name)) {
      problems.push({ line: input.line, message: `${input.name} is defined twice` });
    }
    names.add(input.name);
  }

  for (const rule of spec.rules) {
    for (const parameter of rule.parameters) {
      if (!constants.has(parameter.constant)) {
        problems.push({ line: rule.line, message: `${rule.id}'s ${parameter.name} is no constant: ${parameter.constant}` });
      }
    }
    if (rule.kind !== "input") {
      if (rule.form !== undefined || rule.violations.length > 0) {
        problems.push({ line: rule.line, message: `${rule.id} is a ${rule.kind} rule: only input rules have Form: and Violations:` });
      }
      continue;
    }
    if (rule.form === undefined) {
      problems.push({ line: rule.line, message: `${rule.id} is an input rule and needs Form:` });
      continue;
    }
    if (rule.violations.length === 0) {
      problems.push({ line: rule.line, message: `${rule.id} is an input rule and needs Violations:` });
    }
    const allowed = CONDITIONS[rule.form.kind];
    const seen = new Set<string>();
    for (const violation of rule.violations) {
      if (rule.form.kind === "custom") {
        if (violation.condition !== undefined) {
          problems.push({ line: rule.line, message: `${rule.id} is custom: its violation ${violation.name} has no condition` });
        }
        continue;
      }
      if (violation.condition === undefined || !allowed.includes(violation.condition)) {
        problems.push({
          line: rule.line,
          message: `${rule.id}'s ${violation.name} needs a condition of its form: ${allowed.join(" or ")}`,
        });
        continue;
      }
      if (seen.has(violation.condition)) {
        problems.push({ line: rule.line, message: `${rule.id} gives the condition ${violation.condition} twice` });
      }
      seen.add(violation.condition);
    }
    if (rule.form.kind === "length") {
      for (const bound of [rule.form.least, rule.form.most]) {
        if (bound.kind === "parameter" && !rule.parameters.some((parameter) => parameter.name === bound.name)) {
          problems.push({ line: rule.line, message: `${rule.id}'s form names ${bound.name}, which is not a parameter` });
        }
      }
    }
  }

  const applied = new Set<string>();
  for (const input of spec.inputs) {
    if (input.builds !== undefined) {
      const only = input.fields.length === 1 ? input.fields[0] : undefined;
      if (only === undefined || only.name !== input.builds || only.optional) {
        problems.push({ line: input.line, message: `${input.name} builds ${input.builds}, so that is its one field, not optional` });
      }
    }
    for (const id of input.rules) {
      applied.add(id);
      const rule = rules.get(id);
      if (rule === undefined) {
        problems.push({ line: input.line, message: `${input.name} applies ${id}, which is not defined` });
        continue;
      }
      if (rule.kind !== "input" || (rule.form?.kind !== "atLeast" && rule.form?.kind !== "custom")) {
        problems.push({ line: input.line, message: `${input.name}'s Rules: are input rules of form at least or custom: ${id}` });
        continue;
      }
      if (rule.form.kind === "atLeast") {
        for (const name of rule.form.fields) {
          const field = input.fields.find((each) => each.name === name);
          if (field === undefined || !field.optional) {
            problems.push({ line: input.line, message: `${id} counts ${name}, which ${input.name} needs as an optional field` });
          }
        }
      }
    }
    for (const field of input.fields) {
      for (const id of field.rules) {
        applied.add(id);
        const rule = rules.get(id);
        if (rule === undefined) {
          problems.push({ line: field.line, message: `${field.name} applies ${id}, which is not defined` });
          continue;
        }
        if (rule.kind !== "input" || (rule.form?.kind !== "length" && rule.form?.kind !== "custom")) {
          problems.push({ line: field.line, message: `a field's rules are input rules of form length or custom: ${id}` });
          continue;
        }
        if (rule.form.kind === "length" && field.type !== "text") {
          problems.push({ line: field.line, message: `${id} is a length, so ${field.name} must be text` });
        }
      }
    }
  }
  for (const rule of spec.rules) {
    if (rule.kind === "input" && !applied.has(rule.id)) {
      problems.push({ line: rule.line, message: `${rule.id} is an input rule no input applies` });
    }
  }
  return problems;
};

export const parse = (text: string): Parsed => {
  const lines = text.split("\n").map((each, index) => ({ text: each, line: index + 1 }));
  const problems: SpecProblem[] = [];
  const spec: Spec = { constants: [], inputs: [], rules: [] };
  const { blocks: sections } = split(lines, "## ");
  const seen = new Set<string>();
  for (const section of sections) {
    seen.add(section.heading.text);
    const { before, blocks } = split(section.body, "### ");
    switch (section.heading.text) {
      case "Every input":
        break;
      case "Constants":
        spec.constants = parseConstants(before, problems);
        break;
      case "Inputs":
        for (const block of blocks) {
          const input = parseInput(readBlock(block.heading, block.body, problems), problems);
          if (input !== undefined) {
            spec.inputs.push(input);
          }
        }
        break;
      case "Rules":
        for (const block of blocks) {
          const rule = parseRule(readBlock(block.heading, block.body, problems), problems);
          if (rule !== undefined) {
            spec.rules.push(rule);
          }
        }
        break;
      default:
        problems.push({ line: section.heading.line, message: `a rules spec has no section ${section.heading.text}` });
    }
  }
  for (const needed of ["Constants", "Inputs", "Rules"]) {
    if (!seen.has(needed)) {
      problems.push({ line: 1, message: `a rules spec needs the section ${needed}` });
    }
  }
  if (problems.length > 0) {
    return { ok: false, problems };
  }
  const invalid = validate(spec);
  if (invalid.length > 0) {
    return { ok: false, problems: invalid };
  }
  return { ok: true, spec };
};
