// Writes an api's OpenAPI 3.1 document from its parsed spec (L26). The
// document says what the contract says, in OpenAPI's terms: each shape is a
// schema, each kind a failure schema at its own status, and each example a
// named example on the request and on the reply it gets.
//
// Not here yet: `operationId` and `x-unit`, which come from the construct.

import type { Endpoint, Example, Field, Shape, Spec, Type } from "./parse.ts";

const VERSION = "3.1.2";

type Json = Record<string, unknown>;

const ref = (name: string) => ({ $ref: `#/components/schemas/${name}` });

/** `not_found` → `NotFound`, for component names. */
const pascal = (name: string) =>
  name
    .split("_")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join("");

/** An example's name as a key: `the body is empty` → `the-body-is-empty`. */
const slug = (name: string) =>
  name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");

const typeSchema = (type: Type): Json => {
  if (type.kind === "text") {
    return { type: "string" };
  }
  if (type.kind === "boolean") {
    return { type: "boolean" };
  }
  if (type.kind === "integer") {
    if (type.min === undefined) {
      return { type: "integer" };
    }
    return { type: "integer", minimum: type.min };
  }
  if (type.kind === "literal") {
    return { type: typeof type.value === "boolean" ? "boolean" : "string", const: type.value };
  }
  if (type.kind === "oneOf") {
    return { type: "string", enum: type.values };
  }
  if (type.kind === "listOf") {
    return { type: "array", items: ref(type.shape) };
  }
  return ref(type.shape);
};

/** A field's schema, with the message the api replies when the field is wrong. */
const fieldSchema = (field: Field): Json => {
  const schema = typeSchema(field.type);
  if (field.message === undefined) {
    return schema;
  }
  return { ...schema, "x-message": field.message };
};

const shapeSchema = (shape: Shape): Json => {
  const schema: Json = {};
  if (shape.doc !== undefined) {
    schema.description = shape.doc;
  }
  if (shape.kind === "list") {
    return { ...schema, type: "array", items: ref(shape.of) };
  }
  schema.type = "object";
  schema.properties = Object.fromEntries(shape.fields.map((field) => [field.name, fieldSchema(field)]));
  const required = shape.fields.filter((field) => !field.optional).map((field) => field.name);
  if (required.length > 0) {
    schema.required = required;
  }
  schema.additionalProperties = false;
  if (shape.atLeast !== undefined) {
    schema.minProperties = shape.atLeast.fields;
    if (shape.atLeast.message !== undefined) {
      schema["x-message"] = shape.atLeast.message;
    }
  }
  return schema;
};

/** The failure envelope of one kind. */
const failureSchema = (kind: Spec["kinds"][number]): Json => {
  const properties: Json = { kind: { type: "string", const: kind.name }, message: { type: "string" } };
  const required = ["kind", "message"];
  if (kind.withField) {
    properties.field = { type: "string" };
    required.push("field");
  }
  return {
    type: "object",
    properties: {
      ok: { type: "boolean", const: false },
      error: { type: "object", properties, required, additionalProperties: false },
    },
    required: ["ok", "error"],
    additionalProperties: false,
  };
};

/** The success envelope around a reply shape. */
const successSchema = (reply: string): Json => ({
  type: "object",
  properties: { ok: { type: "boolean", const: true }, data: ref(reply) },
  required: ["ok", "data"],
  additionalProperties: false,
});

/** Named examples, or nothing when there are none. */
const named = (pairs: { name: string; value: unknown }[]): Json => {
  if (pairs.length === 0) {
    return {};
  }
  return { examples: Object.fromEntries(pairs.map((pair) => [slug(pair.name), { summary: pair.name, value: pair.value }])) };
};

/** The kind a reply fails with, or undefined for a success. */
const kindOf = (reply: unknown): string | undefined => {
  const envelope = reply as { ok: boolean; error?: { kind: string } };
  if (envelope.ok) {
    return undefined;
  }
  return envelope.error?.kind;
};

const replyExamples = (examples: Example[], kind: string | undefined) =>
  named(
    examples
      .filter((example) => kindOf(example.reply) === kind)
      .map((example) => ({ name: example.name, value: example.reply })),
  );

