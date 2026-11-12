"use client";

import { Bell } from "lucide-react";
import { useEffect, useId, useRef, useState } from "react";
import type { PaymentRequest, PaymentRequestFailure } from "@/lib/domain";
import { accountId, type PaymentRequestId } from "@/lib/ids";
import {
  needsStepUp,
  SOL_SEND_LIMIT,
  solSendRemaining,
  STEP_UP_THRESHOLD,
} from "@/lib/ledger";
import { formatTokens } from "@/lib/money";
import {
  bellBadgeCount,
  incomingTransfers,
  isUnread,
  markAllRead,
  openIncomingRequests,
  unreadCount,
} from "@/lib/notifications";
import { useBank } from "@/lib/store";
import { useIncomingRead } from "@/lib/use-incoming-read";

const postedAt = new Intl.DateTimeFormat("en-AU", {
  day: "numeric",
  month: "short",
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
  timeZone: "UTC",
});

function bellErrorMessage(kind: PaymentRequestFailure["kind"]): string {
  switch (kind) {
    case "sol-limit":
      return `Passes your ${formatTokens(SOL_SEND_LIMIT)} PayID limit for this sol.`;
    case "step-up-required":
      return `Confirm sends above ${formatTokens(STEP_UP_THRESHOLD)}.`;
    case "insufficient-funds":
      return "Insufficient available tokens in Sol Account.";
    case "credit-limit":
      return "Passes the expedition card limit.";
    case "request-not-open":
    case "unknown-request":
      return "That request has already been settled.";
    default:
      return "Could not update that request. Try again.";
  }
}

