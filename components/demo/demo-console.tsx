"use client";

import { Check, Copy, RotateCcw } from "lucide-react";
import { useEffect, useState } from "react";
import {
  demoScenarioCatalog,
  type DemoScenario,
  type DemoScenarioId,
} from "@/lib/demo/scenarios";
import "./demo-console.css";

type DemoStatus = {
  active: DemoScenarioId | null;
};

function isDemoStatus(value: unknown): value is DemoStatus {
  if (typeof value !== "object" || value === null || !("active" in value)) {
    return false;
  }
  return value.active === null || value.active === "hooks" || value.active === "debug-mode";
}

async function readStatus(response: Response): Promise<DemoStatus> {
  const payload: unknown = await response.json();
  if (!response.ok || !isDemoStatus(payload)) {
    throw new Error("Could not update the demo console.");
  }
  return payload;
}

export function DemoConsole() {
  const [active, setActive] = useState<DemoScenarioId | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const status = await readStatus(await fetch("/api/demo", { cache: "no-store" }));
        if (!cancelled) setActive(status.active);
      } catch {
        if (!cancelled) setError("Could not read the staged walk.");
      }
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, []);

  async function postAction(
    action: "setup" | "reset" | "reset-all",
    scenario?: DemoScenarioId,
  ) {
    const key = action === "reset-all" ? "reset-all" : `${action}:${scenario}`;
    setBusy(key);
    setError(null);
    try {
      const status = await readStatus(
        await fetch("/api/demo", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(
            action === "reset-all" ? { action } : { action, scenario },
          ),
        }),
      );
      setActive(status.active);
    } catch {
      setError("Could not update the demo console.");
    } finally {
      setBusy(null);
    }
  }

  async function copyPrompt(id: string, prompt: string) {
    await navigator.clipboard.writeText(prompt);
    setCopied(id);
    window.setTimeout(() => {
      setCopied((current) => (current === id ? null : current));
    }, 1600);
  }

  return (
    <div className="demo-console">
      <header className="demo-console-intro">
        <div>
          <p>Presenter control</p>
          <h1>Cursor walks</h1>
          <p className="demo-console-lead">
            Stage and reset the first two Cursor product walks against this bank.
            Setup restores the shared registers. Reset returns hooks, ledger, and
            faults to baseline.
          </p>
        </div>
        <button
          className="demo-quiet-action"
          disabled={busy !== null}
          onClick={() => void postAction("reset-all")}
          type="button"
        >
          <RotateCcw />
          {busy === "reset-all" ? "Resetting" : "Reset all"}
        </button>
      </header>
      {error ? <p className="demo-console-error">{error}</p> : null}
      <div className="demo-console-grid">
        {demoScenarioCatalog.map((scenario) => (
          <ScenarioCard
            busy={busy}
            copied={copied}
            key={scenario.id}
            onCopy={copyPrompt}
            onReset={() => void postAction("reset", scenario.id)}
            onSetup={() => void postAction("setup", scenario.id)}
            scenario={scenario}
            staged={active === scenario.id}
          />
        ))}
      </div>
    </div>
  );
}

function ScenarioCard({
  busy,
  copied,
  onCopy,
  onReset,
  onSetup,
  scenario,
  staged,
}: {
  busy: string | null;
  copied: string | null;
  onCopy: (id: string, prompt: string) => Promise<void>;
  onReset: () => void;
  onSetup: () => void;
  scenario: DemoScenario;
  staged: boolean;
}) {
  const setupKey = `setup:${scenario.id}`;
  const resetKey = `reset:${scenario.id}`;
  return (
    <article className={staged ? "demo-walk demo-walk-staged" : "demo-walk"}>
      <div className="demo-walk-heading">
        <div>
          <h2>{scenario.title}</h2>
          <p>{scenario.pitch}</p>
        </div>
        <p className="demo-walk-status" data-staged={staged ? "true" : "false"}>
          {staged ? "Staged" : "Idle"}
        </p>
      </div>
      <div className="demo-walk-actions">
        <button
          className="demo-primary-action"
          disabled={busy !== null}
          onClick={onSetup}
          type="button"
        >
          {busy === setupKey ? "Setting up" : "Setup"}
        </button>
        <button
          className="demo-quiet-action"
          disabled={busy !== null}
          onClick={onReset}
          type="button"
        >
          <RotateCcw />
          {busy === resetKey ? "Resetting" : "Reset"}
        </button>
      </div>
      <ol className="demo-walk-script">
        {scenario.script.map((step) => (
          <li key={step}>{step}</li>
        ))}
      </ol>
      <PromptBlock
        copied={copied === `${scenario.id}:prompt`}
        label="Paste into Cursor"
        onCopy={() => onCopy(`${scenario.id}:prompt`, scenario.prompt)}
        prompt={scenario.prompt}
      />
      {scenario.optionalPrompt ? (
        <PromptBlock
          copied={copied === `${scenario.id}:optional`}
          label="Optional failing prompt"
          onCopy={() => onCopy(`${scenario.id}:optional`, scenario.optionalPrompt ?? "")}
          prompt={scenario.optionalPrompt}
        />
      ) : null}
    </article>
  );
}

function PromptBlock({
  copied,
  label,
  onCopy,
  prompt,
}: {
  copied: boolean;
  label: string;
  onCopy: () => void;
  prompt: string;
}) {
  return (
    <div className="demo-prompt">
      <div className="demo-prompt-bar">
        <p>{label}</p>
        <button onClick={() => void onCopy()} type="button">
          {copied ? <Check /> : <Copy />}
          {copied ? "Copied" : "Copy"}
        </button>
      </div>
      <pre>{prompt}</pre>
    </div>
  );
}
