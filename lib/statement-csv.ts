import type { Account, Transaction } from "./domain";
import type { TxnId } from "./ids";
import type { TokenAmount } from "./money";

export type StatementCsv = {
  filename: string;
  body: string;
};

export function statementCsv(input: {
  transactions: readonly Transaction[];
  accounts: readonly Account[];
}): StatementCsv {
  const rows = statementRows(input.transactions, input.accounts);
  const lines = [
    COLUMNS.map((column) => column.header),
    ...rows.map((row) => COLUMNS.map((column) => column.cell(row))),
  ];
  const body =
    "\uFEFF" +
    lines.map((cells) => cells.map(encodeCell).join(",")).join("\r\n") +
    "\r\n";
  return { filename: statementFilename(input.transactions), body };
}

type StatementRow = {
  postedOn: string;
  account: string;
  description: string;
  debit: TokenAmount | null;
  credit: TokenAmount | null;
  counterparty: string;
  id: TxnId;
};

type Cell = string | number | null;

type Column = {
  header: string;
  cell: (row: StatementRow) => Cell;
};

const COLUMNS: readonly Column[] = [
  { header: "Posted (UTC)", cell: (row) => row.postedOn },
  { header: "Account", cell: (row) => row.account },
  { header: "Description", cell: (row) => row.description },
  { header: "Debit (MT)", cell: (row) => row.debit },
  { header: "Credit (MT)", cell: (row) => row.credit },
  { header: "Counterparty", cell: (row) => row.counterparty },
  { header: "Transaction ID", cell: (row) => row.id },
];

function statementRows(
  transactions: readonly Transaction[],
  accounts: readonly Account[],
): StatementRow[] {
  return transactions.map((transaction) => ({
    postedOn: transaction.postedOn,
    account: accountName(accounts, transaction.accountId),
    description: transaction.description,
    debit: transaction.direction === "debit" ? transaction.amount : null,
    credit: transaction.direction === "credit" ? transaction.amount : null,
    counterparty: counterpartyLabel(accounts, transaction),
    id: transaction.id,
  }));
}

function accountName(
  accounts: readonly Account[],
  id: Transaction["accountId"],
): string {
  return accounts.find((account) => account.id === id)?.name ?? "Unknown account";
}

function counterpartyLabel(
  accounts: readonly Account[],
  transaction: Transaction,
): string {
  if (transaction.counterpartyAccountId) {
    return accountName(accounts, transaction.counterpartyAccountId);
  }
  if (transaction.payee) {
    return `${transaction.payee.displayName} (${transaction.payee.institution})`;
  }
  return "";
}

function statementFilename(transactions: readonly Transaction[]): string {
  if (transactions.length === 0) {
    return "mars-bank-statement.csv";
  }
  const dates = transactions.map((transaction) => transaction.postedOn.slice(0, 10));
  const from = dates.reduce((oldest, date) => (date < oldest ? date : oldest));
  const to = dates.reduce((newest, date) => (date > newest ? date : newest));
  if (from === to) {
    return `mars-bank-statement-${from}.csv`;
  }
  return `mars-bank-statement-${from}-to-${to}.csv`;
}

function encodeCell(cell: Cell): string {
  if (cell === null) {
    return "";
  }
  if (typeof cell === "number") {
    return String(cell);
  }
  const text = neutralizeFormula(cell);
  return `"${text.replace(/"/g, '""')}"`;
}

function neutralizeFormula(text: string): string {
  const leading = text.trimStart();
  const formula =
    leading.startsWith("=") ||
    leading.startsWith("+") ||
    leading.startsWith("-") ||
    leading.startsWith("@") ||
    text.startsWith("\t") ||
    text.startsWith("\r");
  return formula ? `'${text}` : text;
}
