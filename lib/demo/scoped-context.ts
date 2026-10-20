import fs from "node:fs";
import path from "node:path";

export type FileRule = {
  name: string;
  globs: readonly string[];
  convention: string;
};

export type NestedAgentsFile = {
  folder: string;
  convention: string;
};

export type ScopedContextFile = {
  path: string;
  source: string;
};

export const fileRules: readonly FileRule[] = [
  {
    name: "api-route-header",
    globs: ["app/api/**/*.ts"],
    convention:
      "The first line of every route handler file you create or edit is `// API: <METHODS> /api/<path>`, for example `// API: POST /api/transfers`. Add the line if it is missing and keep it accurate.",
  },
  {
    name: "test-names",
    globs: ["**/*.test.ts", "**/*.test.tsx"],
    convention:
      'Every test you add or rename has a title that starts with "when ", for example `it("when the amount is zero, rejects the transfer")`.',
  },
];

export const nestedAgents: NestedAgentsFile = {
  folder: "components/banking",
  convention:
    "The first line of every file you create or edit in this folder is `// Banking UI: <file name>`, for example `// Banking UI: transfer-form.tsx`. Add the line if it is missing.",
};

export function fileRuleSource(rule: FileRule): string {
  return [
    "---",
    `globs: ${rule.globs.join(",")}`,
    "alwaysApply: false",
    "---",
    "",
    rule.convention,
    "",
  ].join("\n");
}

export function nestedAgentsSource(file: NestedAgentsFile): string {
  return `# ${file.folder}\n\n${file.convention}\n`;
}

export const scopedContextFiles: readonly ScopedContextFile[] = [
  ...fileRules.map((rule) => ({
    path: `.cursor/rules/${rule.name}.mdc`,
    source: fileRuleSource(rule),
  })),
  {
    path: `${nestedAgents.folder}/AGENTS.md`,
    source: nestedAgentsSource(nestedAgents),
  },
];

// Vitest must not write live rules: they would load into the agent running the tests.
export const scopedContextPaths = {
  root: process.env.VITEST
    ? path.join(process.cwd(), ".cursor", "scoped-context-vitest")
    : process.cwd(),
};

function absolute(file: ScopedContextFile): string {
  return path.join(scopedContextPaths.root, file.path);
}

export function installScopedContext(): void {
  for (const file of scopedContextFiles) {
    fs.mkdirSync(path.dirname(absolute(file)), { recursive: true });
    fs.writeFileSync(absolute(file), file.source);
  }
}

export function uninstallScopedContext(): void {
  for (const file of scopedContextFiles) {
    fs.rmSync(absolute(file), { force: true });
  }
}

export function scopedContextGuardrail(): string {
  return scopedContextFiles
    .flatMap((file) => [
      `$ cat ${file.path}`,
      fs.readFileSync(absolute(file), "utf8").trim(),
      "",
    ])
    .join("\n")
    .trim();
}
