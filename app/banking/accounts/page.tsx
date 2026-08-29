"use client";

import { X } from "lucide-react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense } from "react";
import { AccountList } from "@/components/banking/account-list";
import type { Account } from "@/lib/domain";
import { useBank } from "@/lib/store";

function matches(account: Account, needle: string): boolean {
  if (needle.length === 0) {
    return true;
  }
  return [account.name, account.productName, account.branch, account.number].some(
    (field) => field.toLowerCase().includes(needle),
  );
}

function AccountsRegister() {
  const { snapshot } = useBank();
  const query = (useSearchParams().get("q") ?? "").trim();
  const needle = query.toLowerCase();
  const visible = snapshot.accounts.filter((account) => matches(account, needle));
  const deposits = visible.filter(
    (account) => account.kind !== "credit" && account.kind !== "loan",
  );
  const lending = visible.filter(
    (account) => account.kind === "credit" || account.kind === "loan",
  );

  return (
    <div className="desk">
      <div className="desk-intro">
        <div>
          <h1>Token register</h1>
          <p>
            {query.length === 0
              ? "Every account on one shared column set."
              : `${visible.length} matching ${
                  visible.length === 1 ? "account" : "accounts"
                } for “${query}”.`}
          </p>
        </div>
        {query.length === 0 ? null : (
          <Link className="desk-clear-search" href="/banking/accounts">
            Clear search <X />
          </Link>
        )}
      </div>
      {deposits.length > 0 ? (
        <section aria-labelledby="register-deposits" className="desk-card">
          <div className="desk-card-heading">
            <h2 id="register-deposits">Offset accounts</h2>
          </div>
          <AccountList accounts={deposits} ledger={snapshot.accounts} />
        </section>
      ) : null}
      {lending.length > 0 ? (
        <section aria-labelledby="register-lending" className="desk-card">
          <div className="desk-card-heading">
            <h2 id="register-lending">Habitat debt and expedition credit</h2>
          </div>
          <AccountList accounts={lending} ledger={snapshot.accounts} />
        </section>
      ) : null}
      {visible.length === 0 ? (
        <section className="desk-card">
          <div className="empty-state">
            <h3>No accounts match “{query}”</h3>
            <p>Try an account name, product, branch, or account number.</p>
          </div>
        </section>
      ) : null}
    </div>
  );
}

export default function AccountsPage() {
  return (
    <Suspense fallback={null}>
      <AccountsRegister />
    </Suspense>
  );
}
