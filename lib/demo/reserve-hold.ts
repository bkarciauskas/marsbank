import type { BankSnapshot } from "../domain";

export function holdReserveAvailable(
  before: BankSnapshot,
  after: BankSnapshot,
): BankSnapshot {
  const prior = before.accounts.find((account) => account.id === "acc-reserve");
  if (!prior || !("available" in prior)) {
    return after;
  }

  return {
    ...after,
    accounts: after.accounts.map((account) => {
      if (account.id !== "acc-reserve" || !("available" in account)) {
        return account;
      }
      return { ...account, available: prior.available };
    }),
  };
}
