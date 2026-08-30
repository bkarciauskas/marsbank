import type { BankSnapshot, Transaction, TxnDirection } from "./domain";
import { accountId, cardId, customerId, txnId, type AccountId } from "./ids";
import { tokens } from "./money";

const BILLION = 1_000_000_000;

/** Seed each deposit so every demo resident is a token billionaire. */
function fortune(base: number, billions = 1): number {
  return billions * BILLION + base;
}

export const DEMO_CREDIT_LIMIT = 50_000_000;

export type DemoResident = {
  slug: string;
  givenName: string;
  familyName: string;
  email: string;
  password: string;
  memberId: string;
  initials: string;
  habitat: string;
  everyday: number;
  reserve: number;
  offset: number;
  creditOwed: number;
  loanPrincipal: number;
  loanRemaining: number;
  everydayNumber: string;
  reserveNumber: string;
  offsetNumber: string;
  loanNumber: string;
  creditLast4: string;
  everydayLast4: string;
};

const cameron: DemoResident = {
  slug: "cameron",
  givenName: "Cameron",
  familyName: "Huysmans",
  email: "cameron@marsbank.mars",
  password: "Olympus!2026",
  memberId: "MB-104821",
  initials: "CH",
  habitat: "Olympus Arc Habitat",
  everyday: fortune(184_220),
  reserve: fortune(1_840_000, 2),
  offset: fortune(620_400),
  creditOwed: 82_640,
  loanPrincipal: 42_000_000_000,
  loanRemaining: 36_400_000_000,
  everydayNumber: "1038 4821",
  reserveNumber: "2047 1903",
  offsetNumber: "4410 8732",
  loanNumber: "7702 0418",
  everydayLast4: "4821",
  creditLast4: "9072",
};

export const demoResidents: readonly DemoResident[] = [
  cameron,
  {
    slug: "aaron",
    givenName: "Aaron",
    familyName: "Vale",
    email: "aaron@marsbank.mars",
    password: "Tharsis!2026",
    memberId: "MB-110274",
    initials: "AV",
    habitat: "Tharsis Rise Habitat",
    everyday: fortune(96_410),
    reserve: fortune(2_410_000, 2),
    offset: fortune(880_200),
    creditOwed: 24_180,
    loanPrincipal: 38_500_000_000,
    loanRemaining: 31_200_000_000,
    everydayNumber: "1184 2209",
    reserveNumber: "3301 7740",
    offsetNumber: "5528 0194",
    loanNumber: "7611 3088",
    everydayLast4: "2209",
    creditLast4: "4418",
  },
  {
    slug: "ben",
    givenName: "Ben",
    familyName: "Kite",
    email: "ben@marsbank.mars",
    password: "Jezero!2026",
    memberId: "MB-118903",
    initials: "BK",
    habitat: "Jezero Rim Habitat",
    everyday: fortune(312_750),
    reserve: fortune(940_000, 2),
    offset: fortune(410_600),
    creditOwed: 118_440,
    loanPrincipal: 29_800_000_000,
    loanRemaining: 24_150_000_000,
    everydayNumber: "2091 5563",
    reserveNumber: "4012 8831",
    offsetNumber: "6104 2290",
    loanNumber: "7904 6612",
    everydayLast4: "5563",
    creditLast4: "7721",
  },
  {
    slug: "richard",
    givenName: "Richard",
    familyName: "Shaw",
    email: "richard@marsbank.mars",
    password: "Valles!2026",
    memberId: "MB-102447",
    initials: "RS",
    habitat: "Valles Lift Habitat",
    everyday: fortune(54_880),
    reserve: fortune(3_260_000, 2),
    offset: fortune(1_120_000),
    creditOwed: 9_320,
    loanPrincipal: 51_000_000_000,
    loanRemaining: 44_800_000_000,
    everydayNumber: "1440 9082",
    reserveNumber: "2771 6405",
    offsetNumber: "4882 1157",
    loanNumber: "7019 3340",
    everydayLast4: "9082",
    creditLast4: "2264",
  },
  {
    slug: "robin",
    givenName: "Robin",
    familyName: "Hale",
    email: "robin@marsbank.mars",
    password: "Hellas!2026",
    memberId: "MB-125610",
    initials: "RH",
    habitat: "Hellas Basin Habitat",
    everyday: fortune(221_040),
    reserve: fortune(1_150_000, 2),
    offset: fortune(505_900),
    creditOwed: 67_200,
    loanPrincipal: 33_400_000_000,
    loanRemaining: 27_960_000_000,
    everydayNumber: "1755 3018",
    reserveNumber: "2980 4471",
    offsetNumber: "5233 8602",
    loanNumber: "7488 1906",
    everydayLast4: "3018",
    creditLast4: "5590",
  },
  {
    slug: "blake",
    givenName: "Blake",
    familyName: "Quinn",
    email: "blake@marsbank.mars",
    password: "Elysium!2026",
    memberId: "MB-131082",
    initials: "BQ",
    habitat: "Elysium Court Habitat",
    everyday: fortune(148_660),
    reserve: fortune(760_500, 2),
    offset: fortune(2_040_000),
    creditOwed: 41_070,
    loanPrincipal: 46_200_000_000,
    loanRemaining: 39_100_000_000,
    everydayNumber: "1902 7745",
    reserveNumber: "3644 0188",
    offsetNumber: "5801 2263",
    loanNumber: "7126 4491",
    everydayLast4: "7745",
    creditLast4: "3187",
  },
];

