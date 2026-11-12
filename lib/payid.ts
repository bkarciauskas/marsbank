import type {
  BankSnapshot,
  Contact,
  ContactResult,
  HostedContactCommand,
  ResolvedPayId,
  Transaction,
} from "./domain";
import { demoEmail, demoResidents, type DemoResident } from "./fixtures";
import type { ContactId } from "./ids";

export type PayIdLookup =
  | { kind: "ok"; payee: ResolvedPayId }
  | { kind: "own" }
  | { kind: "invalid" };

export type ResidentPayIdLookup =
  | { kind: "ok"; resident: DemoResident; payee: ResolvedPayId }
  | { kind: "own" }
  | { kind: "unknown-resident" }
  | { kind: "invalid" };

export type ResidentHandleSuggestion = {
  slug: string;
  handle: string;
  email: string;
  displayName: string;
};

type DirectoryEntry = {
  aliases: readonly string[];
  payee: ResolvedPayId;
};

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const handlePattern = /^@?[a-z0-9._-]{2,32}$/;

const directory: DirectoryEntry[] = [
  {
    aliases: ["@cursor", "cursor", "team@cursor.com", "cursor@cursor.com"],
    payee: {
      scheme: "cursor",
      id: "@cursor",
      displayName: "Cursor",
      institution: "Cursor",
    },
  },
  {
    aliases: ["@anysphere", "anysphere", "anysphere@cursor.com"],
    payee: {
      scheme: "cursor",
      id: "@anysphere",
      displayName: "Anysphere",
      institution: "Cursor",
    },
  },
  {
    aliases: ["@spacexai", "spacexai", "spacexai@cursor.com"],
    payee: {
      scheme: "cursor",
      id: "@spacexai",
      displayName: "SpaceXAI",
      institution: "Cursor",
    },
  },
];

export function normalizePayId(raw: string): string {
  return raw.trim().toLowerCase().replace(/\s+/g, "");
}

function ownAliases(ownerEmail: string): Set<string> {
  const owner = demoResidents.find(
    (resident) => normalizePayId(resident.email) === normalizePayId(ownerEmail),
  );
  if (!owner) {
    return new Set([normalizePayId(ownerEmail)]);
  }
  return new Set([
    normalizePayId(owner.email),
    `@${owner.slug}`,
    owner.slug,
    `customer-${owner.slug}`,
  ]);
}

function residentPayee(email: string, displayName: string): ResolvedPayId {
  return {
    scheme: "payid",
    id: email,
    displayName,
    institution: "Mars Bank",
  };
}

export function suggestedPayIds(ownerEmail: string = demoEmail): ResolvedPayId[] {
  const residents = demoResidents
    .filter((resident) => resident.email !== ownerEmail)
    .map((resident) => residentPayee(resident.email, resident.givenName));
  return [...directory.map((entry) => entry.payee), ...residents];
}

export function suggestedResidentHandles(
  ownerEmail: string = demoEmail,
): ResidentHandleSuggestion[] {
  const normalizedOwner = normalizePayId(ownerEmail);
  return demoResidents
    .filter((resident) => normalizePayId(resident.email) !== normalizedOwner)
    .map((resident) => ({
      slug: resident.slug,
      handle: `@${resident.slug}`,
      email: resident.email,
      displayName: resident.givenName,
    }));
}

export function lookupResidentPayId(
  raw: string,
  ownerEmail: string = demoEmail,
): ResidentPayIdLookup {
  const id = normalizePayId(raw);
  if (!id) return { kind: "invalid" };
  if (ownAliases(ownerEmail).has(id)) return { kind: "own" };

  const resident = demoResidents.find((entry) => {
    const email = normalizePayId(entry.email);
    return id === email || id === entry.slug || id === `@${entry.slug}`;
  });
  if (resident) {
    return {
      kind: "ok",
      resident,
      payee: residentPayee(resident.email, resident.givenName),
    };
  }

  if (emailPattern.test(id) || handlePattern.test(id)) {
    return { kind: "unknown-resident" };
  }

  return { kind: "invalid" };
}

