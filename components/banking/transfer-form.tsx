"use client";

import { ArrowRight, Check, CheckCircle2, Loader2 } from "lucide-react";
import { useSearchParams } from "next/navigation";
import { useMemo, useState, type FormEvent } from "react";
import type { ResolvedPayId } from "@/lib/domain";
import type { AccountId } from "@/lib/ids";
import { availableBalance } from "@/lib/ledger";
import { formatTokens, parseTokenInput, type TokenAmount } from "@/lib/money";
import { lookupPayId, payIdLabel, suggestedPayIds } from "@/lib/payid";
import { useBank } from "@/lib/store";
import { SurveySelect } from "./survey-select";

type Destination = "own" | "payid";

type TransferState =
  | {
      step: "collect";
      destination: Destination;
      from: AccountId;
      to: AccountId;
      payId: string;
      amountInput: string;
      description: string;
      issue?: string;
    }
  | {
      step: "review";
      destination: "own";
      from: AccountId;
      to: AccountId;
      amount: TokenAmount;
      description: string;
    }
  | {
      step: "review";
      destination: "payid";
      from: AccountId;
      payee: ResolvedPayId;
      amount: TokenAmount;
      description: string;
    }
  | {
      step: "posted";
      destination: "own";
      from: AccountId;
      to: AccountId;
      amount: TokenAmount;
    }
  | {
      step: "posted";
      destination: "payid";
      from: AccountId;
      payee: ResolvedPayId;
      amount: TokenAmount;
    };

const errorMessages = {
  "same-account": "Choose a different destination account.",
  "unknown-account": "That route includes an account no longer on your register.",
  "amount-not-positive": "Enter at least one whole token.",
  "insufficient-funds": "Lower the amount to fit the available token balance.",
  "credit-limit": "Lower the amount to stay within the expedition card limit.",
  "loan-not-source": "Choose a token account. A habitat loan cannot send funds.",
  "invalid-payid": "Enter a valid Cursor identity or PayID.",
  "own-payid": "That identity points back to your own Mars Bank profile.",
  network: "The shared register could not be reached. Try sending again.",
} as const;