export const defaultDemoResident = cameron;
export const demoEmail = cameron.email;
export const demoPassword = cameron.password;
export const demoMemberId = cameron.memberId;

export function isDemoSlug(value: string | undefined): value is string {
  return demoResidents.some((resident) => resident.slug === value);
}

export function demoResidentBySlug(slug: string): DemoResident | undefined {
  return demoResidents.find((resident) => resident.slug === slug);
}

export function authenticateDemo(
  email: unknown,
  password: unknown,
): DemoResident | undefined {
  if (typeof email !== "string" || typeof password !== "string") {
    return undefined;
  }
  return demoResidents.find(
    (resident) => resident.email === email && resident.password === password,
  );
}

type SeedAccount = "everyday" | "reserve" | "offset" | "credit";

type SeedMovement = {
  id: string;
  account: SeedAccount;
  postedOn: string;
  description: string;
  amount: number;
  direction: TxnDirection;
  counterparty?: SeedAccount;
};

const seedMovements: readonly SeedMovement[] = [
  {
    id: "txn-001",
    account: "everyday",
    postedOn: "2026-08-25T11:20:00.000Z",
    description: "Areology Coffee · {habitat} Concourse",
    amount: 1_240,
    direction: "debit",
  },
  {
    id: "txn-002",
    account: "everyday",
    postedOn: "2026-08-24T08:00:00.000Z",
    description: "Terraform Cooperative Payroll",
    amount: 48_000,
    direction: "credit",
  },
  {
    id: "txn-003",
    account: "credit",
    postedOn: "2026-08-23T18:42:00.000Z",
    description: "Valles Lift Transit",
    amount: 8_960,
    direction: "debit",
  },
  {
    id: "txn-004",
    account: "offset",
    postedOn: "2026-08-22T04:15:00.000Z",
    description: "Habitat 12 · Air and Water",
    amount: 12_400,
    direction: "debit",
  },
  {
    id: "txn-007",
    account: "everyday",
    postedOn: "2026-08-21T10:15:00.000Z",
    description: "South Gate Rover",
    amount: 4_500,
    direction: "debit",
  },
  {
    id: "txn-005",
    account: "reserve",
    postedOn: "2026-08-20T07:30:00.000Z",
    description: "Transfer from Sol Account",
    amount: 35_000,
    direction: "credit",
    counterparty: "everyday",
  },
  {
    id: "txn-006",
    account: "everyday",
    postedOn: "2026-08-20T07:30:00.000Z",
    description: "Transfer to Long Horizon Reserve",
    amount: 35_000,
    direction: "debit",
    counterparty: "reserve",
  },
  {
    id: "txn-008",
    account: "everyday",
    postedOn: "2026-08-19T09:10:00.000Z",
    description: "Arc Canteen · midday tray",
    amount: 2_180,
    direction: "debit",
  },
  {
    id: "txn-009",
    account: "everyday",
    postedOn: "2026-08-18T07:00:00.000Z",
    description: "Cooperative field bonus",
    amount: 6_000,
    direction: "credit",
  },
  {
    id: "txn-010",
    account: "credit",
    postedOn: "2026-08-17T16:40:00.000Z",
    description: "Rim tram day pass",
    amount: 640,
    direction: "debit",
  },
  {
    id: "txn-011",
    account: "offset",
    postedOn: "2026-08-16T05:00:00.000Z",
    description: "Power levy · habitat ring",
    amount: 9_800,
    direction: "debit",
  },
  {
    id: "txn-012",
    account: "everyday",
    postedOn: "2026-08-15T12:22:00.000Z",
    description: "Greenhouse greens share",
    amount: 1_540,
    direction: "debit",
  },
  {
    id: "txn-013",
    account: "everyday",
    postedOn: "2026-08-14T08:00:00.000Z",
    description: "Terraform Cooperative Payroll",
    amount: 48_000,
    direction: "credit",
  },
  {
    id: "txn-014",
    account: "credit",
    postedOn: "2026-08-13T19:05:00.000Z",
    description: "North ridge rover hire",
    amount: 3_200,
    direction: "debit",
  },
  {
    id: "txn-015",
    account: "offset",
    postedOn: "2026-08-12T04:15:00.000Z",
    description: "Habitat 12 · Air and Water",
    amount: 12_400,
    direction: "debit",
  },
  {
    id: "txn-016",
    account: "everyday",
    postedOn: "2026-08-10T14:30:00.000Z",
    description: "Survey pin replacement",
    amount: 890,
    direction: "debit",
  },
  {
    id: "txn-017",
    account: "everyday",
    postedOn: "2026-08-09T08:00:00.000Z",
    description: "Night-shift bonus",
    amount: 4_500,
    direction: "credit",
  },
  {
    id: "txn-018",
    account: "everyday",
    postedOn: "2026-08-08T09:40:00.000Z",
    description: "Areology Coffee · lock antechamber",
    amount: 1_180,
    direction: "debit",
  },
  {
    id: "txn-019",
    account: "reserve",
    postedOn: "2026-08-06T07:30:00.000Z",
    description: "Transfer from Sol Account",
    amount: 20_000,
    direction: "credit",
    counterparty: "everyday",
  },
  {
    id: "txn-020",
    account: "everyday",
    postedOn: "2026-08-06T07:30:00.000Z",
    description: "Transfer to Long Horizon Reserve",
    amount: 20_000,
    direction: "debit",
    counterparty: "reserve",
  },
  {
    id: "txn-021",
    account: "everyday",
    postedOn: "2026-08-11T08:00:00.000Z",
    description: "Terraform Cooperative Payroll",
    amount: 48_000,
    direction: "credit",
  },
  {
    id: "txn-022",
    account: "everyday",
    postedOn: "2026-08-07T15:40:00.000Z",
    description: "Areology Coffee · night watch",
    amount: 980,
    direction: "debit",
  },
  {
    id: "txn-023",
    account: "credit",
    postedOn: "2026-08-05T17:18:00.000Z",
    description: "Valles Lift Transit",
    amount: 2_100,
    direction: "debit",
  },
  {
    id: "txn-024",
    account: "offset",
    postedOn: "2026-08-05T05:10:00.000Z",
    description: "Power levy · habitat ring",
    amount: 9_800,
    direction: "debit",
  },
  {
    id: "txn-025",
    account: "offset",
    postedOn: "2026-08-07T06:00:00.000Z",
    description: "Habitat 9 · Air and Water",
    amount: 12_400,
    direction: "debit",
  },
  {
    id: "txn-026",
    account: "everyday",
    postedOn: "2026-08-11T11:05:00.000Z",
    description: "Arc Canteen · night tray",
    amount: 1_760,
    direction: "debit",
  },
  {
    id: "txn-027",
    account: "everyday",
    postedOn: "2026-08-07T13:20:00.000Z",
    description: "Greenhouse greens share",
    amount: 2_100,
    direction: "debit",
  },
  {
    id: "txn-028",
    account: "everyday",
    postedOn: "2026-08-05T08:00:00.000Z",
    description: "Terraform Cooperative Payroll",
    amount: 48_000,
    direction: "credit",
  },
  {
    id: "txn-029",
    account: "credit",
    postedOn: "2026-08-05T18:00:00.000Z",
    description: "Rim tram night pass",
    amount: 720,
    direction: "debit",
  },
  {
    id: "txn-030",
    account: "offset",
    postedOn: "2026-08-05T04:15:00.000Z",
    description: "Habitat ring dust seal",
    amount: 3_640,
    direction: "debit",
  },
];

