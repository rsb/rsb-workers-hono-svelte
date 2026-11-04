// Writes the contract's generated files from a parsed api spec (L26): the
// error kinds, the messages as valibot schemas, and the endpoints (A4).
// Each function returns a file's text; nothing here touches the disk.

import type { Endpoint, Example, Field, Shape, Spec, Type } from "./parse.ts";

const header = (source: string, script: string) =>
  `// Generated from ${source} by ${script}. Do not edit: change the spec and regenerate.\n`;

const quote = (text: string) => JSON.stringify(text);

/** A schema's arguments: its message, when the spec gives one. */
const withMessage = (args: string[], message: string | undefined) => {
  if (message !== undefined) {
    args.push(quote(message));
  }
  return args.join(", ");
};

const typeSchema = (type: Type, message: string | undefined): string => {
  if (type.kind === "text") {
    return `v.string(${withMessage([], message)})`;
  }
  if (type.kind === "boolean") {
    return `v.boolean(${withMessage([], message)})`;
  }
  if (type.kind === "integer") {
    const steps = [`v.number(${withMessage([], message)})`, `v.integer(${withMessage([], message)})`];
    if (type.min !== undefined) {
      steps.push(`v.minValue(${withMessage([String(type.min)], message)})`);
    }
    return `v.pipe(${steps.join(", ")})`;
  }
  if (type.kind === "literal") {
    return `v.literal(${withMessage([JSON.stringify(type.value)], message)})`;
  }
  if (type.kind === "oneOf") {
    const values = `[${type.values.map(quote).join(", ")}]`;
    return `v.picklist(${withMessage([values], message)})`;
  }
  if (type.kind === "listOf") {
    return `v.array(${withMessage([type.shape], message)})`;
  }
  return type.shape;
};

const fieldSchema = (field: Field) => {
  const schema = typeSchema(field.type, field.message);
  if (field.optional) {
    return `v.exactOptional(${schema})`;
  }
  return schema;
};

const shapeSchema = (shape: Shape) => {
  if (shape.kind === "list") {
    return `v.array(${shape.of})`;
  }
  const lines = shape.fields.map((field) => `  ${field.name}: ${fieldSchema(field)},`);
  const object = `v.strictObject({\n${lines.join("\n")}\n})`;
  if (shape.atLeast === undefined) {
    return object;
  }
  const rule = `v.minEntries(${withMessage([String(shape.atLeast.fields)], shape.atLeast.message)})`;
  const indented = object.replaceAll("\n", "\n  ");
  return `v.pipe(\n  ${indented},\n  ${rule},\n)`;
};

/** The shapes a shape names, so it can be declared after them. */
const uses = (shape: Shape): string[] => {
  if (shape.kind === "list") {
    return [shape.of];
  }
  const names: string[] = [];
  for (const field of shape.fields) {
    if (field.type.kind === "ref" || field.type.kind === "listOf") {
      names.push(field.type.shape);
    }
  }
  return names;
};

/** The shapes in the spec's order, each after the shapes it names. */
const declarationOrder = (shapes: Shape[]): Shape[] => {
  const byName = new Map(shapes.map((shape) => [shape.name, shape]));
  const done = new Set<string>();
  const ordered: Shape[] = [];
  const visit = (shape: Shape, path: string[]) => {
    if (done.has(shape.name)) {
      return;
    }
    if (path.includes(shape.name)) {
      throw new Error(`shapes name each other in a cycle: ${[...path, shape.name].join(" → ")}`);
    }
    for (const name of uses(shape)) {
      const used = byName.get(name);
      if (used) {
        visit(used, [...path, shape.name]);
      }
    }
    done.add(shape.name);
    ordered.push(shape);
  };
  for (const shape of shapes) {
    visit(shape, []);
  }
  return ordered;
};

const routeName = (endpoint: Endpoint) => `\`${endpoint.method} ${endpoint.path}\``;

const joinNames = (names: string[]) => {
  if (names.length <= 1) {
    return names.join("");
  }
  return `${names.slice(0, -1).join(", ")} and ${names.at(-1)}`;
};

/** A shape's doc comment: the spec's prose, then the endpoints that use it and how. */
const shapeDoc = (shape: Shape, endpoints: Endpoint[]) => {
  const roles: string[] = [];
  const role = (label: string, pick: (endpoint: Endpoint) => string | undefined) => {
    const users = endpoints.filter((endpoint) => pick(endpoint) === shape.name).map(routeName);
    if (users.length > 0) {
      roles.push(`The ${label} of ${joinNames(users)}.`);
    }
  };
  role("query", (endpoint) => endpoint.query);
  role("body", (endpoint) => endpoint.body);
  role("data", (endpoint) => endpoint.reply);

  const parts = [];
  if (shape.doc !== undefined) {
    parts.push(shape.doc);
  }
  parts.push(...roles);
  if (parts.length === 0) {
    return "";
  }
  return `/** ${parts.join(" ")} */\n`;
};

