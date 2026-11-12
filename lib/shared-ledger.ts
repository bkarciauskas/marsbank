import type {
  ApprovePaymentRequestCommand,
  BankSnapshot,
  CancelPaymentRequestCommand,
  DeclinePaymentRequestCommand,
  HostedTransferCommand,
  PaymentRequest,
  PaymentRequestFailure,
  TransferResult,
} from "./domain";
import { holdReserveAvailable } from "./demo/reserve-hold";
import type { DemoResident } from "./fixtures";
import type { PaymentRequestId } from "./ids";
import { applyIncomingResidentTransfer, applyPayIdTransfer, applyTransfer } from "./ledger";
import type { TokenAmount } from "./money";

export type SharedTransferResult =
  | {
      kind: "ok";
      sender: BankSnapshot;
      recipient?: BankSnapshot;
    }
  | Exclude<TransferResult, { kind: "ok" }>;

export function applySharedTransfer({
  command,
  holdReserve = false,
  now,
  recipient,
  recipientResident,
  requestId,
  sender,
}: {
  command: HostedTransferCommand;
  holdReserve?: boolean;
  now: Date;
  recipient?: BankSnapshot;
  recipientResident?: DemoResident;
  requestId: string;
  sender: BankSnapshot;
}): SharedTransferResult {
  const senderResult =
    command.kind === "own"
      ? applyTransfer(sender, command.command, now)
      : applyPayIdTransfer(sender, command.command, now);

  if (senderResult.kind !== "ok") {
    return senderResult;
  }

  // Debug-mode walk: Reserve posts to current but available stays put.
  const senderSnapshot = holdReserve
    ? holdReserveAvailable(sender, senderResult.snapshot)
    : senderResult.snapshot;

  if (
    command.kind !== "payid" ||
    !recipient ||
    !recipientResident
  ) {
    return { kind: "ok", sender: senderSnapshot };
  }

  return {
    kind: "ok",
    sender: senderSnapshot,
    recipient: applyIncomingResidentTransfer(
      recipient,
      {
        amount: command.command.amount,
        description: command.command.description,
        requestId,
        senderEmail: sender.customer.email,
        senderName: sender.customer.displayName,
      },
      now,
    ),
  };
}

export type SharedPaymentRequestResult =
  | {
      kind: "ok";
      actor: BankSnapshot;
      counterparty: BankSnapshot;
      counterpartySlug: string;
      request: PaymentRequest;
    }
  | PaymentRequestFailure;

function upsertPaymentRequest(
  list: readonly PaymentRequest[] | undefined,
  updated: PaymentRequest,
): PaymentRequest[] {
  const existing = list ?? [];
  const hasEntry = existing.some((entry) => entry.id === updated.id);
  if (!hasEntry) {
    return [updated, ...existing];
  }
  return existing.map((entry) => (entry.id === updated.id ? updated : entry));
}

export function applyCreatePaymentRequest({
  amount,
  description,
  id,
  now,
  payer,
  payerResident,
  requester,
  requesterResident,
}: {
  amount: TokenAmount;
  description: string;
  id: PaymentRequestId;
  now: Date;
  payer: BankSnapshot;
  payerResident: DemoResident;
  requester: BankSnapshot;
  requesterResident: DemoResident;
}): SharedPaymentRequestResult {
  if (amount <= 0) {
    return { kind: "amount-not-positive" };
  }
  if (requesterResident.slug === payerResident.slug) {
    return { kind: "own-payid" };
  }

  const trimmed = description.trim().slice(0, 60);
  const request: PaymentRequest = {
    id,
    requesterSlug: requesterResident.slug,
    requesterName: requester.customer.displayName,
    requesterEmail: requester.customer.email,
    payerSlug: payerResident.slug,
    payerName: payer.customer.displayName,
    payerEmail: payer.customer.email,
    amount,
    description:
      trimmed || `Payment request from ${requester.customer.displayName}`,
    createdAt: now.toISOString(),
    status: "open",
  };

  return {
    kind: "ok",
    actor: {
      ...requester,
      revision: requester.revision + 1,
      paymentRequests: upsertPaymentRequest(requester.paymentRequests, request),
    },
    counterparty: {
      ...payer,
      revision: payer.revision + 1,
      paymentRequests: upsertPaymentRequest(payer.paymentRequests, request),
    },
    counterpartySlug: payerResident.slug,
    request,
  };
}

