export const DEMO_SCENARIO_COOKIE = "marsbank-demo-scenario";

export const demoScenarioIds = [
  "hooks",
  "debug-mode",
  "agent-lint",
  "agent-verify",
  "agent-route",
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

export function isAgentFriendlyScenario(
  id: DemoScenarioId | null,
): id is "agent-lint" | "agent-verify" | "agent-route" {
  return id === "agent-lint" || id === "agent-verify" || id === "agent-route";
}

export const agentFriendlyScenarios: readonly DemoScenario[] = [
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
];

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
