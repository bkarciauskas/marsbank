"use client";

import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import type {
  BankSnapshot,
  CardStatus,
  PayIdTransferCommand,
  TransferCommand,
  TransferFailure,
  TransferResult,
} from "./domain";
import type { CardId } from "./ids";
import { defaultDemoResident, seedSnapshotForSlug } from "./fixtures";

type BankStore = {
  snapshot: BankSnapshot;
  transfer: (command: TransferCommand) => Promise<TransferResult>;
  sendPayId: (command: PayIdTransferCommand) => Promise<TransferResult>;
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
  return isRecord(value) && isBankSnapshot(value.snapshot)
    ? value.snapshot
    : undefined;
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

function isTransferFailureKind(
  value: unknown,
): value is TransferFailure["kind"] {
  return typeof value === "string" && Object.hasOwn(transferFailureKinds, value);
}

function transferFromPayload(value: unknown): TransferResult | undefined {
  if (!isRecord(value) || typeof value.kind !== "string") return undefined;
  if (value.kind === "ok") {
    const snapshot = registerFromPayload({ snapshot: value.snapshot });
    return snapshot ? { kind: "ok", snapshot } : undefined;
  }
  return isTransferFailureKind(value.kind) ? { kind: value.kind } : undefined;
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

  const value: BankStore = {
    snapshot,
    async transfer(command) {
      return postTransfer({ kind: "own", ...command });
    },
    async sendPayId(command) {
      return postTransfer({ kind: "payid", ...command });
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