export function IncomingBell() {
  const { snapshot, approveRequest, declineRequest } = useBank();
  const [readThrough, setReadThrough] = useIncomingRead(snapshot.customer.email);
  const [open, setOpen] = useState(false);
  const [busyId, setBusyId] = useState<PaymentRequestId | null>(null);
  const [stepUp, setStepUp] = useState<{
    id: PaymentRequestId;
    confirmed: boolean;
  } | null>(null);
  const [issues, setIssues] = useState<Record<string, string>>({});
  const root = useRef<HTMLDivElement>(null);
  const panelId = useId();

  const feed = incomingTransfers(snapshot);
  const openRequests = openIncomingRequests(snapshot);
  const unread = unreadCount(feed, readThrough);
  const badge = bellBadgeCount(feed, readThrough, openRequests);
  const defaultFrom =
    snapshot.accounts.find((account) => account.id === "acc-everyday")?.id ??
    snapshot.accounts.find((account) => account.kind !== "loan")?.id ??
    accountId("acc-everyday");

  useEffect(() => {
    if (!open) return;
    function onPointer(event: PointerEvent) {
      if (!root.current?.contains(event.target as Node)) setOpen(false);
    }
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }
    document.addEventListener("pointerdown", onPointer);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onPointer);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  async function handleApprove(
    request: PaymentRequest,
    stepUpConfirmed: boolean,
  ) {
    if (
      needsStepUp(request.amount) &&
      !stepUpConfirmed &&
      request.amount <= solSendRemaining(snapshot, new Date())
    ) {
      setStepUp({ id: request.id, confirmed: false });
      setIssues((current) => {
        const next = { ...current };
        delete next[request.id];
        return next;
      });
      return;
    }

    setBusyId(request.id);
    const result = await approveRequest({
      paymentRequestId: request.id,
      from: defaultFrom,
      stepUpConfirmed,
    });
    setBusyId(null);

    if (result.kind !== "ok") {
      setIssues((current) => ({
        ...current,
        [request.id]: bellErrorMessage(result.kind),
      }));
      return;
    }

    setStepUp((current) => (current?.id === request.id ? null : current));
    setIssues((current) => {
      const next = { ...current };
      delete next[request.id];
      return next;
    });
  }

  async function handleDecline(requestId: PaymentRequestId) {
    setBusyId(requestId);
    const result = await declineRequest(requestId);
    setBusyId(null);

    if (result.kind !== "ok") {
      setIssues((current) => ({
        ...current,
        [requestId]: bellErrorMessage(result.kind),
      }));
      return;
    }

    setStepUp((current) => (current?.id === requestId ? null : current));
    setIssues((current) => {
      const next = { ...current };
      delete next[requestId];
      return next;
    });
  }

  return (
    <div className="desk-bell" ref={root}>
      <button
        aria-controls={panelId}
        aria-expanded={open}
        aria-label={badge > 0 ? `Notifications, ${badge} unread` : "Notifications"}
        className="desk-icon-button"
        onClick={() => setOpen((current) => !current)}
        type="button"
      >
        <Bell />
        {badge > 0 ? (
          <span aria-hidden="true" className="desk-bell-count">
            {badge > 9 ? "9+" : badge}
          </span>
        ) : null}
      </button>
      {open ? (
        <section
          aria-label="Incoming transfers"
          className="desk-bell-panel"
          id={panelId}
        >
          <header>
            <h2>Incoming transfers</h2>
            <button
              disabled={unread === 0}
              onClick={() => setReadThrough(markAllRead(feed, readThrough))}
              type="button"
            >
              Mark all as read
            </button>
          </header>
          {openRequests.length > 0 ? (
            <div className="desk-bell-requests">
              <p className="desk-bell-subheading">
                Open requests ({openRequests.length})
              </p>
              <ul>
                {openRequests.map((request) => {
                  const confirming = stepUp?.id === request.id ? stepUp : null;
                  const busy = busyId === request.id;
                  const issue = issues[request.id];
                  return (
                    <li
                      className="unread desk-bell-request-item"
                      key={request.id}
                    >
                      <strong>
                        {request.requesterName} requested{" "}
                        {formatTokens(request.amount)}
                      </strong>
                      <small>
                        {request.description} ·{" "}
                        <time dateTime={request.createdAt}>
                          {postedAt.format(new Date(request.createdAt))} UTC
                        </time>
                      </small>
                      {confirming ? (
                        <div className="desk-bell-step-up">
                          <label htmlFor={`bell-step-up-${request.id}`}>
                            <input
                              checked={confirming.confirmed}
                              disabled={busy}
                              id={`bell-step-up-${request.id}`}
                              onChange={(event) =>
                                setStepUp({
                                  id: request.id,
                                  confirmed: event.target.checked,
                                })
                              }
                              type="checkbox"
                            />
                            <span>
                              I confirm sending {formatTokens(request.amount)}{" "}
                              to {request.requesterName}.
                            </span>
                          </label>
                          <div className="desk-bell-actions">
                            <button
                              className="desk-bell-approve"
                              disabled={busy || !confirming.confirmed}
                              onClick={() =>
                                void handleApprove(request, confirming.confirmed)
                              }
                              type="button"
                            >
                              Confirm payment
                            </button>
                            <button
                              className="desk-bell-decline"
                              disabled={busy}
                              onClick={() => setStepUp(null)}
                              type="button"
                            >
                              Cancel
                            </button>
                          </div>
                        </div>
                      ) : (
                        <div className="desk-bell-actions">
                          <button
                            className="desk-bell-approve"
                            disabled={busy}
                            onClick={() => void handleApprove(request, false)}
                            type="button"
                          >
                            Approve
                          </button>
                          <button
                            className="desk-bell-decline"
                            disabled={busy}
                            onClick={() => void handleDecline(request.id)}
                            type="button"
                          >
                            Decline
                          </button>
                        </div>
                      )}
                      {issue ? (
                        <p className="desk-bell-error" role="alert">
                          {issue}
                        </p>
                      ) : null}
                    </li>
                  );
                })}
              </ul>
            </div>
          ) : null}
          {feed.length === 0 && openRequests.length === 0 ? (
            <p className="desk-bell-empty">
              No tokens from other residents yet.
            </p>
          ) : feed.length > 0 ? (
            <>
              {openRequests.length > 0 ? (
                <p className="desk-bell-subheading">Recent credits</p>
              ) : null}
              <ul>
                {feed.map((transfer) => (
                  <li
                    className={
                      isUnread(transfer, readThrough) ? "unread" : undefined
                    }
                    key={transfer.id}
                  >
                    <strong>
                      {transfer.senderName} sent {formatTokens(transfer.amount)}
                    </strong>
                    <small>
                      {transfer.description} ·{" "}
                      <time dateTime={transfer.postedOn}>
                        {postedAt.format(new Date(transfer.postedOn))} UTC
                      </time>
                    </small>
                  </li>
                ))}
              </ul>
            </>
          ) : null}
        </section>
      ) : null}
    </div>
  );
}
