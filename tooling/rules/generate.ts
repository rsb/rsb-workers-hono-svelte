// Generates business's rule table and valid's problems, rule functions and
// validators from a rules spec, and the rules index from the spec and the
// use cases (L34).
//
//   node tooling/rules/generate.ts <spec> <use cases dir> <business dir> <valid dir>
//   node tooling/rules/generate.ts <spec> <use cases dir> <business dir> <valid dir> --check
//
// Both fail when the spec breaks its vocabulary, when a use case cites an
// id that is not a rule or cites it in the wrong section for its kind, when
// a custom rule's file is missing or does not export its id, or when
// `valid/src/rules` holds a file no rule generates or owns. With --check it
// writes nothing: it also fails when a committed file differs from what the
// spec generates. Paths are relative to the repo root.

import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { dirname, join, relative } from "node:path/posix";
import {
  emitBusinessRules,
  emitIndex,
  emitProblem,
  emitRule,
  emitValidator,
  generated,
  ruleFile,
  validatorPath,
} from "./emit.ts";
import { parse } from "./parse.ts";
import { checkCitations, readUseCases, type UseCaseProblem } from "./use-cases.ts";

const SCRIPT = "tooling/rules/generate.ts";

const REGENERATE = "pnpm gen:rules";

const USAGE = "usage: node tooling/rules/generate.ts <spec> <use cases dir> <business dir> <valid dir> [--check]";

type File = { path: string; text: string };

/** Writes each file, or with `check` compares it to the committed one. Returns how many differ. */
const settle = (files: File[], check: boolean, source: string) => {
  let stale = 0;
  for (const file of files) {
    if (!check) {
      mkdirSync(dirname(file.path), { recursive: true });
      writeFileSync(file.path, file.text);
      console.log(`wrote ${file.path}`);
      continue;
    }
    let committed = "";
    try {
      committed = readFileSync(file.path, "utf8");
    } catch {
      committed = "";
    }
    if (committed !== file.text) {
      console.error(`${file.path} differs from what ${source} generates; run ${REGENERATE}`);
      stale += 1;
    }
  }
  return stale;
};

const report = (problems: UseCaseProblem[]) => {
  for (const problem of problems) {
    console.error(`${problem.path}:${problem.line}: ${problem.message}`);
  }
};

const main = (args: string[]) => {
  const check = args.includes("--check");
  const [specPath, useCasesDir, businessDir, validDir] = args.filter((arg) => arg !== "--check");
  if (specPath === undefined || useCasesDir === undefined || businessDir === undefined || validDir === undefined) {
    console.error(USAGE);
    return 2;
  }

  const source = relative(process.cwd(), specPath);
  const parsed = parse(readFileSync(specPath, "utf8"));
  if (!parsed.ok) {
    for (const problem of parsed.problems) {
      console.error(`${source}:${problem.line}: ${problem.message}`);
    }
    return 1;
  }
  const spec = parsed.spec;

  const useCaseProblems: UseCaseProblem[] = [];
  const useCases = readUseCases(useCasesDir, useCaseProblems);
  useCaseProblems.push(...checkCitations(useCases, spec.rules));
  if (useCaseProblems.length > 0) {
    report(useCaseProblems);
    return 1;
  }

  // A custom rule is written by hand; the generator owns the rest of rules/.
  const rulesDir = join(validDir, "src", "rules");
  const owned = new Set<string>();
  let broken = 0;
  for (const rule of spec.rules) {
    if (rule.form === undefined) {
      continue;
    }
    const name = `${ruleFile(rule.id)}.ts`;
    owned.add(name);
    if (generated(rule)) {
      continue;
    }
    const path = join(rulesDir, name);
    const text = existsSync(path) ? readFileSync(path, "utf8") : undefined;
    if (text === undefined) {
      console.error(`${path}: ${rule.id} is custom, so this file is written by hand, and it is missing`);
      broken += 1;
      continue;
    }
    if (!text.includes(`export const id = ${JSON.stringify(rule.id)};`)) {
      console.error(`${path}: a custom rule's file exports its id: export const id = ${JSON.stringify(rule.id)};`);
      broken += 1;
    }
  }
  for (const name of existsSync(rulesDir) ? readdirSync(rulesDir) : []) {
    if (!owned.has(name)) {
      console.error(`${join(rulesDir, name)}: no rule in ${source} generates or owns this file; delete it`);
      broken += 1;
    }
  }
  if (broken > 0) {
    return 1;
  }

  const files: File[] = [
    { path: join(businessDir, "src", "rules.ts"), text: emitBusinessRules(spec, source, SCRIPT) },
    { path: join(validDir, "src", "problem.ts"), text: emitProblem(spec, source, SCRIPT) },
    ...spec.rules
      .filter(generated)
      .map((rule) => ({ path: join(rulesDir, `${ruleFile(rule.id)}.ts`), text: emitRule(spec, rule, source, SCRIPT) })),
    ...spec.inputs.map((input) => ({
      path: join(validDir, "src", validatorPath(input)),
      text: emitValidator(spec, input, source, SCRIPT),
    })),
  ];
  const index = join(businessDir, "rules-index.md");
  files.push({
    path: index,
    text: emitIndex(spec, useCases, { index, spec: source, useCases: relative(process.cwd(), useCasesDir), valid: validDir }, SCRIPT),
  });

  if (settle(files, check, `${source} and ${useCasesDir}`) > 0) {
    return 1;
  }
  return 0;
};

process.exitCode = main(process.argv.slice(2));
