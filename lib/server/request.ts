import type { NextRequest } from "next/server";
import type {
  CardStatus,
  HostedTransferCommand,
  PayIdScheme,
  ResolvedPayId,
} from "../domain";
import { isDemoSlug } from "../fixtures";
import { accountId, cardId, type CardId } from "../ids";
import { tokens } from "../money";

export function authenticatedResident(request: NextRequest): string | undefined {
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
