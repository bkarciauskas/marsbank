export type AccountId = string & { readonly __brand: "AccountId" };
export type CardId = string & { readonly __brand: "CardId" };
export type TxnId = string & { readonly __brand: "TxnId" };
export type CustomerId = string & { readonly __brand: "CustomerId" };
export type PaymentRequestId = string & {
  readonly __brand: "PaymentRequestId";
};
export type ContactId = string & { readonly __brand: "ContactId" };

export function accountId(value: string): AccountId {
  return value as AccountId;
}

export function cardId(value: string): CardId {
  return value as CardId;
}

export function txnId(value: string): TxnId {
  return value as TxnId;
}

export function customerId(value: string): CustomerId {
  return value as CustomerId;
}

export function paymentRequestId(value: string): PaymentRequestId {
  return value as PaymentRequestId;
}

export function contactId(value: string): ContactId {
  return value as ContactId;
}
