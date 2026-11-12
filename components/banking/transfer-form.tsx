"use client";

import { ArrowRight, Check, CheckCircle2, Loader2 } from "lucide-react";
import { useSearchParams } from "next/navigation";
import { useMemo, useState, type FormEvent } from "react";
import type {
  Contact,
  ContactFailure,
  PaymentRequest,
  PaymentRequestFailure,
  PaymentRequestStatus,
  ResolvedPayId,
} from "@/lib/domain";
import type { AccountId, PaymentRequestId } from "@/lib/ids";
import {
  availableBalance,
  needsStepUp,
  SOL_SEND_LIMIT,
  solSendRemaining,
  STEP_UP_THRESHOLD,
} from "@/lib/ledger";
import { formatTokens, parseTokenInput, type TokenAmount } from "@/lib/money";
import { openIncomingRequests, outgoingRequests } from "@/lib/notifications";
import {
  lookupPayId,
  lookupResidentPayId,
  normalizePayId,
  orderedContacts,
  payIdLabel,
  recentCounterparties,
  suggestedPayIds,
  suggestedResidentHandles,
} from "@/lib/payid";
import { useBank } from "@/lib/store";
import { SurveySelect } from "./survey-select";

type Destination = "own" | "payid" | "request";

type TransferState =
  | {
      step: "collect";
      destination: Destination;
      from: AccountId;
      to: AccountId;
      payId: string;
      requestTarget: string;
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
      stepUpConfirmed: boolean;
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
  "unknown-resident": "Requests can only be sent to another Mars Bank resident.",
  "unknown-request": "That payment request is no longer on your register.",
  "request-not-open": "That payment request has already been settled.",
  "sol-limit": `That send passes your ${formatTokens(SOL_SEND_LIMIT)} PayID limit for this sol. Lower the amount or send next sol.`,
  "step-up-required": `Confirm the send on the review step. Sends above ${formatTokens(STEP_UP_THRESHOLD)} need it.`,
  network: "The shared register could not be reached. Try sending again.",
} as const satisfies Record<PaymentRequestFailure["kind"], string>;

const contactErrorMessages = {
  "invalid-payid": "Enter a valid Cursor identity or PayID.",
  "own-payid": "That identity points back to your own Mars Bank profile.",
  "invalid-nickname": "Enter a nickname up to 40 characters.",
  "unknown-contact": "That contact is no longer on your register.",
  network: "The shared register could not be reached. Try saving again.",
} as const satisfies Record<ContactFailure["kind"], string>;

const statusLabels: Record<PaymentRequestStatus, string> = {
  open: "Open",
  paid: "Paid",
  declined: "Declined",
  cancelled: "Cancelled",
};

const postedAt = new Intl.DateTimeFormat("en-AU", {
  day: "numeric",
  month: "short",
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
  timeZone: "UTC",
});

