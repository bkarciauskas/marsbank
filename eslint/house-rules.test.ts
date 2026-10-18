import { ESLint } from "eslint";
import path from "node:path";
import { describe, expect, it } from "vitest";

const eslint = new ESLint({ cwd: path.resolve(".") });

async function errors(code: string, filePath: string): Promise<string[]> {
  const [result] = await eslint.lintText(code, {
    filePath: path.resolve(filePath),
  });
  if (!result) {
    throw new Error(`ESLint returned no result for ${filePath}`);
  }
  return result.messages
    .filter((message) => message.severity === 2)
    .map((message) => message.message);
}

describe("house rules", () => {
  it("rejects a page that imports the ledger, and accepts useBank()", async () => {
    const red = await errors(
      `import { getLedgerRepository } from "@/lib/server/ledger-repository";
export const probe = getLedgerRepository;
`,
      "components/banking/probe.tsx",
    );
    expect(red.join("\n")).toContain("useBank()");

    const green = await errors(
      `import { useBank } from "@/lib/store";
export function RegisterName() {
  const { snapshot } = useBank();
  return snapshot.customer.displayName;
}
`,
      "components/banking/probe.tsx",
    );
    expect(green).toEqual([]);
  });

  it("rejects parseFloat and accepts parseTokenInput()", async () => {
    const red = await errors(
      `export const amount = parseFloat("12.5");
`,
      "components/banking/probe.tsx",
    );
    expect(red.join("\n")).toContain("parseTokenInput()");

    const green = await errors(
      `import { parseTokenInput } from "@/lib/money";
export const amount = parseTokenInput("12");
`,
      "components/banking/probe.tsx",
    );
    expect(green).toEqual([]);
  });

  it("rejects `as any` and accepts tokens()", async () => {
    const red = await errors(
      `export const amount = "12" as any;
`,
      "lib/money.ts",
    );
    expect(red.join("\n")).toContain("tokens()");

    const green = await errors(
      `import { tokens } from "./money";
export const amount = tokens(12);
`,
      "components/banking/probe.tsx",
    );
    expect(green).toEqual([]);
  });

  it("rejects React inside a domain module", async () => {
    const red = await errors(
      `import { useState } from "react";
export const probe = useState;
`,
      "lib/ledger.ts",
    );
    expect(red.join("\n")).toContain("Domain modules stay free of React");

    const green = await errors(
      `import { tokens } from "./money";
export const amount = tokens(12);
`,
      "lib/ledger.ts",
    );
    expect(green).toEqual([]);
  });

  it("rejects postgres outside the repository", async () => {
    const red = await errors(
      `import postgres from "postgres";
export const probe = postgres;
`,
      "app/api/transfers/route.ts",
    );
    expect(red.join("\n")).toContain("getLedgerRepository()");

    const green = await errors(
      `import postgres from "postgres";
export const probe = postgres;
`,
      "lib/server/ledger-repository.ts",
    );
    expect(green.filter((message) => message.includes("Postgres"))).toEqual([]);
  });
});
