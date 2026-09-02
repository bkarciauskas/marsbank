export const DEMO_SCENARIO_COOKIE = "marsbank-demo-scenario";

export const demoScenarioIds = ["hooks", "debug-mode"] as const;

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

export const demoScenarioCatalog: readonly DemoScenario[] = [
  {
    id: "hooks",
    title: "Cursor Hooks",
    pitch:
      "Each card is a pasteable prompt. The bar is what you should see; the text underneath is what you paste into Cursor.",
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
