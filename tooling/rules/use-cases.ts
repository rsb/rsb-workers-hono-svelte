// Reads the rule ids the use cases cite (L30, L33) and checks each against
// the rules spec: the id exists, and it is cited in the section for its
// kind. A use case cites a rule by id only, so a Given or a Guarantees item
// is the id alone.

import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { ID, type Rule, type RuleKind } from "./parse.ts";

/** The sections a use case cites rules in, and the kind each one cites. */
export const SECTIONS = ["Assumes", "Given", "Guarantees"] as const;

export type Section = (typeof SECTIONS)[number];

const KIND_OF: Record<Section, RuleKind> = { Assumes: "input", Given: "state", Guarantees: "guarantee" };

export type Citation = { id: string; section: Section; line: number };

export type UseCase = { path: string; title: string; citations: Citation[] };

export type UseCaseProblem = { path: string; line: number; message: string };

/** Every backticked rule id on a line. */
const idsOn = (text: string) => [...text.matchAll(/`([^`]+)`/g)].map((match) => match[1] ?? "").filter((each) => ID.test(each));

/** The use case's `##` sections, each with its lines. */
const sections = (lines: string[]) => {
  const found = new Map<string, { text: string; line: number }[]>();
  let current: { text: string; line: number }[] | undefined;
  lines.forEach((text, index) => {
    if (text.startsWith("## ")) {
      current = [];
      found.set(text.slice(3).trim(), current);
      return;
    }
    current?.push({ text, line: index + 1 });
  });
  return found;
};

/**
 * A Given or a Guarantees section: `none`, or one `` - `id` `` per line and
 * nothing else.
 */
const listed = (body: { text: string; line: number }[], section: Section, path: string, problems: UseCaseProblem[]) => {
  const citations: Citation[] = [];
  const filled = body.filter((entry) => entry.text.trim() !== "");
  if (filled.length === 1 && filled[0]?.text.trim() === "none") {
    return citations;
  }
  for (const entry of filled) {
    const match = /^- `([^`]+)`$/.exec(entry.text);
    const id = match?.[1];
    if (id === undefined || !ID.test(id)) {
      problems.push({ path, line: entry.line, message: `a ${section} item is one rule id alone, or the section is none: ${entry.text}` });
      continue;
    }
    citations.push({ id, section, line: entry.line });
  }
  return citations;
};

/** Reads one use case's citations; a malformed section is a problem. */
export const readUseCase = (path: string, text: string, problems: UseCaseProblem[]): UseCase => {
  const lines = text.split("\n");
  const title = (lines.find((line) => line.startsWith("# ")) ?? path).replace(/^# /, "");
  const found = sections(lines);
  const citations: Citation[] = [];
  // An Assumes clause is the word and the ids after it, joined by commas or
  // "and", and it may wrap; it ends at the first thing that is not an id.
  const inputLines = found.get("Input") ?? [];
  const input = inputLines.map((entry) => entry.text).join("\n");
  const inputStart = inputLines[0]?.line ?? 1;
  for (const match of input.matchAll(/Assumes\b((?:\s+|,\s*|\s+and\s+)`[^`]+`)*/g)) {
    const line = inputStart + input.slice(0, match.index).split("\n").length - 1;
    const named = [...match[0].matchAll(/`([^`]+)`/g)].map((each) => each[1] ?? "");
    if (named.length === 0) {
      problems.push({ path, line, message: "Assumes lists rule ids alone, in backticks" });
    }
    for (const id of named) {
      if (!ID.test(id)) {
        problems.push({ path, line, message: `Assumes lists rule ids alone: ${id}` });
        continue;
      }
      citations.push({ id, section: "Assumes", line });
    }
  }
  const outside = input.replace(/Assumes\b((?:\s+|,\s*|\s+and\s+)`[^`]+`)*/g, "");
  for (const id of idsOn(outside)) {
    problems.push({ path, line: inputStart, message: `the input cites ${id} outside an Assumes clause` });
  }
  for (const section of ["Given", "Guarantees"] as const) {
    citations.push(...listed(found.get(section) ?? [], section, path, problems));
  }
  // A refusal names the Given rule that does not hold.
  const given = new Set(citations.filter((each) => each.section === "Given").map((each) => each.id));
  for (const entry of found.get("Refused") ?? []) {
    for (const id of idsOn(entry.text)) {
      if (!given.has(id)) {
        problems.push({ path, line: entry.line, message: `Refused names ${id}, which is not under Given` });
      }
    }
  }
  return { path, title, citations };
};

/** Every `.md` file under a directory, sorted, as paths joined to it. */
const markdown = (dir: string): string[] =>
  readdirSync(dir, { withFileTypes: true })
    .sort((a, b) => a.name.localeCompare(b.name))
    .flatMap((entry) => {
      const path = join(dir, entry.name);
      if (entry.isDirectory()) {
        return markdown(path);
      }
      return entry.name.endsWith(".md") ? [path] : [];
    });

export const readUseCases = (dir: string, problems: UseCaseProblem[]) =>
  markdown(dir).map((path) => readUseCase(path, readFileSync(path, "utf8"), problems));

/** Checks every citation against the rules: it exists, and its section is its kind's. */
export const checkCitations = (useCases: UseCase[], rules: Rule[]): UseCaseProblem[] => {
  const problems: UseCaseProblem[] = [];
  const byId = new Map(rules.map((rule) => [rule.id, rule]));
  for (const useCase of useCases) {
    for (const citation of useCase.citations) {
      const rule = byId.get(citation.id);
      if (rule === undefined) {
        problems.push({ path: useCase.path, line: citation.line, message: `${citation.id} is not a rule` });
        continue;
      }
      const kind = KIND_OF[citation.section];
      if (rule.kind !== kind) {
        problems.push({
          path: useCase.path,
          line: citation.line,
          message: `${citation.id} is a ${rule.kind} rule, but ${citation.section} cites ${kind} rules`,
        });
      }
    }
  }
  return problems;
};
