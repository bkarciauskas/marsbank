import type {
  BankSnapshot,
  ContactResult,
  HostedContactCommand,
  ResolvedPayId,
  SavedContact,
  Transaction,
} from "./domain";
import type { ContactId } from "./ids";
import { demoEmail, demoResidents, type DemoResident } from "./fixtures";

export type PayIdLookup =
  { kind: "ok"; payee: ResolvedPayId } | { kind: "own" } | { kind: "invalid" };

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

export function suggestedPayIds(
  ownerEmail: string = demoEmail,
): ResolvedPayId[] {
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

const nicknameLimit = 40;

export function normalizeContactNickname(raw: string): string | undefined {
  const nickname = raw.trim().replace(/\s+/g, " ");
  if (nickname.length < 1 || nickname.length > nicknameLimit) return undefined;
  return nickname;
}

function contactKey(payee: ResolvedPayId): string {
  return normalizePayId(payee.id);
}

function withContacts(
  snapshot: BankSnapshot,
  contacts: SavedContact[],
): BankSnapshot {
  return {
    ...snapshot,
    revision: snapshot.revision + 1,
    contacts,
  };
}

export function contactsForPicker(
  contacts: readonly SavedContact[] | undefined,
): SavedContact[] {
  return [...(contacts ?? [])].sort((left, right) => {
    if (left.pinned !== right.pinned) return left.pinned ? -1 : 1;
    return right.savedAt.localeCompare(left.savedAt);
  });
}

export function recentPayeeCounterparties(
  transactions: readonly Transaction[],
  contacts: readonly SavedContact[] | undefined = [],
  limit = 6,
): ResolvedPayId[] {
  const saved = new Set(
    (contacts ?? []).map((contact) => contactKey(contact.payee)),
  );
  const seen = new Set<string>();
  const recent: ResolvedPayId[] = [];
  for (const txn of transactions) {
    if (txn.direction !== "debit" || !txn.payee) continue;
    const key = contactKey(txn.payee);
    if (!key || seen.has(key) || saved.has(key)) continue;
    seen.add(key);
    recent.push(txn.payee);
    if (recent.length >= limit) break;
  }
  return recent;
}

export function applyContactCommand(
  snapshot: BankSnapshot,
  ownerEmail: string,
  command: HostedContactCommand,
  issued: { id: ContactId; savedAt: string },
): ContactResult {
  const contacts = snapshot.contacts ?? [];

  if (command.action === "pin") {
    const existing = contacts.find(
      (contact) => contact.id === command.command.contactId,
    );
    if (!existing) return { kind: "unknown-contact" };
    const contact: SavedContact = {
      ...existing,
      pinned: command.command.pinned,
    };
    return {
      kind: "ok",
      contact,
      snapshot: withContacts(
        snapshot,
        contacts.map((entry) => (entry.id === contact.id ? contact : entry)),
      ),
    };
  }

  const nickname = normalizeContactNickname(command.command.nickname);
  if (!nickname) return { kind: "invalid-nickname" };

  const lookup = lookupPayId(command.command.handle, ownerEmail);
  if (lookup.kind === "invalid") return { kind: "invalid-payid" };
  if (lookup.kind === "own") return { kind: "own-payid" };

  const key = contactKey(lookup.payee);
  const existing = contacts.find(
    (contact) => contactKey(contact.payee) === key,
  );
  const contact: SavedContact = existing
    ? { ...existing, nickname, payee: lookup.payee }
    : {
        id: issued.id,
        nickname,
        payee: lookup.payee,
        pinned: false,
        savedAt: issued.savedAt,
      };
  const next = existing
    ? contacts.map((entry) => (entry.id === contact.id ? contact : entry))
    : [contact, ...contacts];
  return { kind: "ok", contact, snapshot: withContacts(snapshot, next) };
}

function titleFromHandle(value: string): string {
  const words = value
    .replace(/^@/, "")
    .split(/[._-]+/)
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1));
  return words.join(" ") || value;
}
