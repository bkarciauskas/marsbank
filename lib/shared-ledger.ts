import type {
  BankSnapshot,
  HostedTransferCommand,
  TransferResult,
} from "./domain";
import { holdReserveAvailable } from "./demo/reserve-hold";
import type { DemoResident } from "./fixtures";
import { applyIncomingResidentTransfer, applyPayIdTransfer, applyTransfer } from "./ledger";

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
