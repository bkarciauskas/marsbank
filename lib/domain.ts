import type {
  AccountId,
  CardId,
  ContactId,
  CustomerId,
  PaymentRequestId,
  TxnId,
} from "./ids";
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
  DepositAccount | OffsetAccount | CreditAccount | LoanAccount;

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

export type SavedContact = {
  id: ContactId;
  nickname: string;
  payee: ResolvedPayId;
  pinned: boolean;
  savedAt: string;
};

export type SaveContactCommand = {
  handle: string;
  nickname: string;
};

export type PinContactCommand = {
  contactId: ContactId;
  pinned: boolean;
};

export type HostedContactCommand =
  | { action: "save"; command: SaveContactCommand }
  | { action: "pin"; command: PinContactCommand };

export type ContactFailure =
  | { kind: "invalid-payid" }
  | { kind: "own-payid" }
  | { kind: "invalid-nickname" }
  | { kind: "unknown-contact" }
  | { kind: "network" };

export type TransferFailure =
  | { kind: "same-account" }
  | { kind: "unknown-account" }
  | { kind: "amount-not-positive" }
  | { kind: "insufficient-funds" }
  | { kind: "credit-limit" }
  | { kind: "loan-not-source" }
  | { kind: "invalid-payid" }
  | { kind: "own-payid" }
  | { kind: "sol-limit" }
  | { kind: "step-up-required" }
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
  stepUpConfirmed?: boolean;
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

export type PaymentRequestStatus = "open" | "paid" | "declined" | "cancelled";

export type PaymentRequest = {
  id: PaymentRequestId;
  requesterSlug: string;
  requesterName: string;
  requesterEmail: string;
  payerSlug: string;
  payerName: string;
  payerEmail: string;
  amount: TokenAmount;
  description: string;
  createdAt: string;
  status: PaymentRequestStatus;
  resolvedAt?: string;
};

export type CreatePaymentRequestCommand = {
  target: string;
  amount: TokenAmount;
  description: string;
};

export type ApprovePaymentRequestCommand = {
  paymentRequestId: PaymentRequestId;
  from: AccountId;
  stepUpConfirmed?: boolean;
};

export type DeclinePaymentRequestCommand = {
  paymentRequestId: PaymentRequestId;
};

export type CancelPaymentRequestCommand = {
  paymentRequestId: PaymentRequestId;
};

export type HostedPaymentRequestCommand =
  | { action: "create"; command: CreatePaymentRequestCommand }
  | { action: "approve"; command: ApprovePaymentRequestCommand }
  | { action: "decline"; command: DeclinePaymentRequestCommand }
  | { action: "cancel"; command: CancelPaymentRequestCommand };

export type PaymentRequestFailure =
  | TransferFailure
  | { kind: "unknown-resident" }
  | { kind: "unknown-request" }
  | { kind: "request-not-open" };

export type BankSnapshot = {
  customer: Customer;
  accounts: Account[];
  cards: Card[];
  transactions: Transaction[];
  paymentRequests: PaymentRequest[];
  contacts: SavedContact[];
  revision: number;
};

export type ContactResult =
  | { kind: "ok"; snapshot: BankSnapshot; contact: SavedContact }
  | ContactFailure;

export type TransferResult =
  { kind: "ok"; snapshot: BankSnapshot } | TransferFailure;

export type PaymentRequestResult =
  | { kind: "ok"; snapshot: BankSnapshot; request: PaymentRequest }
  | PaymentRequestFailure;