const parameters = (spec: Spec, endpoint: Endpoint): Json[] => {
  const found: Json[] = [];
  for (const param of endpoint.params) {
    const values = endpoint.examples.map((example) => ({
      name: example.name,
      value: example.request?.params[param.name],
    }));
    found.push({ name: param.name, in: "path", required: true, schema: typeSchema(param.type), ...named(values) });
  }

  const query = spec.shapes.find((shape) => shape.name === endpoint.query);
  if (query?.kind !== "object") {
    return found;
  }
  for (const field of query.fields) {
    const values = [];
    for (const example of endpoint.examples) {
      const given = (example.request?.query ?? []).filter(([key]) => key === field.name).map(([, value]) => value);
      if (given.length === 1) {
        values.push({ name: example.name, value: given[0] });
      } else if (given.length > 1) {
        values.push({ name: example.name, value: given });
      }
    }
    found.push({ name: field.name, in: "query", required: !field.optional, schema: fieldSchema(field), ...named(values) });
  }
  return found;
};

const operation = (spec: Spec, endpoint: Endpoint): Json => {
  const op: Json = { description: `Serves: ${endpoint.serves}.` };

  const params = parameters(spec, endpoint);
  if (params.length > 0) {
    op.parameters = params;
  }

  if (endpoint.body !== undefined) {
    const bodies = endpoint.examples
      .filter((example) => example.request?.body !== undefined)
      .map((example) => ({ name: example.name, value: example.request?.body }));
    op.requestBody = {
      required: true,
      content: { "application/json": { schema: ref(endpoint.body), ...named(bodies) } },
    };
  }

  const responses = new Map<number, Json>();
  responses.set(endpoint.status, {
    description: `\`${endpoint.reply}\` in the success envelope.`,
    content: {
      "application/json": { schema: successSchema(endpoint.reply), ...replyExamples(endpoint.examples, undefined) },
    },
  });
  for (const kind of spec.kinds) {
    if (spec.everyKinds.includes(kind.name)) {
      responses.set(kind.status, { $ref: `#/components/responses/${pascal(kind.name)}` });
    } else if (endpoint.errors.includes(kind.name)) {
      responses.set(kind.status, {
        description: `\`${kind.name}\``,
        content: {
          "application/json": { schema: ref(`${pascal(kind.name)}Failure`), ...replyExamples(endpoint.examples, kind.name) },
        },
      });
    }
  }
  const statuses = [...responses.keys()].sort((a, b) => a - b);
  op.responses = Object.fromEntries(statuses.map((status) => [String(status), responses.get(status)]));
  return op;
};

/** `openapi.json`: the whole document, as the text to write. */
export const emitOpenApi = (spec: Spec, source: string, script: string) => {
  const paths: Record<string, Json> = {};
  for (const endpoint of spec.endpoints) {
    paths[endpoint.path] ??= {};
    (paths[endpoint.path] as Json)[endpoint.method.toLowerCase()] = operation(spec, endpoint);
  }

  const schemas: Json = {};
  for (const shape of spec.shapes) {
    schemas[shape.name] = shapeSchema(shape);
  }
  for (const kind of spec.kinds) {
    schemas[`${pascal(kind.name)}Failure`] = failureSchema(kind);
  }

  const responses: Json = {};
  for (const kind of spec.kinds.filter((kind) => spec.everyKinds.includes(kind.name))) {
    responses[pascal(kind.name)] = {
      description: `\`${kind.name}\`, which every endpoint can return.`,
      content: {
        "application/json": { schema: ref(`${pascal(kind.name)}Failure`), ...replyExamples(spec.everyExamples, kind.name) },
      },
    };
  }

  const doc = {
    openapi: VERSION,
    "x-generated": `Generated from ${source} by ${script}. Do not edit: change the spec and regenerate.`,
    info: { title: spec.title, version: "0.0.0", description: spec.everyProse },
    servers: [{ url: "/" }],
    security: [],
    paths,
    components: { schemas, responses },
  };
  return `${JSON.stringify(doc, null, 2)}\n`;
};
