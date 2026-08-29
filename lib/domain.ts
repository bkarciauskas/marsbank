import type { AccountId, CardId, CustomerId, TxnId } from "./ids";
import type { TokenAmount } from "./money";

export type AccountBase = {
  id: AccountId;
  name: string;
  productName: string;
  branch: string;
  number: string;
  openedOn: string;
};

export type DepositAccount = AccountBase & {
  kind: "transaction" | "savings";
  available: TokenAmount;
  current: TokenAmount;
};

export type OffsetAccount = AccountBase & {
  kind: "offset";
  available: TokenAmount;
  current: TokenAmount;
  linkedLoanId: AccountId;
};

export type CreditAccount = AccountBase & {
  kind: "credit";
  limit: TokenAmount;
  owed: TokenAmount;
};

export type LoanAccount = AccountBase & {
  kind: "loan";
  principal: TokenAmount;
  remaining: TokenAmount;
};

export type Account =
  | DepositAccount
  | OffsetAccount
  | CreditAccount
  | LoanAccount;

export type CardStatus = "active" | "frozen";

export type Card = {
  id: CardId;
  accountId: AccountId;
  last4: string;
  holderName: string;
  expiry: string;
  status: CardStatus;
  form: "physical" | "virtual";
};

export type TxnDirection = "debit" | "credit";

export type Transaction = {
  id: TxnId;
  accountId: AccountId;
  postedOn: string;
  description: string;
  amount: TokenAmount;
  direction: TxnDirection;
  counterpartyAccountId?: AccountId;
  payee?: ResolvedPayId;
};

export type PayIdScheme = "cursor" | "payid";

export type ResolvedPayId = {
  scheme: PayIdScheme;
  id: string;
  displayName: string;
  institution: string;
};

export type TransferFailure =
  | { kind: "same-account" }
  | { kind: "unknown-account" }
  | { kind: "amount-not-positive" }
  | { kind: "insufficient-funds" }
  | { kind: "credit-limit" }
  | { kind: "loan-not-source" }
  | { kind: "invalid-payid" }
  | { kind: "own-payid" }
  | { kind: "network" };

export type TransferCommand = {
  from: AccountId;
  to: AccountId;
  amount: TokenAmount;
  description: string;
};

export type PayIdTransferCommand = {
  from: AccountId;
  amount: TokenAmount;
  description: string;
  payee: ResolvedPayId;
};

export type HostedTransferCommand =
  | { kind: "own"; command: TransferCommand }
  | { kind: "payid"; command: PayIdTransferCommand };

export type Customer = {
  id: CustomerId;
  email: string;
  displayName: string;
  memberId: string;
  initials: string;
};

export type BankSnapshot = {
  customer: Customer;
  accounts: Account[];
  cards: Card[];
  transactions: Transaction[];
  revision: number;
};

export type TransferResult =
  | { kind: "ok"; snapshot: BankSnapshot }
  | TransferFailure;
