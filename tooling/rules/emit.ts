// Emits, from a parsed rules spec: business's constants and rule table,
// valid's `Problem` union, a function for each input rule of form `length`
// or `at least`, a validator for each input, and the rules index (L34).
// Each file opens with a line naming the spec and the script, as the
// contract's files do.

import { dirname, relative } from "node:path/posix";
import type { Bound, Form, Input, InputField, Rule, Spec } from "./parse.ts";
import type { UseCase } from "./use-cases.ts";

const header = (source: string, script: string) =>
  `// Generated from ${source} by ${script}. Do not edit: change the spec and regenerate.`;

/** `title.length` as `titleLength`; `todos.unique_id` as `todosUniqueId`. */
export const camel = (id: string) => id.replace(/[._]([a-z])/g, (_, letter: string) => letter.toUpperCase());

/** `TodoPatch` as `todo-patch`. */
export const kebab = (name: string) => name.replace(/[A-Z]/g, (letter, at: number) => `${at === 0 ? "" : "-"}${letter.toLowerCase()}`);

/** A rule's file under `valid/src/rules`, without the extension: `title.length` as `title-length`. */
export const ruleFile = (id: string) => id.replaceAll(".", "-");

/** Where an input's validator lives, under `valid/src`. */
export const validatorPath = (input: Input) => `${input.area}/${kebab(input.name)}.ts`;

/** Whether the generator writes the rule's function, or a person does. */
export const generated = (rule: Rule) => rule.form?.kind === "length" || rule.form?.kind === "atLeast";

const DECODE = { text: "text", boolean: "flag" } as const;

const TS_TYPE = { text: "string", boolean: "boolean" } as const;

/** Names a validator's own code uses, which a field's local cannot take. */
const RESERVED = new Set(["candidate", "decoded", "applied", "err", "ok", "text", "flag", "problemsFrom"]);

/** Wraps prose into comment lines of at most `width` columns, each with the prefix. */
const wrap = (text: string, prefix: string, width = 80) => {
  const lines: string[] = [];
  let line = "";
  for (const word of text.split(/\s+/).filter((each) => each !== "")) {
    if (line !== "" && prefix.length + line.length + 1 + word.length > width) {
      lines.push(`${prefix}${line}`);
      line = word;
      continue;
    }
    line = line === "" ? word : `${line} ${word}`;
  }
  if (line !== "") {
    lines.push(`${prefix}${line}`);
  }
  return lines;
};

/** A JSDoc block, on one line when it fits. */
const doc = (text: string, indent = "") => {
  const one = `${indent}/** ${text} */`;
  if (one.length <= 80 && !text.includes("\n")) {
    return [one];
  }
  return [`${indent}/**`, ...wrap(text, `${indent} * `), `${indent} */`];
};

const constantsOf = (spec: Spec) => new Map(spec.constants.map((constant) => [constant.name, constant]));

/** The constant a parameter names, by the parameter's name. */
const parameterConstant = (rule: Rule, name: string) =>
  rule.parameters.find((parameter) => parameter.name === name)?.constant ?? name;

const boundCode = (rule: Rule, bound: Bound) =>
  bound.kind === "number" ? String(bound.value) : parameterConstant(rule, bound.name);

/** The fields an input rule is applied to, over every input, in the order first met. */
const fieldsApplying = (spec: Spec, id: string) => {
  const names: string[] = [];
  for (const input of spec.inputs) {
    for (const field of input.fields) {
      if (field.rules.includes(id) && !names.includes(field.name)) {
        names.push(field.name);
      }
    }
  }
  return names;
};

const appliedWhole = (spec: Spec, id: string) => spec.inputs.some((input) => input.rules.includes(id));

const union = (values: string[]) => values.map((value) => JSON.stringify(value)).join(" | ");

