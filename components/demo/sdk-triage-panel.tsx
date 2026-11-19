import { Check, Copy } from "lucide-react";
import {
  bugTriagePrompts,
  SUPPORT_CHANNEL,
  triagePromptKindLabel,
  triagePromptTriggerLabel,
  type TriagePrompt,
} from "@/lib/demo/bug-triage-prompts";

export function SdkTriagePanel({
  copied,
  onCopy,
}: {
  copied: string | null;
  onCopy: (id: string, prompt: string) => Promise<void>;
}) {
  return (
    <section
      aria-labelledby="demo-tab-agent-sdk"
      className="demo-walk"
      id="demo-panel-agent-sdk"
      role="tabpanel"
    >
      <div className="demo-walk-heading">
        <div>
          <h2>Slack bug triage</h2>
          <p>
            The Agent SDK triage bot watches {SUPPORT_CHANNEL}. It checks MARS
            Jira and GitHub for a match, reproduces anything new against main,
            files a Jira Bug, and sends a Cloud Agent to open the fix PR.
          </p>
        </div>
      </div>
      <section
        aria-labelledby="triage-prompts-heading"
        className="demo-triage"
      >
        <div className="demo-triage-heading">
          <h3 id="triage-prompts-heading">Customer Bug Triage Prompts</h3>
          <p>
            Paste each one into {SUPPORT_CHANNEL} as a resident would. Two match
            bugs already in Jira. Two are unfiled.
          </p>
        </div>
        <ol className="demo-triage-list">
          {bugTriagePrompts.map((prompt) => (
            <TriagePromptCard
              copied={copied === `agent-sdk:${prompt.id}`}
              key={prompt.id}
              onCopy={() => onCopy(`agent-sdk:${prompt.id}`, prompt.prompt)}
              prompt={prompt}
            />
          ))}
        </ol>
      </section>
    </section>
  );
}

function TriagePromptCard({
  copied,
  onCopy,
  prompt,
}: {
  copied: boolean;
  onCopy: () => Promise<void>;
  prompt: TriagePrompt;
}) {
  const headingId = `triage-prompt-${prompt.id}`;
  return (
    <li
      aria-labelledby={headingId}
      className="demo-triage-card"
      data-kind={prompt.kind}
    >
      <div className="demo-triage-tags">
        <span className="demo-triage-kind">
          {triagePromptKindLabel[prompt.kind]}
        </span>
        <span className="demo-triage-trigger">
          {triagePromptTriggerLabel[prompt.trigger]}
        </span>
      </div>
      <div className="demo-prompt">
        <div className="demo-prompt-bar">
          <h4 id={headingId}>{prompt.title}</h4>
          <button onClick={() => void onCopy()} type="button">
            {copied ? <Check /> : <Copy />}
            {copied ? "Copied" : "Copy"}{" "}
            <span className="sr-only">prompt: {prompt.title}</span>
          </button>
        </div>
        <pre>{prompt.prompt}</pre>
      </div>
      <dl className="demo-triage-notes">
        <div>
          <dt>What happens</dt>
          <dd>{prompt.whatHappens}</dd>
        </div>
        <div>
          <dt>See it in Mars Bank</dt>
          <dd>{prompt.seeIt}</dd>
        </div>
      </dl>
    </li>
  );
}