export function applyApprovePaymentRequest({
  command,
  holdReserve = false,
  now,
  payer,
  payerSlug,
  requester,
  requesterResident,
}: {
  command: ApprovePaymentRequestCommand;
  holdReserve?: boolean;
  now: Date;
  payer: BankSnapshot;
  payerSlug: string;
  requester: BankSnapshot;
  requesterResident: DemoResident;
}): SharedPaymentRequestResult {
  const existing = (payer.paymentRequests ?? []).find(
    (entry) =>
      entry.id === command.paymentRequestId && entry.payerSlug === payerSlug,
  );
  if (!existing) {
    return { kind: "unknown-request" };
  }
  if (existing.status !== "open") {
    return { kind: "request-not-open" };
  }

  const transferResult = applySharedTransfer({
    command: {
      kind: "payid",
      command: {
        from: command.from,
        amount: existing.amount,
        description: existing.description,
        payee: {
          scheme: "payid",
          id: existing.requesterEmail,
          displayName: existing.requesterName,
          institution: "Mars Bank",
        },
        stepUpConfirmed: command.stepUpConfirmed,
      },
    },
    holdReserve,
    now,
    recipient: requester,
    recipientResident: requesterResident,
    requestId: `payreq-${existing.id}`,
    sender: payer,
  });

  if (transferResult.kind !== "ok") {
    return transferResult;
  }

  const resolved: PaymentRequest = {
    ...existing,
    status: "paid",
    resolvedAt: now.toISOString(),
  };

  const creditedRequester = transferResult.recipient ?? requester;

  return {
    kind: "ok",
    actor: {
      ...transferResult.sender,
      paymentRequests: upsertPaymentRequest(
        transferResult.sender.paymentRequests,
        resolved,
      ),
    },
    counterparty: {
      ...creditedRequester,
      paymentRequests: upsertPaymentRequest(
        creditedRequester.paymentRequests,
        resolved,
      ),
    },
    counterpartySlug: requesterResident.slug,
    request: resolved,
  };
}

export function applyDeclinePaymentRequest({
  command,
  now,
  payer,
  payerSlug,
  requester,
}: {
  command: DeclinePaymentRequestCommand;
  now: Date;
  payer: BankSnapshot;
  payerSlug: string;
  requester: BankSnapshot;
}): SharedPaymentRequestResult {
  const existing = (payer.paymentRequests ?? []).find(
    (entry) =>
      entry.id === command.paymentRequestId && entry.payerSlug === payerSlug,
  );
  if (!existing) {
    return { kind: "unknown-request" };
  }
  if (existing.status !== "open") {
    return { kind: "request-not-open" };
  }

  const resolved: PaymentRequest = {
    ...existing,
    status: "declined",
    resolvedAt: now.toISOString(),
  };

  return {
    kind: "ok",
    actor: {
      ...payer,
      revision: payer.revision + 1,
      paymentRequests: upsertPaymentRequest(payer.paymentRequests, resolved),
    },
    counterparty: {
      ...requester,
      revision: requester.revision + 1,
      paymentRequests: upsertPaymentRequest(requester.paymentRequests, resolved),
    },
    counterpartySlug: existing.requesterSlug,
    request: resolved,
  };
}

export function applyCancelPaymentRequest({
  command,
  now,
  payer,
  requester,
  requesterSlug,
}: {
  command: CancelPaymentRequestCommand;
  now: Date;
  payer: BankSnapshot;
  requester: BankSnapshot;
  requesterSlug: string;
}): SharedPaymentRequestResult {
  const existing = (requester.paymentRequests ?? []).find(
    (entry) =>
      entry.id === command.paymentRequestId &&
      entry.requesterSlug === requesterSlug,
  );
  if (!existing) {
    return { kind: "unknown-request" };
  }
  if (existing.status !== "open") {
    return { kind: "request-not-open" };
  }

  const resolved: PaymentRequest = {
    ...existing,
    status: "cancelled",
    resolvedAt: now.toISOString(),
  };

  return {
    kind: "ok",
    actor: {
      ...requester,
      revision: requester.revision + 1,
      paymentRequests: upsertPaymentRequest(
        requester.paymentRequests,
        resolved,
      ),
    },
    counterparty: {
      ...payer,
      revision: payer.revision + 1,
      paymentRequests: upsertPaymentRequest(payer.paymentRequests, resolved),
    },
    counterpartySlug: existing.payerSlug,
    request: resolved,
  };
}