function postedTransactions(
  resident: DemoResident,
  accounts: Record<SeedAccount, AccountId>,
): Transaction[] {
  const habitatWord = resident.habitat.split(" ")[0] ?? resident.habitat;
  return seedMovements
    .map((row) => ({
      id: txnId(row.id),
      accountId: accounts[row.account],
      postedOn: row.postedOn,
      description: row.description.replace("{habitat}", habitatWord),
      amount: tokens(row.amount),
      direction: row.direction,
      ...(row.counterparty
        ? { counterpartyAccountId: accounts[row.counterparty] }
        : {}),
    }))
    .sort((left, right) => {
      const byPosted = Date.parse(right.postedOn) - Date.parse(left.postedOn);
      return byPosted !== 0
        ? byPosted
        : left.id.localeCompare(right.id);
    });
}

export function snapshotForResident(resident: DemoResident): BankSnapshot {
  const everydayId = accountId("acc-everyday");
  const reserveId = accountId("acc-reserve");
  const offsetId = accountId("acc-offset");
  const creditId = accountId("acc-credit");
  const loanId = accountId("acc-habitat-loan");
  const holderName = `${resident.givenName} ${resident.familyName}`.toUpperCase();

  return {
    customer: {
      id: customerId(`customer-${resident.slug}`),
      email: resident.email,
      displayName: resident.givenName,
      memberId: resident.memberId,
      initials: resident.initials,
    },
    revision: 3,
    accounts: [
      {
        kind: "loan",
        id: loanId,
        name: resident.habitat,
        productName: "Mars Bank Horizon Habitat Loan",
        branch: "MARS-001",
        number: resident.loanNumber,
        openedOn: "2025-01-19",
        principal: tokens(resident.loanPrincipal),
        remaining: tokens(resident.loanRemaining),
      },
      {
        kind: "offset",
        id: everydayId,
        name: "Sol Account",
        productName: "Mars Bank Sol Offset Account",
        branch: "MARS-001",
        number: resident.everydayNumber,
        openedOn: "2024-02-12",
        available: tokens(resident.everyday),
        current: tokens(resident.everyday),
        linkedLoanId: loanId,
      },
      {
        kind: "offset",
        id: reserveId,
        name: "Long Horizon Reserve",
        productName: "Mars Bank Long Horizon Offset Reserve",
        branch: "MARS-001",
        number: resident.reserveNumber,
        openedOn: "2024-05-04",
        available: tokens(resident.reserve),
        current: tokens(resident.reserve),
        linkedLoanId: loanId,
      },
      {
        kind: "offset",
        id: offsetId,
        name: "Habitat Offset",
        productName: "Mars Bank Habitat Offset Reserve",
        branch: "MARS-001",
        number: resident.offsetNumber,
        openedOn: "2025-01-19",
        available: tokens(resident.offset),
        current: tokens(resident.offset),
        linkedLoanId: loanId,
      },
      {
        kind: "credit",
        id: creditId,
        name: "Expedition Credit",
        productName: "Mars Bank Expedition Credit Line",
        branch: "MARS-001",
        number: `•••• ${resident.creditLast4}`,
        openedOn: "2025-03-01",
        limit: tokens(DEMO_CREDIT_LIMIT),
        owed: tokens(resident.creditOwed),
      },
    ],
    cards: [
      {
        id: cardId("card-everyday"),
        accountId: everydayId,
        last4: resident.everydayLast4,
        holderName,
        expiry: "09/30",
        status: "active",
        form: "physical",
      },
      {
        id: cardId("card-credit"),
        accountId: creditId,
        last4: resident.creditLast4,
        holderName,
        expiry: "03/31",
        status: "active",
        form: "virtual",
      },
    ],
    transactions: postedTransactions(resident, {
      everyday: everydayId,
      reserve: reserveId,
      offset: offsetId,
      credit: creditId,
    }),
  };
}

export const seedSnapshot: BankSnapshot = snapshotForResident(cameron);

export function seedSnapshotForSlug(slug: string): BankSnapshot {
  const resident = demoResidentBySlug(slug) ?? cameron;
  return snapshotForResident(resident);
}
