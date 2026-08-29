"use client";

import { AccountList } from "@/components/banking/account-list";
import { useBank } from "@/lib/store";

export default function AccountsPage() {
  const { snapshot } = useBank();
  const deposits = snapshot.accounts.filter(
    (account) => account.kind !== "credit" && account.kind !== "loan",
  );
  const lending = snapshot.accounts.filter(
    (account) => account.kind === "credit" || account.kind === "loan",
  );

  return (
    <div>
      <div className="page-intro">
        <h1>Token register</h1>
      </div>
      <section className="bank-section">
        <div className="bank-section-heading">
          <div>
            <h2>Offset accounts</h2>
          </div>
        </div>
        <AccountList accounts={deposits} ledger={snapshot.accounts} />
      </section>
      <section className="bank-section">
        <div className="bank-section-heading">
          <div>
            <h2>Habitat debt and expedition credit</h2>
          </div>
        </div>
        <AccountList accounts={lending} ledger={snapshot.accounts} />
      </section>
    </div>
  );
}
