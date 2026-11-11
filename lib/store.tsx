"use client";

import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import type {
  ApprovePaymentRequestCommand,
  BankSnapshot,
  CardStatus,
  CreatePaymentRequestCommand,
  PayIdTransferCommand,
  PaymentRequest,
  PaymentRequestFailure,
  PaymentRequestResult,
  PaymentRequestStatus,
  TransferCommand,
  TransferFailure,
  TransferResult,
} from "./domain";
import type { CardId, PaymentRequestId } from "./ids";
import { defaultDemoResident, seedSnapshotForSlug } from "./fixtures";

type BankStore = {
  snapshot: BankSnapshot;
  transfer: (command: TransferCommand) => Promise<TransferResult>;
  sendPayId: (command: PayIdTransferCommand) => Promise<TransferResult>;
  requestTokens: (
    command: CreatePaymentRequestCommand,
  ) => Promise<PaymentRequestResult>;
  approveRequest: (
    command: ApprovePaymentRequestCommand,
  ) => Promise<PaymentRequestResult>;
  declineRequest: (
    paymentRequestId: PaymentRequestId,
  ) => Promise<PaymentRequestResult>;
  cancelRequest: (
    paymentRequestId: PaymentRequestId,
  ) => Promise<PaymentRequestResult>;
  updateCardStatus: (cardId: CardId, status: CardStatus) => Promise<void>;
  reset: () => Promise<void>;
};

const BankContext = createContext<BankStore | null>(null);

