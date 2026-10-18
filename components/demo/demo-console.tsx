"use client";

import { Check, Copy, RotateCcw } from "lucide-react";
import { useEffect, useState } from "react";
import type { HookActivityEntry } from "@/lib/demo/hook-activity";
import {
  agentFriendlyScenarios,
  demoScenarioCatalog,
  isAgentFriendlyScenario,
  isDemoScenario,
  showsHookActivity,
  type DemoScenario,
  type DemoScenarioId,
} from "@/lib/demo/scenarios";
import "./demo-console.css";

function scenarioForTab(tab: DemoScenarioId): DemoScenario {
  const match = demoScenarioCatalog.find((scenario) => scenario.id === tab);
  if (match) return match;
  const fallback = demoScenarioCatalog[0];
  if (!fallback) {
    throw new Error("Demo catalog is empty.");
  }
  return fallback;
}

type DemoGuardrail = {
  scenario: DemoScenarioId;
  output: string;
};

type DemoStatus = {
  active: DemoScenarioId | null;
  hooksInstalled: boolean;
  guardrail?: DemoGuardrail | null;
};

type ConsoleTab = "hooks" | "debug-mode" | "agent-friendly";

function consoleTab(active: DemoScenarioId | null): ConsoleTab {
  if (isAgentFriendlyScenario(active)) return "agent-friendly";
  if (active === "debug-mode") return "debug-mode";
  return "hooks";
}

function isDemoStatus(value: unknown): value is DemoStatus {
  if (
    typeof value !== "object" ||
    value === null ||
    !("active" in value) ||
    !("hooksInstalled" in value)
  ) {
    return false;
  }
  const activeOk =
    value.active === null || isDemoScenario(value.active);
  if (!activeOk || typeof value.hooksInstalled !== "boolean") return false;
  if (!("guardrail" in value) || value.guardrail === null) return true;
  return (
    typeof value.guardrail === "object" &&
    value.guardrail !== null &&
    "scenario" in value.guardrail &&
    "output" in value.guardrail &&
    isDemoScenario(value.guardrail.scenario) &&
    typeof value.guardrail.output === "string"
  );
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
  const [hooksInstalled, setHooksInstalled] = useState(false);
  const [tab, setTab] = useState<ConsoleTab>("hooks");
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState<string | null>(null);
  const [hookLog, setHookLog] = useState<HookActivityEntry[]>([]);
  const [guardrails, setGuardrails] = useState<
    Partial<Record<DemoScenarioId, string>>
  >({});

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const status = await readStatus(await fetch("/api/demo", { cache: "no-store" }));
        if (cancelled) return;
        setActive(status.active);
        setHooksInstalled(status.hooksInstalled);
        if (status.active) setTab(consoleTab(status.active));
        if (status.guardrail) {
          setGuardrails({ [status.guardrail.scenario]: status.guardrail.output });
        }
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
    if (tab !== "hooks") return;
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
      setHooksInstalled(status.hooksInstalled);
      if (action === "setup" && scenario) setTab(consoleTab(scenario));
      const guardrail = status.guardrail;
      if (guardrail) {
        setGuardrails((current) => ({
          ...current,
          [guardrail.scenario]: guardrail.output,
        }));
      }
      if (action === "reset" && scenario) {
        setGuardrails((current) => {
          const next = { ...current };
          delete next[scenario];
          return next;
        });
      }
      if (action === "reset-all") setGuardrails({});
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

  const selected = tab === "agent-friendly" ? null : scenarioForTab(tab);

  return (
    <div className="demo-console">
      <header className="demo-console-intro">
        <div>
          <p>Presenter control</p>
          <h1>Demos</h1>
          <p className="demo-console-lead">
            Each demo has its own tab. On Hooks, Setup copies the kit from{" "}
            <code>demo/cursor-hooks</code> into <code>.cursor</code>; Reset
            removes those installed files. Reload Cursor after Setup or Reset so
            hook changes take effect. Agent-friendly Setup plants a lint break, a
            heading change, or a stub route, and Reset removes that plant. Reset
            also restores transfer-form sources, the ledger, and the activity log.
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
              onClick={() => {
                if (scenario.id === "hooks" || scenario.id === "debug-mode") {
                  setTab(scenario.id);
                }
              }}
              role="tab"
              type="button"
            >
              {scenario.title}
              {active === scenario.id ? <span>Staged</span> : null}
            </button>
          );
        })}
        <button
          aria-controls="demo-panel-agent-friendly"
          aria-selected={tab === "agent-friendly"}
          className={
            tab === "agent-friendly" ? "demo-tab demo-tab-selected" : "demo-tab"
          }
          id="demo-tab-agent-friendly"
          onClick={() => setTab("agent-friendly")}
          role="tab"
          type="button"
        >
          Agent-friendly
          {isAgentFriendlyScenario(active) ? <span>Staged</span> : null}
        </button>
      </div>
      {tab === "agent-friendly" ? (
        <div
          className="demo-agent-stack"
          id="demo-panel-agent-friendly"
          role="tabpanel"
        >
          {agentFriendlyScenarios.map((scenario) => (
            <ScenarioPanel
              asTabPanel={false}
              busy={busy}
              copied={copied}
              guardrail={guardrails[scenario.id] ?? null}
              hookLog={null}
              hooksInstalled={hooksInstalled}
              key={scenario.id}
              onCopy={copyPrompt}
              onReset={() => void postAction("reset", scenario.id)}
              onSetup={() => void postAction("setup", scenario.id)}
              scenario={scenario}
              staged={active === scenario.id}
            />
          ))}
        </div>
      ) : selected ? (
        <ScenarioPanel
          busy={busy}
          copied={copied}
          guardrail={guardrails[selected.id] ?? null}
          hookLog={showsHookActivity(selected.id) ? hookLog : null}
          hooksInstalled={hooksInstalled}
          onCopy={copyPrompt}
          onReset={() => void postAction("reset", selected.id)}
          onSetup={() => void postAction("setup", selected.id)}
          scenario={selected}
          staged={active === selected.id}
        />
      ) : null}
    </div>
  );
}