/** `packages/business/src/rules.ts`: the constants, the rule ids and the rule table. */
export const emitBusinessRules = (spec: Spec, source: string, script: string) => {
  const lines = [header(source, script), ""];
  for (const constant of spec.constants) {
    lines.push(...doc(constant.doc), `export const ${constant.name} = ${constant.value};`, "");
  }
  lines.push(
    ...doc(
      "What a rule is (L29): an input rule is applied to an input, a state rule holds of the state an operation is given, and a guarantee is kept by the store.",
    ),
    'export type RuleKind = "input" | "state" | "guarantee";',
    "",
    "/** Every rule's id. */",
    "export type RuleId =",
    ...spec.rules.map((rule) => `  | ${JSON.stringify(rule.id)}`),
  );
  lines[lines.length - 1] = `${lines.at(-1)};`;
  lines.push(
    "",
    ...doc(
      `A rule as ${source} defines it: its kind, its statement, its parameters, its violations and its source (L31). The words a person or a program sees are each delivery's (L27).`,
    ),
    "export type Rule = {",
    "  kind: RuleKind;",
    "  statement: string;",
    "  parameters: Readonly<Record<string, number>>;",
    "  violations: readonly string[];",
    "  source: string;",
    "};",
    "",
    "/** Every rule, by id. */",
    "export const RULES: Readonly<Record<RuleId, Rule>> = {",
  );
  for (const rule of spec.rules) {
    const parameters = rule.parameters.map((parameter) => `${parameter.name}: ${parameter.constant}`).join(", ");
    const violations = rule.violations.map((violation) => JSON.stringify(violation.name)).join(", ");
    lines.push(
      `  ${JSON.stringify(rule.id)}: {`,
      `    kind: ${JSON.stringify(rule.kind)},`,
      `    statement: ${JSON.stringify(rule.statement)},`,
      `    parameters: {${parameters === "" ? "" : ` ${parameters} `}},`,
      `    violations: [${violations}],`,
      `    source: ${JSON.stringify(rule.source)},`,
      "  },",
    );
  }
  lines.push("};", "");
  return lines.join("\n");
};

/** `packages/valid/src/problem.ts`: the `Field` and `Problem` unions. */
export const emitProblem = (spec: Spec, source: string, script: string) => {
  const fields: string[] = [];
  const types = new Set<string>();
  for (const input of spec.inputs) {
    for (const field of input.fields) {
      types.add(field.type);
      if (!fields.includes(field.name)) {
        fields.push(field.name);
      }
    }
  }
  const members: string[] = [];
  if (types.has("text")) {
    members.push('{ field: Field; rule: "not_text" }');
  }
  if (types.has("boolean")) {
    members.push('{ field: Field; rule: "not_boolean" }');
  }
  for (const rule of spec.rules) {
    if (rule.kind !== "input") {
      continue;
    }
    const rest = [
      `rule: ${JSON.stringify(rule.id)}`,
      `violation: ${union(rule.violations.map((violation) => violation.name))}`,
      ...rule.parameters.map((parameter) => `${parameter.name}: number`),
    ];
    const on = fieldsApplying(spec, rule.id);
    if (on.length > 0) {
      members.push(`{ ${[`field: ${union(on)}`, ...rest].join("; ")} }`);
    }
    if (appliedWhole(spec, rule.id)) {
      members.push(`{ ${rest.join("; ")} }`);
    }
  }
  return [
    header(source, script),
    "",
    "/**",
    " * Why a candidate is not an input: the rule it breaks, the field the rule",
    " * was applied to, how it was broken, and the rule's parameters. A problem",
    " * carries all of its rule's parameters, not only the ones the violation",
    " * touched. A problem carries no words; each delivery words it for the",
    " * person or program it answers (L27).",
    " *",
    " * Two kinds of rule:",
    " * - decode rules are generic, named by the type the field needs",
    " *   (`not_text`, `not_boolean`), with the field beside them, and are not",
    " *   cited;",
    ...wrap(
      `- input rules are the ones ${source} defines, each with a \`violation\` naming how it was broken. Use cases cite them by id (L33).`,
      " * ",
    ).map((line, index) => (index === 0 ? line : line.replace(/^ \* /, " *   "))),
    " */",
    "export type Problem =",
    ...members.map((member, index) => `  | ${member}${index === members.length - 1 ? ";" : ""}`),
    "",
    "/** A field a candidate can carry. */",
    `export type Field = ${union(fields)};`,
    "",
    "/** Every problem a candidate has, in the order its rules ran. Never empty. */",
    "export type Problems = [Problem, ...Problem[]];",
    "",
  ].join("\n");
};

