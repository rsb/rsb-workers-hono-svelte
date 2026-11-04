import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { Rule } from "./parse.ts";
import { type UseCaseProblem, checkCitations, readUseCase, readUseCases } from "./use-cases.ts";

const rule = (id: string, kind: Rule["kind"]): Rule => ({
  id,
  statement: "",
  kind,
  form: undefined,
  parameters: [],
  violations: [],
  source: "",
  line: 1,
});

const RULES = [rule("title.length", "input"), rule("todos.cap", "state"), rule("todos.order", "guarantee")];

/** A use case with the given sections. */
const useCase = (input: string, given: string, refused: string, guarantees: string) => `# Add a todo

## Input
${input}

## Given
${given}

## Refused
${refused}

## Guarantees
${guarantees}
`;

const read = (text: string) => {
  const problems: UseCaseProblem[] = [];
  const read = readUseCase("add.md", text, problems);
  problems.push(...checkCitations([read], RULES));
  return { citations: read.citations, problems: problems.map((problem) => `${problem.line}: ${problem.message}`) };
};

describe("readUseCase", () => {
  it("reads every citation, with its section", () => {
    const { citations, problems } = read(
      useCase("- A `NewTodo`: a title. Assumes\n  `title.length`.", "- `todos.cap`", "- `todos.cap` does not hold: `limit`.", "- `todos.order`"),
    );
    assert.deepEqual(problems, []);
    assert.deepEqual(
      citations.map((citation) => [citation.section, citation.id, citation.line]),
      [
        ["Assumes", "title.length", 4],
        ["Given", "todos.cap", 8],
        ["Guarantees", "todos.order", 14],
      ],
    );
  });

  it("reads none as no citations", () => {
    assert.deepEqual(read(useCase("- An id.", "none", "none", "none")), { citations: [], problems: [] });
  });

  it("refuses a gloss after a Given id", () => {
    const { problems } = read(useCase("- An id.", "- `todos.cap`: the list has room.", "none", "none"));
    assert.deepEqual(problems, ["7: a Given item is one rule id alone, or the section is none: - `todos.cap`: the list has room."]);
  });

  it("refuses an id cited in the wrong section for its kind", () => {
    const { problems } = read(useCase("- An id.", "- `todos.order`", "none", "- `todos.cap`"));
    assert.deepEqual(problems, [
      "7: todos.order is a guarantee rule, but Given cites state rules",
      "13: todos.cap is a state rule, but Guarantees cites guarantee rules",
    ]);
  });

  it("refuses an id that is not a rule", () => {
    const { problems } = read(useCase("- A title. Assumes `title.short`.", "none", "none", "none"));
    assert.deepEqual(problems, ["4: title.short is not a rule"]);
  });

  it("refuses an input rule cited outside an Assumes clause", () => {
    const { problems } = read(useCase("- A title, held to `title.length`.", "none", "none", "none"));
    assert.deepEqual(problems, ["4: the input cites title.length outside an Assumes clause"]);
  });

  it("refuses a refusal of a rule that is not under Given", () => {
    const { problems } = read(useCase("- An id.", "none", "- `todos.cap` does not hold: `limit`.", "none"));
    assert.deepEqual(problems, ["10: Refused names todos.cap, which is not under Given"]);
  });
});

describe("readUseCases", () => {
  it("reads the committed use cases without a problem", () => {
    const problems: UseCaseProblem[] = [];
    const useCases = readUseCases("prd/todo/use-cases", problems);
    assert.deepEqual(problems, []);
    assert.equal(useCases.length, 7);
  });
});
