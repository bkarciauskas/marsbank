import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { healthyDebit, plantedDebit } from "../../../demo-pstack/scripts/plant.mjs";

const here = dirname(fileURLToPath(import.meta.url));
const local = (name) => readFileSync(join(here, name), "utf8");

const scenario = {
  id: "offset-hold",
  question:
    "Does a repo AGENTS.md rule pointing at the tdd skill make agents prove an offset-debit bug with a failing regression test before they edit the ledger?",
  repoName: "marsbank",
  target: "lib/ledger.ts",
  exclude: [
    ".cursor/skills/demo-",
    ".cursor/skills/skill-eval/",
    "fix-prompt.md",
  ],
  edits: [
    { file: "lib/ledger.ts", find: healthyDebit, replace: plantedDebit },
    {
      file: "lib/ledger.test.ts",
      find: `    const everyday = result.snapshot.accounts.find(
      (account) => account.id === "acc-everyday",
    );
    const reserve = `,
      replace: "    const reserve = ",
    },
    {
      file: "lib/ledger.test.ts",
      find: "    expect(everyday && availableBalance(everyday)).toBe(1_000_174_220);\n",
      replace: "",
    },
    {
      file: "lib/ledger.test.ts",
      find: `    const everyday = result.snapshot.accounts.find(
      (account) => account.id === "acc-everyday",
    );
    expect(everyday && availableBalance(everyday)).toBe(1_000_181_720);
`,
      replace: "",
    },
    {
      file: "lib/shared-ledger.test.ts",
      find: `    const senderSol = result.sender.accounts.find(
      (account) => account.id === "acc-everyday",
    );
`,
      replace: "",
    },
    {
      file: "lib/shared-ledger.test.ts",
      find: "    expect(senderSol && availableBalance(senderSol)).toBe(1_000_174_220);\n",
      replace: "",
    },
    {
      file: "lib/server/ledger-repository.test.ts",
      find: `  it("serializes concurrent transfers against the latest balance", async () => {
    const repository = createMemoryLedgerRepository();
    const results = await Promise.all([
      repository.transfer(
        "aaron",
        "concurrent-request-1",
        sendToBen(600_000_000),
      ),
      repository.transfer(
        "aaron",
        "concurrent-request-2",
        sendToBen(600_000_000),
      ),
    ]);

    expect(results.filter((result) => result.kind === "ok")).toHaveLength(1);
    expect(
      results.filter((result) => result.kind === "insufficient-funds"),
    ).toHaveLength(1);
  });

`,
      replace: "",
    },
    {
      file: "app/banking/settings/page.test.tsx",
      find: `{everyday && "available" in everyday ? everyday.available : "missing"}`,
      replace: `{everyday && "current" in everyday ? everyday.current : "missing"}`,
    },
  ],
  leaks: [
    "1_000_174_220",
    "1_000_181_720",
    "plantedDebit",
    "offset-available",
    "demo-break",
    "demo-fix",
  ],
  holdout: local("holdout.test.tpl"),
  prompt: local("prompt.md"),
  variants: {
    baseline: {},
    guided: {
      append: { "AGENTS.md": local("variants/guided/AGENTS.append.md") },
      write: { ".cursor/skills/tdd/SKILL.md": local("variants/guided/tdd.SKILL.md") },
    },
  },
};

export default scenario;