function ScenarioPanel({
  asTabPanel = true,
  busy,
  copied,
  guardrail,
  hookLog,
  hooksInstalled,
  onCopy,
  onReset,
  onSetup,
  scenario,
  staged,
}: {
  asTabPanel?: boolean;
  busy: string | null;
  copied: string | null;
  guardrail: string | null;
  hookLog: HookActivityEntry[] | null;
  hooksInstalled: boolean;
  onCopy: (id: string, prompt: string) => Promise<void>;
  onReset: () => void;
  onSetup: () => void;
  scenario: DemoScenario;
  staged: boolean;
}) {
  const setupKey = `setup:${scenario.id}`;
  const resetKey = `reset:${scenario.id}`;
  const statusLabel =
    scenario.id === "hooks"
      ? hooksInstalled
        ? staged
          ? "Staged · hooks installed"
          : "Hooks installed"
        : staged
          ? "Staged · hooks not installed"
          : "Idle"
      : staged
        ? "Staged"
        : "Idle";
  return (
    <section
      aria-labelledby={
        asTabPanel ? `demo-tab-${scenario.id}` : `demo-tab-agent-friendly`
      }
      className={staged ? "demo-walk demo-walk-staged" : "demo-walk"}
      data-scenario={scenario.id}
      id={`demo-panel-${scenario.id}`}
      role={asTabPanel ? "tabpanel" : undefined}
    >
      <div className="demo-walk-heading">
        <div>
          <h2>{scenario.title}</h2>
          <p>{scenario.pitch}</p>
        </div>
        <p className="demo-walk-status" data-staged={staged ? "true" : "false"}>
          {statusLabel}
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
      {scenario.id === "hooks" ? (
        <p className="demo-hook-reload-hint">
          After Setup or Reset, reload the Cursor window so{" "}
          <code>.cursor/hooks.json</code> is picked up.
        </p>
      ) : null}
      {scenario.prompts.map((block) => (
        <PromptBlock
          copied={copied === `${scenario.id}:${block.id}`}
          description={block.description}
          key={block.id}
          onCopy={() => onCopy(`${scenario.id}:${block.id}`, block.prompt)}
          prompt={block.prompt}
        />
      ))}
      {guardrail ? (
        <div className="demo-guardrail-block">
          <p className="demo-guardrail-label">Guardrail</p>
          <pre className="demo-guardrail">{guardrail}</pre>
        </div>
      ) : null}
      {hookLog ? (
        <HookActivityLog
          emptyHint={
            hooksInstalled
              ? "Waiting for hook events. Paste a prompt above — Reset clears this log and uninstalls hooks."
              : "Setup installs hooks from demo/cursor-hooks into .cursor, then reload Cursor."
          }
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
