export const DEMO_SCENARIO_COOKIE = "marsbank-demo-scenario";

export const demoScenarioIds = ["hooks", "debug-mode"] as const;

export type DemoScenarioId = (typeof demoScenarioIds)[number];

export type DemoScenario = {
  id: DemoScenarioId;
  title: string;
  pitch: string;
  script: string[];
  prompt: string;
  optionalPrompt?: string;
};

export function isDemoScenario(value: unknown): value is DemoScenarioId {
  return value === "hooks" || value === "debug-mode";
}

export function scenarioFromCookie(
  value: string | undefined,
): DemoScenarioId | null {
  return isDemoScenario(value) ? value : null;
}

export const demoScenarioCatalog: readonly DemoScenario[] = [
  {
    id: "hooks",
    title: "Cursor Hooks",
    pitch:
      "Show project hooks firing on a real agent edit. afterFileEdit stamps the change; stop runs npm test and can send the agent back once if tests fail.",
    script: [
      "Open .cursor/hooks.json and .cursor/hooks/run-tests.mjs.",
      "Paste the prompt so the agent edits components/banking/transfer-form.tsx.",
      "Watch Hooks output: afterFileEdit records the file, then stop runs npm test.",
      "Optional: use the failing prompt so the loop_limit follow-up is visible.",
    ],
    prompt:
      "Add a one-line comment in components/banking/transfer-form.tsx explaining why PayID transfers need a request id.",
    optionalPrompt:
      "In components/banking/transfer-form.tsx, rename the exported TransferForm component to SendForm and do not update any tests.",
  },
  {
    id: "debug-mode",
    title: "Cursor Debug Mode",
    pitch:
      "Plant a Reserve settlement hold, then hunt it in Debug Mode. Everyday to Reserve posts and current moves, but available stays put.",
    script: [
      "Sign in as Cameron and open Send.",
      "Move 50,000 tokens from Everyday (Sol Account) to Long Horizon Reserve.",
      "Show Reserve available unchanged while the movement posted.",
      "Switch Cursor to Debug Mode.",
      "Paste the prompt and let Debug Mode reproduce the hold.",
    ],
    prompt:
      "Cameron moved 50,000 tokens to Reserve. The transaction posted but Reserve available did not increase.",
  },
];
