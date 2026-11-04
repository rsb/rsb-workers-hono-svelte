// Checks the join (L33): what the specs say each endpoint applies, against
// what its route runs, and each state rule a use case is given against a
// test named by its id in the unit report. It writes nothing.
//
//   node tooling/join/check.ts <rules spec> <use cases dir> <api spec> <construct> <unit report> <unit tests dir>
//
// It reads the other tools' inputs with their own readers, and fails when a
// spec does not read. The unit report is written by `pnpm test:unit`, which
// runs first; a report older than the tests is refused. Paths are relative
// to the repo root.

import { readFileSync } from "node:fs";
import { parse as parseApi } from "../api-spec/parse.ts";
import { ChainError } from "../entry-chains/read.ts";
import { type RouteRow, readRoutes } from "../entry-chains/routes.ts";
import { parse as parseRules } from "../rules/parse.ts";
import { readUseCases, type UseCaseProblem } from "../rules/use-cases.ts";
import { joinProblems } from "./join.ts";
import { readReport } from "./report.ts";

const USAGE =
  "usage: node tooling/join/check.ts <rules spec> <use cases dir> <api spec> <construct> <unit report> <unit tests dir>";

/** The command that writes the unit report. */
const RUN = "pnpm test:unit";

const main = async (args: string[]) => {
  const [rulesPath, useCasesDir, apiPath, constructPath, reportPath, testsDir] = args;
  if (testsDir === undefined || args.length !== 6) {
    console.error(USAGE);
    return 2;
  }

  const rules = parseRules(readFileSync(rulesPath as string, "utf8"));
  const api = parseApi(readFileSync(apiPath as string, "utf8"));
  const useCaseProblems: UseCaseProblem[] = [];
  const useCases = readUseCases(useCasesDir as string, useCaseProblems);
  let routes: RouteRow[] = [];
  let unread = 0;
  if (!rules.ok) {
    for (const problem of rules.problems) {
      console.error(`${rulesPath}:${problem.line}: ${problem.message}`);
    }
    unread += 1;
  }
  if (!api.ok) {
    for (const problem of api.problems) {
      console.error(`${apiPath}:${problem.line}: ${problem.message}`);
    }
    unread += 1;
  }
  for (const problem of useCaseProblems) {
    console.error(`${problem.path}:${problem.line}: ${problem.message}`);
    unread += 1;
  }
  try {
    routes = await readRoutes(constructPath as string);
  } catch (error) {
    if (!(error instanceof ChainError)) {
      throw error;
    }
    console.error(error.message);
    unread += 1;
  }
  if (unread > 0 || !rules.ok || !api.ok) {
    return 1;
  }

  const problems = joinProblems({
    rules: rules.spec.rules,
    useCases,
    apiPath: apiPath as string,
    endpoints: api.spec.endpoints,
    constructPath: constructPath as string,
    routes,
    report: readReport(reportPath as string, testsDir, RUN),
  });
  for (const problem of problems) {
    console.error(problem);
  }
  return problems.length > 0 ? 1 : 0;
};

process.exitCode = await main(process.argv.slice(2));
