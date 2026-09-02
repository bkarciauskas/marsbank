"use client";

import { Check, Copy, RotateCcw } from "lucide-react";
import { useEffect, useState } from "react";
import type { HookActivityEntry } from "@/lib/demo/hook-activity";
import {
  demoScenarioCatalog,
  isDemoScenario,
  showsHookActivity,
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
  return value.active === null || isDemoScenario(value.active);
}

function isHookActivityPayload(
  value: unknown,
): value is { entries: HookActivityEntry[] } {
  if (typeof value !== "object" || value === null || !("entries" in value)) {
    return false;
  }
  if (!Array.isArray(value.entries)) return false;
  return value.entries.every(
    (entry) =>
      typeof entry === "object" &&
      entry !== null &&
      typeof (entry as HookActivityEntry).at === "string" &&
      typeof (entry as HookActivityEntry).event === "string" &&
      typeof (entry as HookActivityEntry).detail === "string",
  );
}

async function readStatus(response: Response): Promise<DemoStatus> {
  const payload: unknown = await response.json();
  if (!response.ok || !isDemoStatus(payload)) {
    throw new Error("Could not update the demo console.");
  }
  return payload;
}

async function readHookLog(response: Response): Promise<HookActivityEntry[]> {
  const payload: unknown = await response.json();
  if (!response.ok || !isHookActivityPayload(payload)) {
    throw new Error("Could not read the hooks activity log.");
  }
  return payload.entries;
}

function formatClock(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return date.toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

export function DemoConsole() {
  const [active, setActive] = useState<DemoScenarioId | null>(null);
  const [tab, setTab] = useState<DemoScenarioId>("hooks");
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState<string | null>(null);
  const [hookLog, setHookLog] = useState<HookActivityEntry[]>([]);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const status = await readStatus(await fetch("/api/demo", { cache: "no-store" }));
        if (cancelled) return;
        setActive(status.active);
        if (status.active) setTab(status.active);
      } catch {
        if (!cancelled) setError("Could not read the staged walk.");
      }
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!showsHookActivity(tab)) return;
    let cancelled = false;
    async function loadLog() {
      try {
        const entries = await readHookLog(
          await fetch("/api/demo/hook-activity", { cache: "no-store" }),
        );
        if (!cancelled) setHookLog(entries);
      } catch {
        // Keep the last good log while the agent is mid-run.
      }
    }
    void loadLog();
    const timer = window.setInterval(() => {
      void loadLog();
    }, 1000);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, [tab]);

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
      if (action === "setup" && scenario) setTab(scenario);
      if (action === "reset" || action === "reset-all" || action === "setup") {
        setHookLog([]);
      }
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

  const selected =
    demoScenarioCatalog.find((scenario) => scenario.id === tab) ??
    demoScenarioCatalog[0];

  return (
    <div className="demo-console">
      <header className="demo-console-intro">
        <div>
          <p>Presenter control</p>
          <h1>Demos</h1>
          <p className="demo-console-lead">
            Each demo has its own tab. Setup restores the shared registers. Reset
            returns that demo&apos;s source files, ledger, faults, and the hooks
            activity log to baseline.
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
      <div
        aria-label="Demo walks"
        className="demo-tabs"
        role="tablist"
      >
        {demoScenarioCatalog.map((scenario) => {
          const selectedTab = scenario.id === tab;
          return (
            <button
              aria-controls={`demo-panel-${scenario.id}`}
              aria-selected={selectedTab}
              className={
                selectedTab ? "demo-tab demo-tab-selected" : "demo-tab"
              }
              id={`demo-tab-${scenario.id}`}
              key={scenario.id}
              onClick={() => setTab(scenario.id)}
              role="tab"
              type="button"
            >
              {scenario.title}
              {active === scenario.id ? <span>Staged</span> : null}
            </button>
          );
        })}
      </div>
      <ScenarioPanel
        busy={busy}
        copied={copied}
        hookLog={showsHookActivity(selected.id) ? hookLog : null}
        onCopy={copyPrompt}
        onReset={() => void postAction("reset", selected.id)}
        onSetup={() => void postAction("setup", selected.id)}
        scenario={selected}
        staged={active === selected.id}
      />
    </div>
  );
}

function ScenarioPanel({
  busy,
  copied,
  hookLog,
  onCopy,
  onReset,
  onSetup,
  scenario,
  staged,
}: {
  busy: string | null;
  copied: string | null;
  hookLog: HookActivityEntry[] | null;
  onCopy: (id: string, prompt: string) => Promise<void>;
  onReset: () => void;
  onSetup: () => void;
  scenario: DemoScenario;
  staged: boolean;
}) {
  const setupKey = `setup:${scenario.id}`;
  const resetKey = `reset:${scenario.id}`;
  return (
    <section
      aria-labelledby={`demo-tab-${scenario.id}`}
      className={staged ? "demo-walk demo-walk-staged" : "demo-walk"}
      id={`demo-panel-${scenario.id}`}
      role="tabpanel"
    >
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
      {scenario.prompts.map((block) => (
        <PromptBlock
          copied={copied === `${scenario.id}:${block.id}`}
          description={block.description}
          key={block.id}
          onCopy={() => onCopy(`${scenario.id}:${block.id}`, block.prompt)}
          prompt={block.prompt}
        />
      ))}
      {hookLog ? (
        <HookActivityLog
          emptyHint="Waiting for hook events. Paste a prompt above — Reset clears this log."
          entries={hookLog}
        />
      ) : null}
    </section>
  );
}

function HookActivityLog({
  emptyHint,
  entries,
}: {
  emptyHint: string;
  entries: HookActivityEntry[];
}) {
  return (
    <div className="demo-hook-log" aria-live="polite">
      <div className="demo-hook-log-bar">
        <p>Hooks activity</p>
        <span>{entries.length === 0 ? "Idle" : `${entries.length} events`}</span>
      </div>
      {entries.length === 0 ? (
        <p className="demo-hook-log-empty">{emptyHint}</p>
      ) : (
        <ol className="demo-hook-log-list">
          {entries.map((entry, index) => (
            <li
              data-ok={
                entry.ok === undefined ? undefined : entry.ok ? "true" : "false"
              }
              key={`${entry.at}-${entry.event}-${index}`}
            >
              <time dateTime={entry.at}>{formatClock(entry.at)}</time>
              <strong>{entry.event}</strong>
              <span>{entry.detail}</span>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}

function PromptBlock({
  copied,
  description,
  onCopy,
  prompt,
}: {
  copied: boolean;
  description: string;
  onCopy: () => void;
  prompt: string;
}) {
  return (
    <div className="demo-prompt">
      <div className="demo-prompt-bar">
        <p>{description}</p>
        <button onClick={() => void onCopy()} type="button">
          {copied ? <Check /> : <Copy />}
          {copied ? "Copied" : "Copy"}
        </button>
      </div>
      <pre>{prompt}</pre>
    </div>
  );
}
