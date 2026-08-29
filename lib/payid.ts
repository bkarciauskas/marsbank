import type { ResolvedPayId } from "./domain";
import { demoEmail, demoResidents } from "./fixtures";

export type PayIdLookup =
  | { kind: "ok"; payee: ResolvedPayId }
  | { kind: "own" }
  | { kind: "invalid" };

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

function titleFromHandle(value: string): string {
  const words = value
    .replace(/^@/, "")
    .split(/[._-]+/)
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1));
  return words.join(" ") || value;
}
