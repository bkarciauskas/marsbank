"use client";

import { ArrowRight, Download, X } from "lucide-react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense } from "react";
import { TransactionList } from "@/components/banking/transaction-list";
import { statementCsv, type StatementCsv } from "@/lib/statement-csv";
import { useBank } from "@/lib/store";

function saveFile(file: StatementCsv): void {
  const url = URL.createObjectURL(
    new Blob([file.body], { type: "text/csv;charset=utf-8" }),
  );
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = file.filename;
  anchor.click();
  URL.revokeObjectURL(url);
}

function ActivityRegister() {
  const { snapshot } = useBank();
  const query = (useSearchParams().get("q") ?? "").trim();
  const needle = query.toLowerCase();
  const transactions =
    needle.length === 0
      ? snapshot.transactions
      : snapshot.transactions.filter((transaction) =>
          transaction.description.toLowerCase().includes(needle),
        );

  return (
    <div className="desk-register">
      <div className="page-intro">
        <div>
          <h1>Token movement</h1>
          <p className="mars-time">Mars-local ledger</p>
        </div>
        <button
          type="button"
          className="desk-quiet-action"
          disabled={transactions.length === 0}
          onClick={() =>
            saveFile(statementCsv({ transactions, accounts: snapshot.accounts }))
          }
        >
          <Download aria-hidden="true" /> Download CSV
        </button>
      </div>
      <section className="bank-section activity-register desk-card">
        <div className="bank-section-heading desk-card-heading">
          <div>
            <h2>{query.length === 0 ? "Posted by sol" : `Results for “${query}”`}</h2>
            <p>
              {query.length === 0
                ? "Every token in and out, across your full register."
                : `${transactions.length} matching ${
                    transactions.length === 1 ? "movement" : "movements"
                  } in your register.`}
            </p>
          </div>
          {query.length === 0 ? (
            <Link href="/banking/reports">
              Posted movement <ArrowRight />
            </Link>
          ) : (
            <Link href="/banking/activity">
              Clear search <X />
            </Link>
          )}
        </div>
        <TransactionList transactions={transactions} />
      </section>
    </div>
  );
}

export default function ActivityPage() {
  return (
    <Suspense fallback={null}>
      <ActivityRegister />
    </Suspense>
  );
}