export function TransferForm() {
  const searchParams = useSearchParams();
  const { snapshot, transfer, sendPayId } = useBank();
  const [submitting, setSubmitting] = useState(false);
  const sources = useMemo(
    () => snapshot.accounts.filter((account) => account.kind !== "loan"),
    [snapshot.accounts],
  );
  const requestedSource = searchParams.get("from");
  const initialSource =
    sources.find((account) => account.id === requestedSource)?.id ?? sources[0].id;
  const initialDestination =
    snapshot.accounts.find((account) => account.id !== initialSource)?.id ??
    sources[0].id;
  const [state, setState] = useState<TransferState>({
    step: "collect",
    destination: "payid",
    from: initialSource,
    to: initialDestination,
    payId: "",
    amountInput: "",
    description: "",
  });

  function collect(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (state.step !== "collect") return;
    const amount = parseTokenInput(state.amountInput);
    if (!amount || amount <= 0) {
      setState({ ...state, issue: "Enter at least one whole token." });
      return;
    }
    const source = sources.find((account) => account.id === state.from);
    if (!source || availableBalance(source) < amount) {
      setState({
        ...state,
        issue: "Lower the amount to fit the available token balance.",
      });
      return;
    }

    if (state.destination === "payid") {
      const lookup = lookupPayId(state.payId, snapshot.customer.email);
      if (lookup.kind === "invalid") {
        setState({ ...state, issue: errorMessages["invalid-payid"] });
        return;
      }
      if (lookup.kind === "own") {
        setState({ ...state, issue: errorMessages["own-payid"] });
        return;
      }
      setState({
        step: "review",
        destination: "payid",
        from: state.from,
        payee: lookup.payee,
        amount,
        description: state.description,
      });
      return;
    }

    if (state.from === state.to) {
      setState({ ...state, issue: errorMessages["same-account"] });
      return;
    }
    setState({
      step: "review",
      destination: "own",
      from: state.from,
      to: state.to,
      amount,
      description: state.description,
    });
  }

  async function post() {
    if (state.step !== "review") return;
    setSubmitting(true);
    const result =
      state.destination === "payid"
        ? await sendPayId({
            from: state.from,
            amount: state.amount,
            description: state.description,
            payee: state.payee,
          })
        : await transfer({
            from: state.from,
            to: state.to,
            amount: state.amount,
            description: state.description,
          });
    setSubmitting(false);
    if (result.kind !== "ok") {
      setState({
        step: "collect",
        destination: state.destination,
        from: state.from,
        to: state.destination === "own" ? state.to : initialDestination,
        payId: state.destination === "payid" ? state.payee.id : "",
        amountInput: String(state.amount),
        description: state.description,
        issue: errorMessages[result.kind],
      });
      return;
    }
    setState(
      state.destination === "payid"
        ? {
            step: "posted",
            destination: "payid",
            from: state.from,
            payee: state.payee,
            amount: state.amount,
          }
        : {
            step: "posted",
            destination: "own",
            from: state.from,
            to: state.to,
            amount: state.amount,
          },
    );
  }

  const accountName = (id: AccountId) =>
    snapshot.accounts.find((account) => account.id === id)?.name ?? "Account";

  if (state.step === "posted") {
    const destinationName =
      state.destination === "payid"
        ? `${state.payee.displayName} (${state.payee.id})`
        : accountName(state.to);
    return (
      <div className="transfer-success">
        <CheckCircle2 />
        <h2>Tokens dispatched</h2>
        <p>
          {formatTokens(state.amount)} moved from {accountName(state.from)} to{" "}
          {destinationName}.
        </p>
        <button
          onClick={() =>
            setState({
              step: "collect",
              destination: state.destination,
              from: state.from,
              to: state.destination === "own" ? state.to : initialDestination,
              payId: state.destination === "payid" ? state.payee.id : "",
              amountInput: "",
              description: "",
            })
          }
          type="button"
        >
          Plot another route
        </button>
      </div>
    );
  }

  if (state.step === "review") {
    return (
      <div className="transfer-review">
        <div className="transfer-route">
          <div>
            <span>Source</span>
            <strong>{accountName(state.from)}</strong>
          </div>
          <ArrowRight />
          <div>
            <span>
              {state.destination === "payid"
                ? payIdLabel(state.payee)
                : "Destination"}
            </span>
            <strong>
              {state.destination === "payid"
                ? state.payee.displayName
                : accountName(state.to)}
            </strong>
            {state.destination === "payid" ? (
              <small>
                {state.payee.id} · {state.payee.institution}
              </small>
            ) : null}
          </div>
        </div>
        <div className="review-amount">
          <span>Ready to send</span>
          <strong>{formatTokens(state.amount)}</strong>
          {state.description ? <p>{state.description}</p> : null}
        </div>
        <div className="review-actions">
          <button
            className="secondary-action"
            disabled={submitting}
            onClick={() =>
              setState({
                step: "collect",
                destination: state.destination,
                from: state.from,
                to: state.destination === "own" ? state.to : initialDestination,
                payId: state.destination === "payid" ? state.payee.id : "",
                amountInput: String(state.amount),
                description: state.description,
              })
            }
            type="button"
          >
            Edit route
          </button>
          <button
            className="primary-action"
            disabled={submitting}
            onClick={() => void post()}
            type="button"
          >
            {submitting ? <Loader2 className="spin" /> : <Check />}
            {submitting ? "Posting transfer" : "Send tokens"}
          </button>
        </div>
      </div>
    );
  }

  const source = sources.find((account) => account.id === state.from);
  const payIdLookup = state.payId
    ? lookupPayId(state.payId, snapshot.customer.email)
    : null;

  return (
    <form className="transfer-form" onSubmit={collect}>
      <fieldset className="transfer-destination">
        <legend>Choose a route</legend>
        <div>
          <button
            aria-pressed={state.destination === "payid"}
            onClick={() =>
              setState({ ...state, destination: "payid", issue: undefined })
            }
            type="button"
          >
            Cursor or PayID
          </button>
          <button
            aria-pressed={state.destination === "own"}
            onClick={() =>
              setState({ ...state, destination: "own", issue: undefined })
            }
            type="button"
          >
            Between my accounts
          </button>
        </div>
      </fieldset>
      <div className="transfer-field">
        <label htmlFor="transfer-from">Source account</label>
        <SurveySelect
          id="transfer-from"
          onChange={(from) =>
            setState({
              ...state,
              from: from as AccountId,
              issue: undefined,
            })
          }
          options={sources.map((account) => ({
            value: account.id,
            label: `${account.name} · ${formatTokens(availableBalance(account))} available`,
          }))}
          value={state.from}
        />
      </div>
      {state.destination === "own" ? (
        <div className="transfer-field">
          <label htmlFor="transfer-to">Destination account</label>
          <SurveySelect
            id="transfer-to"
            onChange={(to) =>
              setState({
                ...state,
                to: to as AccountId,
                issue: undefined,
              })
            }
            options={snapshot.accounts.map((account) => ({
              value: account.id,
              label: `${account.name} · ${account.number}`,
            }))}
            value={state.to}
          />
        </div>
      ) : (
        <label htmlFor="transfer-payid">
          Recipient identity
          <input
            autoComplete="off"
            id="transfer-payid"
            onChange={(event) =>
              setState({
                ...state,
                payId: event.target.value,
                issue: undefined,
              })
            }
            placeholder="@name or name@domain"
            spellCheck={false}
            value={state.payId}
          />
          <small>Enter a Cursor handle, Cursor email or PayID.</small>
        </label>
      )}
      {state.destination === "payid" && payIdLookup?.kind === "ok" ? (
        <p className="payid-resolve">
          <strong>{payIdLookup.payee.displayName}</strong>
          <span>
            {payIdLookup.payee.id} · {payIdLabel(payIdLookup.payee)} ·{" "}
            {payIdLookup.payee.institution}
          </span>
        </p>
      ) : null}
      {state.destination === "payid" ? (
        <div className="payid-suggestions">
          {suggestedPayIds(snapshot.customer.email).map((payee) => (
            <button
              key={payee.id}
              onClick={() =>
                setState({ ...state, payId: payee.id, issue: undefined })
              }
              type="button"
            >
              {payee.id}
            </button>
          ))}
        </div>
      ) : null}
      <label htmlFor="transfer-amount">
        Token amount
        <span className="amount-input">
          <input
            id="transfer-amount"
            inputMode="numeric"
            onChange={(event) =>
              setState({
                ...state,
                amountInput: event.target.value,
                issue: undefined,
              })
            }
            placeholder="0"
            value={state.amountInput}
          />
          <span>tokens</span>
        </span>
        {source ? (
          <small>{formatTokens(availableBalance(source))} available</small>
        ) : null}
      </label>
      <label htmlFor="transfer-description">
        Transfer reference
        <input
          id="transfer-description"
          maxLength={60}
          onChange={(event) =>
            setState({ ...state, description: event.target.value })
          }
          placeholder="Optional note"
          value={state.description}
        />
      </label>
      {state.issue ? (
        <p className="form-error" role="alert">
          {state.issue}
        </p>
      ) : null}
      <button className="primary-action" type="submit">
        Review route <ArrowRight />
      </button>
    </form>
  );
}
