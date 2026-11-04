import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { readChains } from "./chains.ts";
import { readRoutes } from "./routes.ts";

const routes = await readRoutes("apps/api/src/construct.ts");
const index = readChains("apps/api/src/construct.ts", routes);

describe("the entry chains of apps/api", () => {
  it("has one chain per route, in construct's order", () => {
    assert.deepEqual(
      index.chains.map((chain) => chain.key),
      routes.map((route) => route.key),
    );
  });

  it("follows PATCH /todos/{id} to the data method, as L24 writes it", () => {
    const chain = index.chains.find((found) => found.key === "PATCH /todos/{id}");
    assert.equal(chain?.line, "PATCH /todos/{id} → patchTodo → updateTodo ⇢ UpdateStore.updateTodo → d1.updateTodo");
  });

  it("ends a probe's chain at the probe", () => {
    const chain = index.chains.find((found) => found.key === "GET /health");
    assert.equal(chain?.line, "GET /health → getHealth");
    assert.deepEqual(
      chain?.rows.map((row) => row.label),
      ["route", "probe"],
    );
  });

  it("lists the driver once, as a shared link, and in no chain", () => {
    const driver = index.shared.filter((row) => row.label === "driver");
    assert.deepEqual(driver, [
      { label: "driver", path: "packages/data/d1/src/driver.ts", symbols: ["execute", "queryAll", "writeThenQueryAll"] },
    ]);
    for (const chain of index.chains) {
      assert.equal(
        chain.rows.some((row) => row.path.endsWith("driver.ts")),
        false,
        chain.key,
      );
    }
  });
});