export function lookupPayId(
  raw: string,
  ownerEmail: string = demoEmail,
): PayIdLookup {
  const id = normalizePayId(raw);
  if (!id) return { kind: "invalid" };
  if (ownAliases(ownerEmail).has(id)) return { kind: "own" };

  const listed = directory.find((entry) => entry.aliases.includes(id));
  if (listed) return { kind: "ok", payee: listed.payee };

  const resident = demoResidents.find((entry) => {
    const email = normalizePayId(entry.email);
    return id === email || id === entry.slug || id === `@${entry.slug}`;
  });
  if (resident) {
    return {
      kind: "ok",
      payee: residentPayee(resident.email, resident.givenName),
    };
  }

  if (emailPattern.test(id)) {
    const domain = id.slice(id.lastIndexOf("@") + 1);
    const cursorHosted = domain === "cursor.com" || domain === "anysphere.com";
    return {
      kind: "ok",
      payee: {
        scheme: cursorHosted ? "cursor" : "payid",
        id,
        displayName: titleFromHandle(id.slice(0, id.indexOf("@"))),
        institution: cursorHosted ? "Cursor" : "PayID",
      },
    };
  }

  if (handlePattern.test(id)) {
    const handle = id.startsWith("@") ? id : `@${id}`;
    return {
      kind: "ok",
      payee: {
        scheme: "cursor",
        id: handle,
        displayName: titleFromHandle(handle),
        institution: "Cursor",
      },
    };
  }

  return { kind: "invalid" };
}

export function payIdLabel(payee: ResolvedPayId): string {
  return payee.scheme === "cursor" ? "Cursor account" : "PayID";
}

const nicknameMaxLength = 40;

function cleanedNickname(raw: string): string | undefined {
  const nickname = raw.trim().replace(/\s+/g, " ");
  if (!nickname || nickname.length > nicknameMaxLength) return undefined;
  return nickname;
}

export function orderedContacts(contacts: readonly Contact[]): Contact[] {
  return [...contacts].sort((left, right) => {
    if (left.pinned !== right.pinned) return left.pinned ? -1 : 1;
    return (
      right.savedAt.localeCompare(left.savedAt) ||
      left.nickname.localeCompare(right.nickname)
    );
  });
}

export function recentCounterparties(
  transactions: readonly Transaction[],
  ownerEmail: string,
  saved: readonly Contact[] = [],
  limit = 6,
): ResolvedPayId[] {
  const savedKeys = new Set(
    saved.map((contact) => normalizePayId(contact.payee.id)),
  );
  const seen = new Set<string>();
  const recent: ResolvedPayId[] = [];
  const ordered = transactions
    .filter((txn) => txn.payee !== undefined)
    .slice()
    .sort((left, right) => right.postedOn.localeCompare(left.postedOn));

  for (const txn of ordered) {
    if (!txn.payee) continue;
    const key = normalizePayId(txn.payee.id);
    if (!key || seen.has(key) || savedKeys.has(key)) continue;
    const lookup = lookupPayId(txn.payee.id, ownerEmail);
    if (lookup.kind !== "ok") continue;
    seen.add(key);
    recent.push(lookup.payee);
    if (recent.length >= limit) break;
  }

  return recent;
}

export function applyContactCommand(
  snapshot: BankSnapshot,
  command: HostedContactCommand,
  now: Date,
  nextId: ContactId,
): ContactResult {
  const contacts = snapshot.contacts ?? [];

  if (command.action === "pin") {
    const existing = contacts.find(
      (contact) => contact.id === command.command.contactId,
    );
    if (!existing) return { kind: "unknown-contact" };
    const contact: Contact = { ...existing, pinned: command.command.pinned };
    return {
      kind: "ok",
      contact,
      snapshot: {
        ...snapshot,
        revision: snapshot.revision + 1,
        contacts: contacts.map((entry) =>
          entry.id === contact.id ? contact : entry,
        ),
      },
    };
  }

  const nickname = cleanedNickname(command.command.nickname);
  if (!nickname) return { kind: "invalid-nickname" };

  const lookup = lookupPayId(command.command.handle, snapshot.customer.email);
  if (lookup.kind === "invalid") return { kind: "invalid-payid" };
  if (lookup.kind === "own") return { kind: "own-payid" };

  const key = normalizePayId(lookup.payee.id);
  const existing = contacts.find(
    (contact) => normalizePayId(contact.payee.id) === key,
  );
  const contact: Contact = existing
    ? { ...existing, nickname, payee: lookup.payee }
    : {
        id: nextId,
        nickname,
        payee: lookup.payee,
        pinned: false,
        savedAt: now.toISOString(),
      };

  return {
    kind: "ok",
    contact,
    snapshot: {
      ...snapshot,
      revision: snapshot.revision + 1,
      contacts: existing
        ? contacts.map((entry) => (entry.id === existing.id ? contact : entry))
        : [contact, ...contacts],
    },
  };
}

function titleFromHandle(value: string): string {
  const words = value
    .replace(/^@/, "")
    .split(/[._-]+/)
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1));
  return words.join(" ") || value;
}