/** `kinds.ts`: the envelope's error kinds. */
export const emitKinds = (spec: Spec, source: string, script: string) => {
  const all = spec.kinds.map((kind) => quote(kind.name));
  const field = spec.kinds.filter((kind) => kind.withField).map((kind) => quote(kind.name));
  const other = spec.kinds.filter((kind) => !kind.withField).map((kind) => quote(kind.name));
  const every = spec.everyKinds.map(quote);
  const statuses = spec.kinds.map((kind) => `  ${kind.name}: ${kind.status},`);
  return `${header(source, script)}import * as v from "valibot";

/** Every kind an API error can have (PRD, Envelope). */
export const ErrorKind = v.picklist([${all.join(", ")}]);
export type ErrorKind = v.InferOutput<typeof ErrorKind>;

/** The kinds that carry a \`field\`. */
export const FieldKind = v.picklist([${field.join(", ")}]);
export type FieldKind = v.InferOutput<typeof FieldKind>;

/** The kinds that carry no \`field\`. */
export const OtherKind = v.picklist([${other.join(", ")}]);
export type OtherKind = v.InferOutput<typeof OtherKind>;

/** The kinds every endpoint can return, before the ones it adds. */
export const EVERY_KINDS = [${every.join(", ")}] as const satisfies readonly ErrorKind[];

/** The HTTP status each kind replies with. */
export const KIND_STATUS = {
${statuses.join("\n")}
} as const satisfies Record<ErrorKind, number>;
`;
};

/** \`messages.ts\`: every shape, as a valibot schema and its type. */
export const emitMessages = (spec: Spec, source: string, script: string) => {
  const blocks = declarationOrder(spec.shapes).map((shape) => {
    const doc = shapeDoc(shape, spec.endpoints);
    const schema = shapeSchema(shape);
    return `${doc}export const ${shape.name} = ${schema};\nexport type ${shape.name} = v.InferOutput<typeof ${shape.name}>;\n`;
  });
  return `${header(source, script)}import * as v from "valibot";\n\n${blocks.join("\n")}`;
};

/** The kinds an endpoint can return: every endpoint's, then its own, in the spec's order of kinds. */
export const endpointKinds = (spec: Spec, endpoint: Endpoint) => {
  const kinds = new Set([...spec.everyKinds, ...endpoint.errors]);
  return spec.kinds.map((kind) => kind.name).filter((name) => kinds.has(name));
};

/** \`endpoints.ts\`: each endpoint as plain data (A4), keyed by method and path. */
export const emitEndpoints = (spec: Spec, source: string, script: string) => {
  const names = new Set<string>();
  const entries = spec.endpoints.map((endpoint) => {
    const lines = [
      `    method: ${quote(endpoint.method)},`,
      `    path: ${quote(endpoint.path)},`,
      `    params: [${endpoint.params.map((param) => quote(param.name)).join(", ")}],`,
    ];
    if (endpoint.query !== undefined) {
      names.add(endpoint.query);
      lines.push(`    query: ${endpoint.query},`);
    }
    if (endpoint.body !== undefined) {
      names.add(endpoint.body);
      lines.push(`    body: ${endpoint.body},`);
    }
    names.add(endpoint.reply);
    lines.push(`    status: ${endpoint.status},`);
    lines.push(`    reply: ${endpoint.reply},`);
    lines.push(`    errors: [${endpointKinds(spec, endpoint).map(quote).join(", ")}],`);
    return `  ${quote(`${endpoint.method} ${endpoint.path}`)}: {\n${lines.join("\n")}\n  },`;
  });

  const imports = [...names].sort().map((name) => `  ${name},`);
  return `${header(source, script)}import type * as v from "valibot";
import type { ErrorKind } from "./kinds.ts";
import {
${imports.join("\n")}
} from "./messages.ts";

/**
 * An endpoint as plain data: its method and path, with path parameters in
 * braces; the schemas of its query, body and reply; its success status; and
 * every error kind it can return.
 */
export type Endpoint = {
  method: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
  path: string;
  params: readonly string[];
  query?: v.GenericSchema;
  body?: v.GenericSchema;
  status: number;
  reply: v.GenericSchema;
  errors: readonly ErrorKind[];
};

/** Every endpoint the api serves, keyed by method and path as the spec writes them. */
export const endpoints = {
${entries.join("\n")}
} as const satisfies Record<string, Endpoint>;

export type EndpointKey = keyof typeof endpoints;

/** The error kinds an endpoint can return, as a type a switch can be exhaustive over. */
export type EndpointErrors<K extends EndpointKey> = (typeof endpoints)[K]["errors"][number];
`;
};

/** An example as plain data: the request without an undefined body, then the reply. */
const exampleData = (example: Example) => {
  const data: Record<string, unknown> = { name: example.name };
  if (example.request !== undefined) {
    const { body, ...request } = example.request;
    data.request = body === undefined ? request : { ...request, body };
  }
  data.status = example.status;
  data.reply = example.reply;
  return data;
};

/** JSON as TypeScript, indented to sit at `depth`. */
const literal = (value: unknown, depth: number) => JSON.stringify(value, null, 2).replaceAll("\n", `\n${"  ".repeat(depth)}`);

/** `examples.ts`: the spec's examples as plain data, for tests to replay. */
export const emitExamples = (spec: Spec, source: string, script: string) => {
  const list = (examples: Example[], depth: number) => literal(examples.map(exampleData), depth);
  const entries = spec.endpoints.map(
    (endpoint) => `  ${quote(`${endpoint.method} ${endpoint.path}`)}: ${list(endpoint.examples, 1)},`,
  );
  return `${header(source, script)}import type { EndpointKey } from "./endpoints.ts";

/**
 * A worked example: the request as sent, with its path parameters read
 * out, and the reply's status and whole envelope. The examples every
 * endpoint shares have no request.
 */
export type Example = {
  name: string;
  request?: {
    method: string;
    path: string;
    params: Record<string, string>;
    query: [string, string][];
    body?: unknown;
  };
  status: number;
  reply: unknown;
};

/** The examples every endpoint shares: failures any request can meet. */
export const everyExamples: Example[] = ${list(spec.everyExamples, 0)};

/** Each endpoint's examples, keyed as \`endpoints\` is. */
export const examples: Record<EndpointKey, Example[]> = {
${entries.join("\n")}
};
`;
};
