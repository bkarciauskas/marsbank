import { describe, expect, it } from "vitest";
import type { Account, Transaction } from "./domain";
import { accountId, txnId } from "./ids";
import { tokens } from "./money";
import { statementCsv } from "./statement-csv";

const HEADER =
  '"Posted (UTC)","Account","Description","Debit (MT)","Credit (MT)","Counterparty","Transaction ID"';

const everyday: Account = {
  kind: "transaction",
  id: accountId("acc-everyday"),
  name: "Sol Account",
  productName: "Mars Bank Sol Offset Account",
  branch: "MARS-001",
  number: "1038 4821",
  openedOn: "2024-02-12",
  available: tokens(0),
  current: tokens(0),
};

const reserve: Account = {
  kind: "savings",
  id: accountId("acc-reserve"),
  name: "Long Horizon Reserve",
  productName: "Mars Bank Long Horizon Offset Reserve",
  branch: "MARS-001",
  number: "2047 1903",
  openedOn: "2024-05-04",
  available: tokens(0),
  current: tokens(0),
};

function movement(
  fields: Omit<Transaction, "accountId"> & { accountId?: Transaction["accountId"] },
): Transaction {
  return {
    accountId: accountId("acc-everyday"),
    ...fields,
  };
}

describe("statementCsv", () => {
  it("writes BOM, quoted headers, CRLF, and a trailing CRLF", () => {
    const file = statementCsv({ transactions: [], accounts: [everyday] });

    expect(file.body.startsWith("\uFEFF")).toBe(true);
    expect(file.body).toBe(`\uFEFF${HEADER}\r\n`);
    expect(file.filename).toBe("mars-bank-statement.csv");
  });

  it("places debit and credit as bare integers in their own columns", () => {
    const file = statementCsv({
      accounts: [everyday],
      transactions: [
        movement({
          id: txnId("txn-debit"),
          postedOn: "2026-10-20T12:00:00.000Z",
          description: "Areology Coffee",
          amount: tokens(1_240),
          direction: "debit",
        }),
        movement({
          id: txnId("txn-credit"),
          postedOn: "2026-10-03T08:00:00.000Z",
          description: "Payroll",
          amount: tokens(48_000),
          direction: "credit",
        }),
      ],
    });

    expect(file.body).toBe(
      "\uFEFF" +
        HEADER +
        "\r\n" +
        '"2026-10-20T12:00:00.000Z","Sol Account","Areology Coffee",1240,,"","txn-debit"\r\n' +
        '"2026-10-03T08:00:00.000Z","Sol Account","Payroll",,48000,"","txn-credit"\r\n',
    );
  });

  it("writes a large token amount ungrouped", () => {
    const file = statementCsv({
      accounts: [everyday],
      transactions: [
        movement({
          id: txnId("txn-large"),
          postedOn: "2026-10-20T12:00:00.000Z",
          description: "Habitat levy",
          amount: tokens(12_400),
          direction: "debit",
        }),
      ],
    });

    expect(file.body).toContain(",12400,");
    expect(file.body).not.toContain("12,400");
  });

  it("uses the account name and falls back when the account is missing", () => {
    const known = statementCsv({
      accounts: [everyday],
      transactions: [
        movement({
          id: txnId("txn-known"),
          postedOn: "2026-10-20T12:00:00.000Z",
          description: "Known",
          amount: tokens(20),
          direction: "debit",
        }),
      ],
    });
    const unknown = statementCsv({
      accounts: [everyday],
      transactions: [
        movement({
          id: txnId("txn-unknown"),
          accountId: accountId("acc-missing"),
          postedOn: "2026-10-20T12:00:00.000Z",
          description: "Missing",
          amount: tokens(20),
          direction: "debit",
        }),
      ],
    });

    expect(known.body).toContain('"Sol Account"');
    expect(unknown.body).toContain('"Unknown account"');
  });

  it("labels an own-account transfer and a PayID payee as counterparty", () => {
    const file = statementCsv({
      accounts: [everyday, reserve],
      transactions: [
        movement({
          id: txnId("txn-transfer"),
          postedOn: "2026-10-20T12:00:00.000Z",
          description: "Transfer to Long Horizon Reserve",
          amount: tokens(35_000),
          direction: "debit",
          counterpartyAccountId: accountId("acc-reserve"),
        }),
        movement({
          id: txnId("txn-payid"),
          postedOn: "2026-10-19T12:00:00.000Z",
          description: "Cursor seat",
          amount: tokens(2_500),
          direction: "debit",
          payee: {
            scheme: "cursor",
            id: "@cursor",
            displayName: "Cursor",
            institution: "Cursor",
          },
        }),
      ],
    });

    expect(file.body).toContain('"Long Horizon Reserve","txn-transfer"');
    expect(file.body).toContain('"Cursor (Cursor)","txn-payid"');
  });

  it("quotes commas, doubled quotes, and newlines in the description", () => {
    const file = statementCsv({
      accounts: [everyday],
      transactions: [
        movement({
          id: txnId("txn-quoted"),
          postedOn: "2026-10-20T12:00:00.000Z",
          description: 'Coffee, "special",\nsecond line',
          amount: tokens(20),
          direction: "debit",
        }),
      ],
    });

    expect(file.body).toContain(
      '"Coffee, ""special"",\nsecond line",20,,"","txn-quoted"',
    );
  });

  it("prefixes formula text with a quote, including after leading spaces, TAB, and CR", () => {
    const cases: readonly { id: string; description: string; encoded: string }[] = [
      { id: "txn-eq", description: "=1+1", encoded: `"'=1+1"` },
      { id: "txn-plus", description: "+1+1", encoded: `"'+1+1"` },
      { id: "txn-minus", description: "-SUM(A1)", encoded: `"'-SUM(A1)"` },
      { id: "txn-at", description: "@SUM(A1)", encoded: `"'@SUM(A1)"` },
      { id: "txn-spaced", description: "  =1+1", encoded: `"'  =1+1"` },
      { id: "txn-tab", description: "\t=1+1", encoded: `"'\t=1+1"` },
      { id: "txn-cr", description: "\r=1+1", encoded: `"'\r=1+1"` },
    ];

    for (const row of cases) {
      const file = statementCsv({
        accounts: [everyday],
        transactions: [
          movement({
            id: txnId(row.id),
            postedOn: "2026-10-20T12:00:00.000Z",
            description: row.description,
            amount: tokens(20),
            direction: "debit",
          }),
        ],
      });
      expect(file.body).toContain(`${row.encoded},20,,`);
    }
  });

  it("does not prefix a numeric debit with a quote", () => {
    const file = statementCsv({
      accounts: [everyday],
      transactions: [
        movement({
          id: txnId("txn-twenty"),
          postedOn: "2026-10-20T12:00:00.000Z",
          description: "Twenty",
          amount: tokens(20),
          direction: "debit",
        }),
      ],
    });

    expect(file.body).toContain(",20,,");
    expect(file.body).not.toContain(",'20");
    expect(file.body).not.toContain(`"'20`);
  });

  it("names the file from the UTC date range, or a single date when they match", () => {
    const range = statementCsv({
      accounts: [everyday],
      transactions: [
        movement({
          id: txnId("txn-new"),
          postedOn: "2026-10-20T12:00:00.000Z",
          description: "New",
          amount: tokens(1),
          direction: "debit",
        }),
        movement({
          id: txnId("txn-old"),
          postedOn: "2026-09-30T08:00:00.000Z",
          description: "Old",
          amount: tokens(1),
          direction: "debit",
        }),
      ],
    });
    const single = statementCsv({
      accounts: [everyday],
      transactions: [
        movement({
          id: txnId("txn-a"),
          postedOn: "2026-10-03T12:00:00.000Z",
          description: "A",
          amount: tokens(1),
          direction: "debit",
        }),
        movement({
          id: txnId("txn-b"),
          postedOn: "2026-10-03T18:00:00.000Z",
          description: "B",
          amount: tokens(1),
          direction: "credit",
        }),
      ],
    });

    expect(range.filename).toBe("mars-bank-statement-2026-09-30-to-2026-10-20.csv");
    expect(single.filename).toBe("mars-bank-statement-2026-10-03.csv");
  });
});