function cloneSeed(slug: string): BankSnapshot {
  return structuredClone(seedSnapshotForSlug(slug));
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function isBankSnapshot(value: unknown): value is BankSnapshot {
  return (
    isRecord(value) &&
    isRecord(value.customer) &&
    typeof value.customer.email === "string" &&
    Array.isArray(value.accounts) &&
    Array.isArray(value.cards) &&
    Array.isArray(value.transactions) &&
    typeof value.revision === "number"
  );
}

function registerFromPayload(value: unknown): BankSnapshot | undefined {
  if (!isRecord(value) || !isBankSnapshot(value.snapshot)) {
    return undefined;
  }
  return Array.isArray(value.snapshot.paymentRequests)
    ? value.snapshot
    : { ...value.snapshot, paymentRequests: [] };
}

const transferFailureKinds: Record<TransferFailure["kind"], true> = {
  "same-account": true,
  "unknown-account": true,
  "amount-not-positive": true,
  "insufficient-funds": true,
  "credit-limit": true,
  "loan-not-source": true,
  "invalid-payid": true,
  "own-payid": true,
  "sol-limit": true,
  "step-up-required": true,
  network: true,
};

const paymentRequestFailureKinds: Record<PaymentRequestFailure["kind"], true> = {
  ...transferFailureKinds,
  "unknown-resident": true,
  "unknown-request": true,
  "request-not-open": true,
};

const paymentRequestStatuses: Record<PaymentRequestStatus, true> = {
  open: true,
  paid: true,
  declined: true,
  cancelled: true,
};

function isTransferFailureKind(
  value: unknown,
): value is TransferFailure["kind"] {
  return typeof value === "string" && Object.hasOwn(transferFailureKinds, value);
}

function isPaymentRequestFailureKind(
  value: unknown,
): value is PaymentRequestFailure["kind"] {
  return (
    typeof value === "string" &&
    Object.hasOwn(paymentRequestFailureKinds, value)
  );
}

function isPaymentRequest(value: unknown): value is PaymentRequest {
  return (
    isRecord(value) &&
    typeof value.id === "string" &&
    typeof value.requesterSlug === "string" &&
    typeof value.requesterName === "string" &&
    typeof value.requesterEmail === "string" &&
    typeof value.payerSlug === "string" &&
    typeof value.payerName === "string" &&
    typeof value.payerEmail === "string" &&
    typeof value.amount === "number" &&
    typeof value.description === "string" &&
    typeof value.createdAt === "string" &&
    typeof value.status === "string" &&
    Object.hasOwn(paymentRequestStatuses, value.status)
  );
}

function transferFromPayload(value: unknown): TransferResult | undefined {
  if (!isRecord(value) || typeof value.kind !== "string") return undefined;
  if (value.kind === "ok") {
    const snapshot = registerFromPayload({ snapshot: value.snapshot });
    return snapshot ? { kind: "ok", snapshot } : undefined;
  }
  return isTransferFailureKind(value.kind) ? { kind: value.kind } : undefined;
}

function paymentRequestFromPayload(
  value: unknown,
): PaymentRequestResult | undefined {
  if (!isRecord(value) || typeof value.kind !== "string") return undefined;
  if (value.kind === "ok") {
    const snapshot = registerFromPayload({ snapshot: value.snapshot });
    return snapshot && isPaymentRequest(value.request)
      ? { kind: "ok", snapshot, request: value.request }
      : undefined;
  }
  return isPaymentRequestFailureKind(value.kind)
    ? { kind: value.kind }
    : undefined;
}

export function BankProvider({
  children,
  customerSlug = defaultDemoResident.slug,
}: {
  children: ReactNode;
  customerSlug?: string;
}) {
  const [snapshot, setSnapshot] = useState<BankSnapshot>(() =>
    cloneSeed(customerSlug),
  );

  useEffect(() => {
    let active = true;
    async function refresh() {
      if (document.visibilityState === "hidden") return;
      const response = await fetch("/api/register", { cache: "no-store" });
      if (!response.ok) return;
      const next = registerFromPayload(await response.json());
      if (active && next) {
        setSnapshot(next);
      }
    }
    void refresh();
    const timer = window.setInterval(() => void refresh(), 5_000);
    window.addEventListener("focus", refresh);
    return () => {
      active = false;
      window.clearInterval(timer);
      window.removeEventListener("focus", refresh);
    };
  }, [customerSlug]);

  async function postTransfer(
    command:
      | ({ kind: "own" } & TransferCommand)
      | ({ kind: "payid" } & PayIdTransferCommand),
  ): Promise<TransferResult> {
    try {
      const response = await fetch("/api/transfers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ requestId: crypto.randomUUID(), ...command }),
      });
      const result = transferFromPayload(await response.json());
      if (!result) return { kind: "network" };
      if (result.kind === "ok") setSnapshot(result.snapshot);
      return result;
    } catch {
      return { kind: "network" };
    }
  }

  async function postPaymentRequest(
    payload:
      | ({ action: "create" } & CreatePaymentRequestCommand)
      | ({ action: "approve" } & ApprovePaymentRequestCommand)
      | { action: "decline"; paymentRequestId: PaymentRequestId }
      | { action: "cancel"; paymentRequestId: PaymentRequestId },
  ): Promise<PaymentRequestResult> {
    try {
      const response = await fetch("/api/requests", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const result = paymentRequestFromPayload(await response.json());
      if (!result) return { kind: "network" };
      if (result.kind === "ok") setSnapshot(result.snapshot);
      return result;
    } catch {
      return { kind: "network" };
    }
  }

  const value: BankStore = {
    snapshot,
    async transfer(command) {
      return postTransfer({ kind: "own", ...command });
    },
    async sendPayId(command) {
      return postTransfer({ kind: "payid", ...command });
    },
    async requestTokens(command) {
      return postPaymentRequest({ action: "create", ...command });
    },
    async approveRequest(command) {
      return postPaymentRequest({ action: "approve", ...command });
    },
    async declineRequest(paymentRequestId) {
      return postPaymentRequest({ action: "decline", paymentRequestId });
    },
    async cancelRequest(paymentRequestId) {
      return postPaymentRequest({ action: "cancel", paymentRequestId });
    },
    async updateCardStatus(cardId, status) {
      const response = await fetch("/api/cards", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ cardId, status }),
      });
      if (!response.ok) return;
      const next = registerFromPayload(await response.json());
      if (next) setSnapshot(next);
    },
    async reset() {
      const response = await fetch("/api/reset", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ confirmation: "RESET ALL REGISTERS" }),
      });
      if (!response.ok) return;
      const next = registerFromPayload(await response.json());
      if (next) setSnapshot(next);
    },
  };

  return <BankContext.Provider value={value}>{children}</BankContext.Provider>;
}

export function useBank(): BankStore {
  const store = useContext(BankContext);
  if (!store) throw new Error("useBank must be used within BankProvider.");
  return store;
}