export function TransferForm() {
  const searchParams = useSearchParams();
  const {
    snapshot,
    transfer,
    sendPayId,
    requestTokens,
    approveRequest,
    declineRequest,
    cancelRequest,
    saveContact,
    pinContact,
  } = useBank();
  const [submitting, setSubmitting] = useState(false);
  const [requestNotice, setRequestNotice] = useState<string | null>(null);
  const [queueNotice, setQueueNotice] = useState<string | null>(null);
  const [busyRequestId, setBusyRequestId] = useState<PaymentRequestId | null>(
    null,
  );
  const [approvalStepUp, setApprovalStepUp] = useState<{
    id: PaymentRequestId;
    confirmed: boolean;
  } | null>(null);
  const [requestIssues, setRequestIssues] = useState<Record<string, string>>(
    {},
  );
  const [nickname, setNickname] = useState("");
  const [contactNotice, setContactNotice] = useState<string | null>(null);
  const [contactIssue, setContactIssue] = useState<string | null>(null);
  const [contactBusy, setContactBusy] = useState(false);

  const sources = useMemo(
    () => snapshot.accounts.filter((account) => account.kind !== "loan"),
    [snapshot.accounts],
  );
  const requestedSource = searchParams.get("from");
  const fallbackSource = sources[0];
  if (!fallbackSource) {
    throw new Error("This register has no account that can send tokens.");
  }
  const initialSource =
    sources.find((account) => account.id === requestedSource)?.id ??
    fallbackSource.id;
  const initialDestination =
    snapshot.accounts.find((account) => account.id !== initialSource)?.id ??
    fallbackSource.id;
  const [state, setState] = useState<TransferState>({
    step: "collect",
    destination: "payid",
    from: initialSource,
    to: initialDestination,
    payId: "",
    requestTarget: "",
    amountInput: "",
    description: "",
  });

  const openIncoming = useMemo(
    () => openIncomingRequests(snapshot),
    [snapshot],
  );
  const outgoing = useMemo(() => outgoingRequests(snapshot), [snapshot]);
  const savedContacts = useMemo(
    () => orderedContacts(snapshot.contacts),
    [snapshot.contacts],
  );
  const recentPayees = useMemo(
    () =>
      recentCounterparties(
        snapshot.transactions,
        snapshot.customer.email,
        snapshot.contacts,
      ),
    [snapshot.contacts, snapshot.customer.email, snapshot.transactions],
  );

  const accountName = (id: AccountId) =>
    snapshot.accounts.find((account) => account.id === id)?.name ?? "Account";

  async function submitRequest() {
    if (state.step !== "collect" || state.destination !== "request") return;
    const amount = parseTokenInput(state.amountInput);
    if (!amount || amount <= 0) {
      setState({ ...state, issue: errorMessages["amount-not-positive"] });
      return;
    }
    const lookup = lookupResidentPayId(
      state.requestTarget,
      snapshot.customer.email,
    );
    if (lookup.kind === "invalid") {
      setState({
        ...state,
        issue: "Enter a Mars Bank resident PayID or @handle.",
      });
      return;
    }
    if (lookup.kind === "own") {
      setState({ ...state, issue: errorMessages["own-payid"] });
      return;
    }
    if (lookup.kind === "unknown-resident") {
      setState({ ...state, issue: errorMessages["unknown-resident"] });
      return;
    }

    setSubmitting(true);
    const result = await requestTokens({
      target: state.requestTarget,
      amount,
      description: state.description,
    });
    setSubmitting(false);

    if (result.kind !== "ok") {
      setState({
        ...state,
        issue:
          result.kind === "invalid-payid"
            ? "Enter a Mars Bank resident PayID or @handle."
            : errorMessages[result.kind],
      });
      return;
    }

    setRequestNotice(
      `Requested ${formatTokens(result.request.amount)} from ${result.request.payerName}.`,
    );
    setState({
      ...state,
      requestTarget: "",
      amountInput: "",
      description: "",
      issue: undefined,
    });
  }

  function pickPayee(payId: string) {
    if (state.step !== "collect") return;
    setContactIssue(null);
    setState({ ...state, payId, issue: undefined });
  }

  async function saveCurrentContact() {
    if (state.step !== "collect" || state.destination !== "payid") return;
    setContactBusy(true);
    setContactIssue(null);
    setContactNotice(null);
    const result = await saveContact({ handle: state.payId, nickname });
    setContactBusy(false);
    if (result.kind !== "ok") {
      setContactIssue(contactErrorMessages[result.kind]);
      return;
    }
    setNickname("");
    setContactNotice(`Saved ${result.contact.nickname}.`);
    setState({
      ...state,
      payId: result.contact.payee.id,
      issue: undefined,
    });
  }

  async function togglePinned(contact: Contact) {
    setContactBusy(true);
    setContactIssue(null);
    setContactNotice(null);
    const result = await pinContact(contact.id, !contact.pinned);
    setContactBusy(false);
    if (result.kind !== "ok") {
      setContactIssue(contactErrorMessages[result.kind]);
      return;
    }
    setContactNotice(
      result.contact.pinned
        ? `Pinned ${result.contact.nickname}.`
        : `Unpinned ${result.contact.nickname}.`,
    );
  }

  function collect(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (state.step !== "collect") return;
    if (state.destination === "request") {
      void submitRequest();
      return;
    }

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
      if (amount > solSendRemaining(snapshot, new Date())) {
        setState({ ...state, issue: errorMessages["sol-limit"] });
        return;
      }
      setState({
        step: "review",
        destination: "payid",
        from: state.from,
        payee: lookup.payee,
        amount,
        description: state.description,
        stepUpConfirmed: false,
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
            stepUpConfirmed: state.stepUpConfirmed,
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
        requestTarget: "",
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

  async function handleApproveIncoming(
    request: PaymentRequest,
    stepUpConfirmed: boolean,
  ) {
    const payFrom = state.from;
    const source = sources.find((account) => account.id === payFrom);
    if (!source || availableBalance(source) < request.amount) {
      setRequestIssues((current) => ({
        ...current,
        [request.id]: errorMessages["insufficient-funds"],
      }));
      return;
    }

    if (
      needsStepUp(request.amount) &&
      !stepUpConfirmed &&
      request.amount <= solSendRemaining(snapshot, new Date())
    ) {
      setApprovalStepUp({ id: request.id, confirmed: false });
      setRequestIssues((current) => {
        const next = { ...current };
        delete next[request.id];
        return next;
      });
      return;
    }

    setBusyRequestId(request.id);
    const result = await approveRequest({
      paymentRequestId: request.id,
      from: payFrom,
      stepUpConfirmed,
    });
    setBusyRequestId(null);

    if (result.kind !== "ok") {
      setRequestIssues((current) => ({
        ...current,
        [request.id]: errorMessages[result.kind],
      }));
      return;
    }

    setApprovalStepUp((current) =>
      current?.id === request.id ? null : current,
    );
    setRequestIssues((current) => {
      const next = { ...current };
      delete next[request.id];
      return next;
    });
    setQueueNotice(
      `Paid ${formatTokens(result.request.amount)} to ${result.request.requesterName} from ${accountName(payFrom)}.`,
    );
  }

  async function handleDeclineIncoming(request: PaymentRequest) {
    setBusyRequestId(request.id);
    const result = await declineRequest(request.id);
    setBusyRequestId(null);

    if (result.kind !== "ok") {
      setRequestIssues((current) => ({
        ...current,
        [request.id]: errorMessages[result.kind],
      }));
      return;
    }

    setApprovalStepUp((current) =>
      current?.id === request.id ? null : current,
    );
    setRequestIssues((current) => {
      const next = { ...current };
      delete next[request.id];
      return next;
    });
    setQueueNotice(
      `Declined ${formatTokens(request.amount)} request from ${request.requesterName}.`,
    );
  }

  async function handleCancelOutgoing(request: PaymentRequest) {
    setBusyRequestId(request.id);
    const result = await cancelRequest(request.id);
    setBusyRequestId(null);

    if (result.kind !== "ok") {
      setRequestIssues((current) => ({
        ...current,
        [request.id]: errorMessages[result.kind],
      }));
      return;
    }

    setRequestIssues((current) => {
      const next = { ...current };
      delete next[request.id];
      return next;
    });
    setRequestNotice(
      `Cancelled ${formatTokens(request.amount)} request to ${request.payerName}.`,
    );
  }

  const incomingQueueSection =
    openIncoming.length > 0 || queueNotice ? (
      <section
        aria-label="Open payment requests"
        className="request-queue-section"
      >
        <div className="request-queue-header">
          <div>
            <h3>
              Open payment requests
              {openIncoming.length > 0 ? ` (${openIncoming.length})` : ""}
            </h3>
            {openIncoming.length > 0 ? (
              <p>Paying from {accountName(state.from)}</p>
            ) : null}
          </div>
        </div>
        {queueNotice ? (
          <p className="request-dispatched-note" role="status">
            {queueNotice}
          </p>
        ) : null}
        {openIncoming.length > 0 ? (
          <ul className="request-queue-list">
            {openIncoming.map((request) => {
              const confirming =
                approvalStepUp?.id === request.id ? approvalStepUp : null;
              const busy = busyRequestId === request.id;
              const issue = requestIssues[request.id];
              return (
                <li className="request-queue-item" key={request.id}>
                  <div className="request-queue-copy">
                    <strong>
                      {request.requesterName} requested{" "}
                      {formatTokens(request.amount)}
                    </strong>
                    <span>
                      @{request.requesterSlug} · {request.description} ·{" "}
                      <time dateTime={request.createdAt}>
                        {postedAt.format(new Date(request.createdAt))} UTC
                      </time>
                    </span>
                  </div>
                  {confirming ? (
                    <div className="request-step-up">
                      <label
                        className="step-up-confirm"
                        htmlFor={`request-step-up-${request.id}`}
                      >
                        <input
                          checked={confirming.confirmed}
                          disabled={busy}
                          id={`request-step-up-${request.id}`}
                          onChange={(event) =>
                            setApprovalStepUp({
                              id: request.id,
                              confirmed: event.target.checked,
                            })
                          }
                          type="checkbox"
                        />
                        <span>
                          I confirm sending {formatTokens(request.amount)} to{" "}
                          {request.requesterName}.
                          <small>
                            Sends above {formatTokens(STEP_UP_THRESHOLD)} need
                            this check.
                          </small>
                        </span>
                      </label>
                      <div className="request-queue-actions">
                        <button
                          className="request-approve-button"
                          disabled={busy || !confirming.confirmed}
                          onClick={() =>
                            void handleApproveIncoming(
                              request,
                              confirming.confirmed,
                            )
                          }
                          type="button"
                        >
                          Confirm payment
                        </button>
                        <button
                          className="request-decline-button"
                          disabled={busy}
                          onClick={() => setApprovalStepUp(null)}
                          type="button"
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="request-queue-actions">
                      <button
                        className="request-approve-button"
                        disabled={busy}
                        onClick={() =>
                          void handleApproveIncoming(request, false)
                        }
                        type="button"
                      >
                        Approve
                      </button>
                      <button
                        className="request-decline-button"
                        disabled={busy}
                        onClick={() => void handleDeclineIncoming(request)}
                        type="button"
                      >
                        Decline
                      </button>
                    </div>
                  )}
                  {issue ? (
                    <p className="form-error" role="alert">
                      {issue}
                    </p>
                  ) : null}
                </li>
              );
            })}
          </ul>
        ) : null}
      </section>
    ) : null;

  if (state.step === "posted") {
    const destinationName =
      state.destination === "payid"
        ? `${state.payee.displayName} (${state.payee.id})`
        : accountName(state.to);
    return (
      <div className="transfer-desk">
        {incomingQueueSection}
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
                requestTarget: "",
                amountInput: "",
                description: "",
              })
            }
            type="button"
          >
            Plot another route
          </button>
        </div>
      </div>
    );
  }

  if (state.step === "review") {
    const stepUp =
      state.destination === "payid" && needsStepUp(state.amount) ? state : null;
    return (
      <div className="transfer-desk">
        {incomingQueueSection}
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
          {stepUp ? (
            <label className="step-up-confirm" htmlFor="transfer-step-up">
              <input
                checked={stepUp.stepUpConfirmed}
                disabled={submitting}
                id="transfer-step-up"
                onChange={(event) =>
                  setState({ ...stepUp, stepUpConfirmed: event.target.checked })
                }
                type="checkbox"
              />
              <span>
                I confirm sending {formatTokens(stepUp.amount)} to{" "}
                {stepUp.payee.displayName}.
                <small>
                  Sends above {formatTokens(STEP_UP_THRESHOLD)} need this check.
                </small>
              </span>
            </label>
          ) : null}
          <div className="review-actions">
            <button
              className="secondary-action"
              disabled={submitting}
              onClick={() =>
                setState({
                  step: "collect",
                  destination: state.destination,
                  from: state.from,
                  to:
                    state.destination === "own" ? state.to : initialDestination,
                  payId: state.destination === "payid" ? state.payee.id : "",
                  requestTarget: "",
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
              disabled={
                submitting || (stepUp !== null && !stepUp.stepUpConfirmed)
              }
              onClick={() => void post()}
              type="button"
            >
              {submitting ? <Loader2 className="spin" /> : <Check />}
              {submitting ? "Posting transfer" : "Send tokens"}
            </button>
          </div>
        </div>
      </div>
    );
  }

  const source = sources.find((account) => account.id === state.from);
  const payIdLookup = state.payId
    ? lookupPayId(state.payId, snapshot.customer.email)
    : null;
  const residentLookup = state.requestTarget
    ? lookupResidentPayId(state.requestTarget, snapshot.customer.email)
    : null;

  return (
    <div className="transfer-desk">
      {incomingQueueSection}
      <form
        className="transfer-form"
        onSubmit={(event) => {
          setContactIssue(null);
          collect(event);
        }}
      >
        <fieldset className="transfer-destination">
          <legend>Choose a route</legend>
          <div>
            <button
              aria-pressed={state.destination === "payid"}
              onClick={() => {
                setRequestNotice(null);
                setState({ ...state, destination: "payid", issue: undefined });
              }}
              type="button"
            >
              Cursor or PayID
            </button>
            <button
              aria-pressed={state.destination === "own"}
              onClick={() => {
                setRequestNotice(null);
                setState({ ...state, destination: "own", issue: undefined });
              }}
              type="button"
            >
              Between my accounts
            </button>
            <button
              aria-pressed={state.destination === "request"}
              onClick={() => {
                setState({
                  ...state,
                  destination: "request",
                  issue: undefined,
                });
              }}
              type="button"
            >
              Request tokens
            </button>
          </div>
        </fieldset>

        {state.destination === "request" ? (
          <>
            <label htmlFor="request-target">
              Request from resident
              <input
                autoComplete="off"
                id="request-target"
                onChange={(event) => {
                  setRequestNotice(null);
                  setState({
                    ...state,
                    requestTarget: event.target.value,
                    issue: undefined,
                  });
                }}
                placeholder="@resident or resident@marsbank.mars"
                spellCheck={false}
                value={state.requestTarget}
              />
              <small>
                Enter another Mars Bank resident @handle or PayID. Approved
                tokens credit Sol Account.
              </small>
            </label>
            {residentLookup?.kind === "ok" ? (
              <p className="payid-resolve">
                <strong>{residentLookup.payee.displayName}</strong>
                <span>
                  @{residentLookup.resident.slug} · {residentLookup.payee.id} ·
                  Mars Bank
                </span>
              </p>
            ) : null}
            <div className="payid-suggestions">
              {suggestedResidentHandles(snapshot.customer.email).map(
                (entry) => (
                  <button
                    key={entry.slug}
                    onClick={() => {
                      setRequestNotice(null);
                      setState({
                        ...state,
                        requestTarget: entry.handle,
                        issue: undefined,
                      });
                    }}
                    type="button"
                  >
                    {entry.handle}
                  </button>
                ),
              )}
            </div>
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
              <small>Whole model tokens settled into Sol Account</small>
            </label>
            <label htmlFor="transfer-description">
              Request reference
              <input
                id="transfer-description"
                maxLength={60}
                onChange={(event) =>
                  setState({ ...state, description: event.target.value })
                }
                placeholder="Short reference, e.g. Arc Canteen tray"
                value={state.description}
              />
            </label>
            {state.issue ? (
              <p className="form-error" role="alert">
                {state.issue}
              </p>
            ) : null}
            {requestNotice ? (
              <p className="request-dispatched-note" role="status">
                {requestNotice}
              </p>
            ) : null}
            <button
              className="primary-action"
              disabled={submitting}
              type="submit"
            >
              {submitting ? <Loader2 className="spin" /> : null}
              {submitting ? "Sending request" : "Send request"} <ArrowRight />
            </button>
          </>
        ) : (
          <>
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
              <ContactDirectory
                busy={contactBusy}
                contacts={savedContacts}
                issue={contactIssue}
                nickname={nickname}
                notice={contactNotice}
                onNickname={(value) => {
                  setContactNotice(null);
                  setNickname(value);
                }}
                onPick={pickPayee}
                onPin={(contact) => void togglePinned(contact)}
                onSave={() => void saveCurrentContact()}
                recent={recentPayees}
                selectedPayId={state.payId}
              />
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
          </>
        )}
      </form>

      {state.destination === "request" || outgoing.length > 0 ? (
        <section
          aria-label="Outgoing payment requests"
          className="outgoing-requests-section"
        >
          <div className="request-queue-header">
            <h3>Outgoing requests</h3>
          </div>
          {outgoing.length === 0 ? (
            <p className="requests-empty">
              No outgoing requests yet. Ask another resident by @handle or PayID
              above.
            </p>
          ) : (
            <ul className="request-queue-list">
              {outgoing.map((request) => {
                const busy = busyRequestId === request.id;
                const issue = requestIssues[request.id];
                return (
                  <li className="request-queue-item" key={request.id}>
                    <div className="request-queue-copy">
                      <strong>
                        {formatTokens(request.amount)} from {request.payerName}
                      </strong>
                      <span>
                        @{request.payerSlug} · {request.description} ·{" "}
                        <time dateTime={request.createdAt}>
                          {postedAt.format(new Date(request.createdAt))} UTC
                        </time>
                      </span>
                    </div>
                    <div className="request-queue-actions">
                      <span
                        className={`request-status-pill is-${request.status}`}
                      >
                        {statusLabels[request.status]}
                      </span>
                      {request.status === "open" ? (
                        <button
                          className="request-decline-button"
                          disabled={busy}
                          onClick={() => void handleCancelOutgoing(request)}
                          type="button"
                        >
                          Cancel request
                        </button>
                      ) : null}
                    </div>
                    {issue ? (
                      <p className="form-error" role="alert">
                        {issue}
                      </p>
                    ) : null}
                  </li>
                );
              })}
            </ul>
          )}
        </section>
      ) : null}
    </div>
  );
}

function ContactDirectory({
  busy,
  contacts,
  issue,
  nickname,
  notice,
  onNickname,
  onPick,
  onPin,
  onSave,
  recent,
  selectedPayId,
}: {
  busy: boolean;
  contacts: Contact[];
  issue: string | null;
  nickname: string;
  notice: string | null;
  onNickname: (value: string) => void;
  onPick: (payId: string) => void;
  onPin: (contact: Contact) => void;
  onSave: () => void;
  recent: ResolvedPayId[];
  selectedPayId: string;
}) {
  const selected = normalizePayId(selectedPayId);

  return (
    <section aria-label="Contacts" className="contact-directory">
      <div className="contact-directory-heading">
        <h3>Contacts</h3>
        <p>
          Save a PayID or Cursor handle with a nickname, pin the ones you use,
          or pick a recent payee.
        </p>
      </div>
      {contacts.length > 0 ? (
        <ul className="contact-list">
          {contacts.map((contact) => {
            const chosen = selected === normalizePayId(contact.payee.id);
            return (
              <li className="contact-row" key={contact.id}>
                <button
                  aria-label={`Choose ${contact.nickname} ${contact.payee.id}`}
                  aria-pressed={chosen}
                  onClick={() => onPick(contact.payee.id)}
                  type="button"
                >
                  <strong>
                    {contact.nickname}
                    {contact.pinned ? " · Pinned" : ""}
                  </strong>
                  <span>{contact.payee.id}</span>
                </button>
                <button
                  aria-label={
                    contact.pinned
                      ? `Unpin ${contact.nickname}`
                      : `Pin ${contact.nickname}`
                  }
                  aria-pressed={contact.pinned}
                  disabled={busy}
                  onClick={() => onPin(contact)}
                  type="button"
                >
                  {contact.pinned ? "Unpin" : "Pin"}
                </button>
              </li>
            );
          })}
        </ul>
      ) : (
        <p className="contact-empty">No saved contacts yet.</p>
      )}
      {recent.length > 0 ? (
        <div className="contact-recent">
          <h4>Recent payees</h4>
          <div
            aria-label="Recent payees"
            className="payid-suggestions"
            role="group"
          >
            {recent.map((payee) => (
              <button
                aria-label={`Choose recent payee ${payee.displayName} ${payee.id}`}
                key={payee.id}
                onClick={() => onPick(payee.id)}
                type="button"
              >
                {payee.displayName}
                <span>{payee.id}</span>
              </button>
            ))}
          </div>
        </div>
      ) : null}
      <label htmlFor="contact-nickname">
        Nickname
        <input
          autoComplete="off"
          disabled={busy}
          id="contact-nickname"
          maxLength={40}
          onChange={(event) => onNickname(event.target.value)}
          onKeyDown={(event) => {
            if (event.key !== "Enter") return;
            event.preventDefault();
            onSave();
          }}
          placeholder="Greenhouse share"
          value={nickname}
        />
        <small>Shown on the contact when you pick it next time.</small>
      </label>
      <button
        className="contact-save-button"
        disabled={busy}
        onClick={onSave}
        type="button"
      >
        Save contact
      </button>
      {issue ? (
        <p className="form-error" role="alert">
          {issue}
        </p>
      ) : null}
      {notice ? (
        <p className="contact-notice" role="status">
          {notice}
        </p>
      ) : null}
    </section>
  );
}