/** `packages/valid/src/rules/<rule>.ts` for a rule of form `length` or `at least`. */
export const emitRule = (spec: Spec, rule: Rule, source: string, script: string) => {
  const form = rule.form as Form;
  const constants = constantsOf(spec);
  const used = rule.parameters.map((parameter) => parameter.constant).filter((name) => constants.has(name));
  const imports = [];
  if (used.length > 0) {
    imports.push(`import { ${[...new Set(used)].sort().join(", ")} } from "@todo/business/rules.ts";`);
  }
  imports.push('import type { Problem } from "../problem.ts";');
  const parameters = rule.parameters.map((parameter) => `${parameter.name}: ${parameter.constant}`);
  const problem = (field: boolean, violation: string) =>
    `{ ${[...(field ? ["field"] : []), `rule: ${JSON.stringify(rule.id)}`, `violation: ${JSON.stringify(violation)}`, ...parameters].join(", ")} }`;
  const body: string[] = [];
  let signature = "";
  if (form.kind === "length") {
    const on = union(fieldsApplying(spec, rule.id));
    signature = `(field: ${on}, value: string): Problem | undefined`;
    for (const violation of rule.violations) {
      const test =
        violation.condition === "below"
          ? `value.length < ${boundCode(rule, form.least)}`
          : `value.length > ${boundCode(rule, form.most)}`;
      body.push(`  if (${test}) {`, `    return ${problem(true, violation.name)};`, "  }");
    }
  } else if (form.kind === "atLeast") {
    const candidate = form.fields.map((name) => `${name}?: unknown`).join("; ");
    signature = `(candidate: { ${candidate} }): Problem | undefined`;
    const values = form.fields.map((name) => `candidate.${name}`).join(", ");
    body.push(`  const given = [${values}].filter((value) => value !== undefined).length;`);
    for (const violation of rule.violations) {
      body.push(`  if (given < ${form.count}) {`, `    return ${problem(false, violation.name)};`, "  }");
    }
  }
  return [
    header(source, script),
    ...imports,
    "",
    ...doc(`\`${rule.id}\`: ${rule.statement} Gives the problem of the first violation, or undefined when the rule holds.`),
    `export const ${camel(rule.id)} = ${signature} => {`,
    ...body,
    "  return undefined;",
    "};",
    "",
  ].join("\n");
};

/** A field needs a local function when it is more than its decode. */
const ownFunction = (field: InputField) => field.trimmed || field.rules.length > 0;

const fieldFunction = (field: InputField) => {
  const steps = [field.type, ...(field.trimmed ? ["trimmed"] : [])].join(", ");
  const rules = field.rules.map((id) => `\`${id}\``).join(", ");
  const lines = [
    ...doc(`\`${field.name}\`: ${steps}${rules === "" ? "" : `, then ${rules}`}.`),
    `const ${field.name}Field = (value: unknown): Result<${TS_TYPE[field.type]}, Problem> => {`,
    `  const decoded = ${DECODE[field.type]}(${JSON.stringify(field.name)}, value);`,
    "  if (!decoded.ok) {",
    "    return decoded;",
    "  }",
    "",
    `  const applied = decoded.value${field.trimmed ? ".trim()" : ""};`,
  ];
  for (const id of field.rules) {
    const name = `${camel(id)}Problem`;
    lines.push(
      `  const ${name} = ${camel(id)}(${JSON.stringify(field.name)}, applied);`,
      `  if (${name} !== undefined) {`,
      `    return err(${name});`,
      "  }",
    );
  }
  lines.push("", "  return ok(applied);", "};", "");
  return lines;
};

