import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { emitIndex } from "./emit.ts";

describe("emitIndex", () => {
  const text = emitIndex(
    {
      shared: [{ label: "driver", path: "d/driver.ts", symbols: ["execute"] }],
      chains: [
        {
          key: "GET /x",
          line: "GET /x → getX → listX",
          rows: [
            { label: "use case", path: "prd/x.md", symbols: [] },
            { label: "handler", path: "a/get-x.ts", symbols: ["getX"] },
          ],
        },
      ],
    },
    "c.ts",
    "gen.ts",
  );

  it("names its source and its generator on the first line", () => {
    assert.equal(text.split("\n")[0], "Generated from c.ts by gen.ts. Do not edit: change the code and regenerate.");
  });

  it("lines the columns up across the file, and leaves a row with no symbols unpadded", () => {
    const lines = text.split("\n");
    assert.ok(lines.includes("driver    d/driver.ts  execute"));
    assert.ok(lines.includes("handler   a/get-x.ts   getX"));
    assert.ok(lines.includes("use case  prd/x.md"));
  });

  it("writes one block per entry point, its chain first, and ends in a newline", () => {
    assert.match(text, /\n## GET \/x\n\n```text\nGET \/x → getX → listX\n\nuse case/);
    assert.equal(text.endsWith("```\n"), true);
  });
});
