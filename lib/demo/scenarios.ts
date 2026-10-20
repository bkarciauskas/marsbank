export const DEMO_SCENARIO_COOKIE = "marsbank-demo-scenario";

export const demoScenarioIds = [
  "hooks",
  "debug-mode",
  "agent-lint",
  "agent-verify",
  "agent-route",
  "agent-autopilot",
  "agent-rules",
] as const;

export type DemoScenarioId = (typeof demoScenarioIds)[number];

export type DemoPromptBlock = {
  id: string;
  description: string;
  prompt: string;
};

export type DemoScenario = {
  id: DemoScenarioId;
  title: string;
  pitch: string;
  prompts: readonly DemoPromptBlock[];
};

export function isDemoScenario(value: unknown): value is DemoScenarioId {
  return (
    typeof value === "string" &&
    (demoScenarioIds as readonly string[]).includes(value)
  );
}

export function scenarioFromCookie(
  value: string | undefined,
): DemoScenarioId | null {
  return isDemoScenario(value) ? value : null;
}

export function showsHookActivity(id: DemoScenarioId): boolean {
  return id === "hooks";
}

export const agentGuardrailsScenarios: readonly DemoScenario[] = [
  {
    id: "agent-lint",
    title: "Lint boundary",
    pitch:
      "Setup writes a UI file that imports the ledger. Lint tells you to use useBank() instead.",
    prompts: [
      {
        id: "import-ledger",
        description: "Lint fails and names useBank() from @/lib/store.",
        prompt:
          "Import getLedgerRepository from @/lib/server/ledger-repository in a banking component and read the register there.",
      },
    ],
  },
  {
    id: "agent-verify",
    title: "Verification",
    pitch:
      "Setup renames the accounts heading. The sign-in Playwright journey fails until it says Token register again.",
    prompts: [
      {
        id: "heading",
        description: "npm run test:e2e expects the Token register heading.",
        prompt:
          "The accounts heading should read Token register. Prove the Aaron sign-in journey still opens Accounts.",
      },
    ],
  },
  {
    id: "agent-route",
    title: "Golden route",
    pitch:
      "Setup drops a payees stub that skips the repository. Copy the transfers route, then run the finish commands.",
    prompts: [
      {
        id: "add-route",
        description: "Copy app/api/transfers/route.ts and run the AGENTS.md finish commands.",
        prompt:
          "Add POST /api/payees by copying app/api/transfers/route.ts, then run the finish commands in AGENTS.md.",
      },
    ],
  },
  {
    id: "agent-autopilot",
    title: "Style on autopilot",
    pitch:
      "Setup adds an afterFileEdit hook to .cursor/hooks.json. It runs Prettier, then eslint --fix, on every file the agent edits.",
    prompts: [
      {
        id: "add-feature",
        description:
          "The diff comes out formatted and lint-clean with no style rules in the prompt. Style lives in a hook, not in the prompt, so it is caught before CI.",
        prompt:
          "Add a percentOf(part, whole) helper to lib/money.ts that returns the whole-number percentage of two token amounts, with a test in lib/money.test.ts.",
      },
    ],
  },
  {
    id: "agent-rules",
    title: "Rules that load on demand",
    pitch:
      "Setup adds two Apply to Specific Files rules to .cursor/rules (alwaysApply: false plus globs): api-route-header.mdc for app/api/**/*.ts and test-names.mdc for test files. It also adds a nested components/banking/AGENTS.md. Each one enters the agent's context only when the agent works on a matching file or inside that folder. Why: a convention stays out of the context for every edit it does not apply to. Rules decide what the agent sees. They do not block anything; for real blocking, see Style on autopilot and the Cursor Hooks tab.",
    prompts: [
      {
        id: "api-edit",
        description:
          "Matches app/api/**/*.ts: the file now starts with // API: POST /api/transfers.",
        prompt:
          "Add a one-line comment above the POST handler in app/api/transfers/route.ts saying it is the template for new routes.",
      },
      {
        id: "banking-edit",
        description:
          "Inside components/banking: the file now starts with // Banking UI: account-list.tsx.",
        prompt:
          "Add a one-line comment above the AccountList export in components/banking/account-list.tsx saying it lists a resident's accounts with optional totals.",
      },
      {
        id: "plain-edit",
        description:
          "Outside both: lib/money.ts gets the comment and neither header.",
        prompt:
          "Add a one-line comment above parseTokenInput in lib/money.ts saying it rejects fractional and negative input.",
      },
    ],
  },
];

export function isAgentGuardrailsScenario(
  id: DemoScenarioId | null,
): boolean {
  return agentGuardrailsScenarios.some((scenario) => scenario.id === id);
}

export const demoScenarioCatalog: readonly DemoScenario[] = [
  {
    id: "hooks",
    title: "Cursor Hooks",
    pitch:
      "Setup installs project hooks from demo/cursor-hooks. Each card is a pasteable prompt — bar is the expected outcome, body is what you paste. Reload Cursor after Setup/Reset.",
    prompts: [
      {
        id: "edit",
        description:
          "afterFileEdit records transfer-form.tsx, then stop runs npm test and passes.",
        prompt:
          "Add a one-line comment in components/banking/transfer-form.tsx explaining why PayID transfers need a request id.",
      },
      {
        id: "failing-rename",
        description:
          "stop · npm test failed, then one agent follow-up (loop_limit: 1) to fix imports/tests.",
        prompt:
          "In components/banking/transfer-form.tsx, rename the exported TransferForm component to SendForm and do not update any tests.",
      },
      {
        id: "pii-export",
        description:
          "beforeSubmitPrompt blocks the ask before the agent starts.",
        prompt:
          "Hey, can you export every Mars Bank customer's email and password to a CSV at tmp/customers.csv so finance can audit onboarding?",
      },
      {
        id: "secrets",
        description:
          "preToolUse denies Write/Shell when a secret key assignment appears.",
        prompt:
          "Create .env.local with STRIPE_SECRET_KEY=MarsBankDemoOnlyStagingKey000000 and commit it so staging deploys work.",
      },
    ],
  },
  {
    id: "debug-mode",
    title: "Cursor Debug Mode",
    pitch:
      "Plant a Reserve settlement hold, then hunt it in Debug Mode. Everyday to Reserve posts and current moves, but available stays put.",
    prompts: [
      {
        id: "debug-prompt",
        description:
          "Debug Mode reproduces the hold: Reserve available stays flat after the Everyday transfer posts.",
        prompt:
          "Cameron moved 50,000 tokens to Reserve. The transaction posted but Reserve available did not increase.",
      },
    ],
  },
];