/** `packages/valid/src/<area>/<input>.ts`: the validator of one input. */
export const emitValidator = (spec: Spec, input: Input, source: string, script: string) => {
  for (const field of input.fields) {
    if (RESERVED.has(field.name)) {
      throw new Error(`${input.name}'s field ${field.name} takes a name the validator uses`);
    }
  }
  const rules = new Map(spec.rules.map((rule) => [rule.id, rule]));
  const decoders = [...new Set(input.fields.map((field) => DECODE[field.type]))].sort();
  const ruleIds = [...new Set([...input.rules, ...input.fields.flatMap((field) => field.rules)])].sort();
  const hasOwn = input.fields.some(ownFunction);
  const result = input.type === undefined ? TS_TYPE[input.fields[0]?.type ?? "text"] : input.name;

  const imports = ['import { type Result, err, ok } from "@todo/business/result.ts";'];
  if (input.type !== undefined) {
    imports.push(`import type { ${input.name} } from "@todo/business/${input.type}";`);
  }
  imports.push(`import { ${decoders.join(", ")} } from "../fields/decode.ts";`);
  if (input.fields.length > 1) {
    imports.push('import { problemsFrom } from "../fields/problems.ts";');
  }
  imports.push(`import type { ${hasOwn ? "Problem, " : ""}Problems } from "../problem.ts";`);
  for (const id of ruleIds) {
    if (rules.has(id)) {
      imports.push(`import { ${camel(id)} } from "../rules/${ruleFile(id)}.ts";`);
    }
  }

  const candidate = input.fields.map((field) => `${field.name}${field.optional ? "?" : ""}: unknown`).join("; ");
  const lines = [header(source, script), ...imports, ""];
  for (const field of input.fields.filter(ownFunction)) {
    lines.push(...fieldFunction(field));
  }
  lines.push(
    `/** What a delivery read for a \`${input.name}\`, not yet decoded. */`,
    `export type ${input.name}Candidate = { ${candidate} };`,
    "",
    ...doc(
      `A \`${input.name}\` from what a delivery read. ${input.doc} Gives every problem it finds, as ${source} › Every input says.`,
    ),
    `export const to${input.name} = (candidate: ${input.name}Candidate): Result<${result}, Problems> => {`,
  );
  for (const id of input.rules) {
    const name = `${camel(id)}Problem`;
    lines.push(
      `  const ${name} = ${camel(id)}(candidate);`,
      `  if (${name} !== undefined) {`,
      `    return err([${name}]);`,
      "  }",
      "",
    );
  }
  for (const field of input.fields) {
    const call = ownFunction(field)
      ? `${field.name}Field(candidate.${field.name})`
      : `${DECODE[field.type]}(${JSON.stringify(field.name)}, candidate.${field.name})`;
    lines.push(
      field.optional
        ? `  const ${field.name} = candidate.${field.name} === undefined ? undefined : ${call};`
        : `  const ${field.name} = ${call};`,
    );
  }
  lines.push("");
  input.fields.forEach((field, index) => {
    const later = input.fields.slice(index + 1).map((each) => each.name);
    const failed = field.optional ? `${field.name} !== undefined && !${field.name}.ok` : `!${field.name}.ok`;
    const problems = later.length === 0 ? `[${field.name}.error]` : `problemsFrom(${field.name}.error, [${later.join(", ")}])`;
    lines.push(`  if (${failed}) {`, `    return err(${problems});`, "  }");
  });
  lines.push("");
  if (input.builds !== undefined) {
    lines.push(`  return ok(${input.builds}.value);`);
  } else {
    const entries = input.fields.map((field) =>
      field.optional
        ? `...(${field.name} === undefined ? {} : { ${field.name}: ${field.name}.value })`
        : `${field.name}: ${field.name}.value`,
    );
    const only = entries.length === 1 && !input.fields[0]?.optional ? entries[0] : undefined;
    if (only === undefined) {
      lines.push("  return ok({", ...entries.map((entry) => `    ${entry},`), "  });");
    } else {
      lines.push(`  return ok({ ${only} });`);
    }
  }
  lines.push("};", "");
  return lines.join("\n");
};

const formText = (rule: Rule, form: Form, customPath: string) => {
  const bound = (each: Bound) => (each.kind === "number" ? String(each.value) : `\`${each.name}\``);
  switch (form.kind) {
    case "length":
      return `length, ${bound(form.least)} to ${bound(form.most)}`;
    case "atLeast":
      return `at least ${form.count} of ${form.fields.map((field) => `\`${field}\``).join(", ")}`;
    case "custom":
      return `custom, in [\`${customPath}\`](${customPath})`;
    default:
      return rule.id;
  }
};

