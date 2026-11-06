// Writes an api's OpenAPI 3.1 document from its parsed spec (L26). The
// document says what the contract says, in OpenAPI's terms: each shape is a
// schema, each kind a failure schema at its own status, and each example a
// named example on the request and on the reply it gets. Each route adds
// what the spec does not hold: `operationId`, the entry point's name, and
// `x-unit`, the unit it runs, read from the construct (L23, L24). Each
// endpoint's `Security:` is checked against its unit's row in `access.md`
// before it is written (L43).

import type { Requires } from "../access/parse.ts";
import type { RouteRow } from "../entry-chains/routes.ts";
import type { Endpoint, Example, Field, Shape, Spec, Type } from "./parse.ts";

/** What the document needs of `access.md`: each operation's least actor. */
export type AccessRows = readonly { operation: string; requires: Requires }[];

/**
 * The session cookie's name (`prd/todo.md` › Security). The api reads it
 * from its config, `SESSION_COOKIE`; a tooling test holds the two equal.
 * Under `http://localhost` the cookie is `sid`, which the document does not
 * describe.
 */
export const SESSION_COOKIE = "__Host-sid";

/**
 * The two ways a request names its session (L38): the BFF's cookie, or a
 * bearer token. OpenAPI cannot say which actor a session must be, so each
 * operation also says it as `x-requires`, in `access.md`'s words.
 */
const securitySchemes = {
  session: {
    type: "apiKey",
    in: "cookie",
    name: SESSION_COOKIE,
    description: "The BFF's session cookie. A request that changes something with it must come from the BFF's page.",
  },
  bearer: { type: "http", scheme: "bearer", description: "A session token, for a client that is not the BFF." },
};

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
  if (kind.carries !== undefined) {
    properties[kind.carries] = kind.carries === "reason" ? { type: "string", enum: kind.reasons } : { type: "string" };
    required.push(kind.carries);
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

const operation = (spec: Spec, endpoint: Endpoint, route: RouteRow): Json => {
  const op: Json = { operationId: route.name };
  // A probe runs no unit, so it has no `x-unit` (L20).
  if (route.unit !== null) {
    op["x-unit"] = route.unit;
  }
  op.description = `Serves: ${endpoint.serves}.`;
  // Either credential names a session; with neither, the request is
  // anonymous, which `{}` allows where the row lets anyone call.
  const credentials = [{ session: [] }, { bearer: [] }];
  op.security = endpoint.security === "anonymous" ? [{}, ...credentials] : credentials;
  op["x-requires"] = endpoint.security;

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

/**
 * Each endpoint's route, by the key the spec writes. Construct's types already
 * hold one route per endpoint; this says so again for a construct that has
 * not been type-checked since the spec changed. No two routes may share an
 * entry point's name, since it is their `operationId`.
 */
const routeByKey = (spec: Spec, routes: readonly RouteRow[]) => {
  const byKey = new Map(routes.map((route) => [route.key, route]));
  const keys = new Set(spec.endpoints.map((endpoint) => `${endpoint.method} ${endpoint.path}`));
  const unrouted = [...keys].filter((key) => !byKey.has(key));
  const unspecified = [...byKey.keys()].filter((key) => !keys.has(key));
  if (unrouted.length > 0 || unspecified.length > 0) {
    const lines = [
      ...unrouted.map((key) => `the spec has ${key}, and construct has no route for it`),
      ...unspecified.map((key) => `construct has a route for ${key}, and the spec has no such endpoint`),
    ];
    throw new Error(lines.join("\n"));
  }
  // OpenAPI requires each `operationId` to be unique in the document.
  const named = new Map<string, string>();
  for (const route of routes) {
    const other = named.get(route.name);
    if (other !== undefined) {
      throw new Error(`${other} and ${route.key} have the same operationId, ${route.name}; each route names its own entry point`);
    }
    named.set(route.name, route.key);
  }
  return byKey;
};

/**
 * Fails unless each endpoint's `Security:` is what its route runs under: its
 * unit's row in `access.md`, or `anonymous` for a probe, which runs no unit
 * and so no row (L20, L43).
 */
const checkSecurity = (endpoint: Endpoint, route: RouteRow, access: AccessRows) => {
  const key = `${endpoint.method} ${endpoint.path}`;
  if (route.unit === null) {
    if (endpoint.security !== "anonymous") {
      throw new Error(`${key} says Security: ${endpoint.security}, but it is a probe, which runs no unit: anonymous`);
    }
    return;
  }
  const row = access.find((found) => found.operation === route.unit);
  if (row === undefined) {
    throw new Error(`${key} runs ${route.unit}, which has no row in access.md`);
  }
  if (endpoint.security !== row.requires) {
    throw new Error(`${key} says Security: ${endpoint.security}, but ${route.unit}'s row in access.md requires ${row.requires}`);
  }
};

/** `openapi.json`: the whole document, as the text to write. */
export const emitOpenApi = (spec: Spec, routes: readonly RouteRow[], access: AccessRows, source: string, script: string) => {
  const byKey = routeByKey(spec, routes);
  const paths: Record<string, Json> = {};
  for (const endpoint of spec.endpoints) {
    const route = byKey.get(`${endpoint.method} ${endpoint.path}`) as RouteRow;
    checkSecurity(endpoint, route, access);
    paths[endpoint.path] ??= {};
    (paths[endpoint.path] as Json)[endpoint.method.toLowerCase()] = operation(spec, endpoint, route);
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
    components: { schemas, responses, securitySchemes },
  };
  return `${JSON.stringify(doc, null, 2)}\n`;
};
