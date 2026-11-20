"use client";

import { type FormEvent, useState } from "react";
import type {
  LoanAccount,
  OpenAccountCommand,
  OpenAccountFailure,
} from "@/lib/domain";
import { accountId, type AccountId } from "@/lib/ids";
import { ACCOUNT_NAME_LIMIT } from "@/lib/ledger";
import { parseTokenInput } from "@/lib/money";
import { useBank } from "@/lib/store";

const openAccountMessages: Record<OpenAccountFailure["kind"], string> = {
  "name-empty": "Name the account.",
  "name-too-long": `Keep the name to ${ACCOUNT_NAME_LIMIT} characters or fewer.`,
  "goal-not-positive": "Set a goal of at least one token.",
  "unknown-loan": "Link the offset to one of your habitat loans.",
  network: "The shared register could not be reached. Try opening it again.",
};

export function OpenAccountForm() {
  const { snapshot, openAccount } = useBank();
  const loans = snapshot.accounts.filter(
    (account): account is LoanAccount => account.kind === "loan",
  );
  const [kind, setKind] = useState<OpenAccountCommand["kind"]>("savings");
  const [name, setName] = useState("");
  const [goalInput, setGoalInput] = useState("");
  const [loanChoice, setLoanChoice] = useState<AccountId>();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [opened, setOpened] = useState<string | null>(null);
  const linkedLoanId = loanChoice ?? loans[0]?.id;

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setOpened(null);
    const goal = parseTokenInput(goalInput);
    if (goal === null) {
      setError("Enter a whole-token goal.");
      return;
    }
    const command: OpenAccountCommand | null =
      kind === "savings"
        ? { kind, name, goal }
        : linkedLoanId
          ? { kind, name, goal, linkedLoanId }
          : null;
    if (!command) {
      setError(openAccountMessages["unknown-loan"]);
      return;
    }

    setError(null);
    setPending(true);
    const result = await openAccount(command);
    setPending(false);
    if (result.kind !== "ok") {
      setError(openAccountMessages[result.kind]);
      return;
    }
    setOpened(name.trim());
    setName("");
    setGoalInput("");
  }

  return (
    <form className="desk-open-account" onSubmit={submit}>
      <fieldset>
        <legend>Account type</legend>
        <label>
          <input
            checked={kind === "savings"}
            name="open-account-kind"
            onChange={() => setKind("savings")}
            type="radio"
          />
          Savings vault
        </label>
        <label>
          <input
            checked={kind === "offset"}
            name="open-account-kind"
            onChange={() => setKind("offset")}
            type="radio"
          />
          Linked offset
        </label>
      </fieldset>
      <div className="desk-planner-fields">
        <div className="desk-planner-field">
          <label htmlFor="open-account-name">Account name</label>
          <input
            autoComplete="off"
            id="open-account-name"
            maxLength={ACCOUNT_NAME_LIMIT}
            onChange={(event) => setName(event.target.value)}
            placeholder="Launch Window Cargo Reserve"
            value={name}
          />
        </div>
        <div className="desk-planner-field">
          <label htmlFor="open-account-goal">Target goal (MT)</label>
          <input
            autoComplete="off"
            id="open-account-goal"
            inputMode="numeric"
            onChange={(event) => setGoalInput(event.target.value)}
            placeholder="0"
            value={goalInput}
          />
        </div>
        {kind === "offset" ? (
          <div className="desk-planner-field">
            <label htmlFor="open-account-loan">Linked loan</label>
            <select
              id="open-account-loan"
              onChange={(event) => setLoanChoice(accountId(event.target.value))}
              value={linkedLoanId}
            >
              {loans.map((loan) => (
                <option key={loan.id} value={loan.id}>
                  {loan.name}
                </option>
              ))}
            </select>
          </div>
        ) : null}
      </div>
      <div className="desk-planner-actions">
        <div>
          <p role="status">{opened ? `Opened ${opened}.` : ""}</p>
          {error ? (
            <p className="form-error" role="alert">
              {error}
            </p>
          ) : null}
        </div>
        <button className="desk-primary-action" disabled={pending} type="submit">
          Open account
        </button>
      </div>
    </form>
  );
}