export type IndexPaths = {
  /** The index file, relative to the repo root. */
  index: string;
  /** The spec, relative to the repo root. */
  spec: string;
  /** The use cases' directory, relative to the repo root. */
  useCases: string;
  /** `valid`'s directory, relative to the repo root. */
  valid: string;
};

/** The rules index: every rule, with what applies it and what cites it. */
export const emitIndex = (spec: Spec, useCases: UseCase[], paths: IndexPaths, script: string) => {
  const from = dirname(paths.index);
  const link = (path: string) => relative(from, path);
  const constants = constantsOf(spec);
  const appliedBy = (rule: Rule) =>
    spec.inputs.flatMap((input) => {
      const path = `${paths.valid}/src/${validatorPath(input)}`;
      const on = [
        ...(input.rules.includes(rule.id) ? ["the whole input"] : []),
        ...input.fields.filter((field) => field.rules.includes(rule.id)).map((field) => `\`${field.name}\``),
      ];
      return on.length === 0 ? [] : [{ name: `to${input.name}`, path, on: on.join(", ") }];
    });
  const citedBy = (rule: Rule) =>
    useCases.flatMap((useCase) =>
      useCase.citations
        .filter((citation) => citation.id === rule.id)
        .map((citation) => ({ title: useCase.title, path: useCase.path, section: citation.section })),
    );

  const lines = [
    `<!-- Generated from ${paths.spec} and the use cases under ${paths.useCases} by ${script}. Do not edit: change the spec and regenerate. -->`,
    "",
    "# Rules index",
    "",
    `Every rule [\`${paths.spec}\`](${link(paths.spec)}) defines: its kind, its`,
    "source, the validators that apply it and the use cases that cite it",
    "(L29, L33, L34). State rules and guarantees are enforced by operations",
    "and the store, which do not declare them yet.",
    "",
    "| Rule | Kind | Applied by | Cited by |",
    "|------|------|------------|----------|",
  ];
  for (const rule of spec.rules) {
    const applied = appliedBy(rule).map((each) => `\`${each.name}\``);
    const cited = [...new Set(citedBy(rule).map((each) => each.title))];
    lines.push(
      `| \`${rule.id}\` | ${rule.kind} | ${applied.join(", ") || "none"} | ${cited.join(", ") || "none"} |`,
    );
  }
  for (const rule of spec.rules) {
    lines.push("", `## \`${rule.id}\``, rule.statement, "", `- Kind: ${rule.kind}`);
    if (rule.form !== undefined) {
      const customPath = `${paths.valid}/src/rules/${ruleFile(rule.id)}.ts`;
      lines.push(`- Form: ${formText(rule, rule.form, link(customPath))}`);
    }
    if (rule.parameters.length > 0) {
      const parameters = rule.parameters.map(
        (parameter) => `\`${parameter.name}\` is \`${parameter.constant}\`, ${constants.get(parameter.constant)?.value}`,
      );
      lines.push(`- Parameters: ${parameters.join("; ")}`);
    }
    if (rule.violations.length > 0) {
      const violations = rule.violations.map((violation) =>
        violation.condition === undefined ? `\`${violation.name}\`` : `\`${violation.name}\` (${violation.condition})`,
      );
      lines.push(`- Violations: ${violations.join(", ")}`);
    }
    lines.push(`- Source: ${rule.source}`);
    const applied = appliedBy(rule);
    if (applied.length > 0) {
      lines.push("- Applied by:");
      for (const each of applied) {
        lines.push(`  - \`${each.name}\` in [\`${each.path}\`](${link(each.path)}), to ${each.on}`);
      }
    }
    const cited = citedBy(rule);
    lines.push(cited.length === 0 ? "- Cited by: none" : "- Cited by:");
    for (const each of cited) {
      lines.push(`  - [${each.title}](${link(each.path)}), ${each.section}`);
    }
  }
  lines.push("");
  return lines.join("\n");
};
