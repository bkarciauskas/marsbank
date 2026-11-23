import type { NextRequest } from "next/server";
import type {
  CardStatus,
  HostedContactCommand,
  HostedPaymentRequestCommand,
  HostedTransferCommand,
  PayIdScheme,
  ResolvedPayId,
} from "../domain";
import { isDemoSlug } from "../fixtures";
import {
  accountId,
  cardId,
  contactId,
  paymentRequestId,
  type CardId,
} from "../ids";
import { tokens } from "../money";

export function authenticatedResident(
  request: NextRequest,
): string | undefined {
  const slug = request.cookies.get("marsbank-demo-session")?.value;
  return isDemoSlug(slug) ? slug : undefined;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function isString(value: unknown): value is string {
  return typeof value === "string";
}

function isPayIdScheme(value: unknown): value is PayIdScheme {
  return value === "cursor" || value === "payid";
}

function parsePayee(value: unknown): ResolvedPayId | undefined {
  if (
    !isRecord(value) ||
    !isPayIdScheme(value.scheme) ||
    !isString(value.id) ||
    !isString(value.displayName) ||
    !isString(value.institution)
  ) {
    return undefined;
  }
  return {
    scheme: value.scheme,
    id: value.id,
    displayName: value.displayName,
    institution: value.institution,
  };
}

export type ParsedTransfer = {
  requestId: string;
  command: HostedTransferCommand;
};

export function parseTransfer(value: unknown): ParsedTransfer | undefined {
  if (
    !isRecord(value) ||
    !isString(value.requestId) ||
    value.requestId.length < 8 ||
    value.requestId.length > 100 ||
    !isString(value.kind) ||
    !isString(value.from) ||
    typeof value.amount !== "number" ||
    !Number.isSafeInteger(value.amount) ||
    !isString(value.description)
  ) {
    return undefined;
  }

  const amount = tokens(value.amount);
  if (value.kind === "own" && isString(value.to)) {
    return {
      requestId: value.requestId,
      command: {
        kind: "own",
        command: {
          from: accountId(value.from),
          to: accountId(value.to),
          amount,
          description: value.description,
        },
      },
    };
  }

  const payee = parsePayee(value.payee);
  if (value.kind === "payid" && payee) {
    return {
      requestId: value.requestId,
      command: {
        kind: "payid",
        command: {
          from: accountId(value.from),
          amount,
          description: value.description,
          payee,
          stepUpConfirmed: value.stepUpConfirmed === true,
        },
      },
    };
  }
  return undefined;
}

export function parseCardUpdate(
  value: unknown,
): { cardId: CardId; status: CardStatus } | undefined {
  if (
    !isRecord(value) ||
    !isString(value.cardId) ||
    (value.status !== "active" && value.status !== "frozen")
  ) {
    return undefined;
  }
  return { cardId: cardId(value.cardId), status: value.status };
}

export function parsePaymentRequestCommand(
  value: unknown,
): HostedPaymentRequestCommand | undefined {
  if (!isRecord(value) || !isString(value.action)) {
    return undefined;
  }

  if (value.action === "create") {
    if (
      !isString(value.target) ||
      typeof value.amount !== "number" ||
      !Number.isSafeInteger(value.amount) ||
      !isString(value.description)
    ) {
      return undefined;
    }
    return {
      action: "create",
      command: {
        target: value.target,
        amount: tokens(value.amount),
        description: value.description,
      },
    };
  }

  if (
    !isString(value.paymentRequestId) ||
    value.paymentRequestId.length < 4 ||
    value.paymentRequestId.length > 100
  ) {
    return undefined;
  }

  const id = paymentRequestId(value.paymentRequestId);

  if (value.action === "approve") {
    if (!isString(value.from) || value.from.length === 0) {
      return undefined;
    }
    return {
      action: "approve",
      command: {
        paymentRequestId: id,
        from: accountId(value.from),
        stepUpConfirmed: value.stepUpConfirmed === true,
      },
    };
  }

  if (value.action === "decline") {
    return {
      action: "decline",
      command: { paymentRequestId: id },
    };
  }

  if (value.action === "cancel") {
    return {
      action: "cancel",
      command: { paymentRequestId: id },
    };
  }

  return undefined;
}

export function parseContactCommand(
  value: unknown,
): HostedContactCommand | undefined {
  if (!isRecord(value) || !isString(value.action)) return undefined;

  if (value.action === "save") {
    if (
      !isString(value.handle) ||
      value.handle.length < 1 ||
      value.handle.length > 200 ||
      !isString(value.nickname) ||
      value.nickname.length > 80
    ) {
      return undefined;
    }
    return {
      action: "save",
      command: { handle: value.handle, nickname: value.nickname },
    };
  }

  if (value.action === "pin") {
    if (
      !isString(value.contactId) ||
      value.contactId.length < 4 ||
      value.contactId.length > 100 ||
      typeof value.pinned !== "boolean"
    ) {
      return undefined;
    }
    return {
      action: "pin",
      command: {
        contactId: contactId(value.contactId),
        pinned: value.pinned,
      },
    };
  }

  return undefined;
}
