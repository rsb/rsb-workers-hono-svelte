// Spec fragments the rules tooling's tests share.

/** A spec with the given inputs and rules, and one constant. */
export const spec = (inputs: string, rules: string) => `# Test rules

## Every input

Prose the generator does not read.

### How an input is written
- Not read either.

## Constants

- \`TITLE_MAX\`: 10. The longest title.

## Inputs
${inputs}
## Rules
${rules}`;

export const TITLE_INPUT = `
### \`NewTodo\`
What someone asks to add.
Area: \`todos\`
Type: \`todos/todo.ts\`

Fields:
- \`title\`: text, trimmed
  - \`title.length\`
`;

export const TITLE_RULE = `
### \`title.length\`
A title is 1 to \`max\` long.
Kind: input
Form: length, 1 to \`max\`

Parameters:
- \`max\`: \`TITLE_MAX\`

Violations:
- \`empty\`: below
- \`too_long\`: above

Source: PRD deviation 7.
`;
