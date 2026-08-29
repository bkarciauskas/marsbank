"use client";

import { ArrowRight } from "lucide-react";
import Link from "next/link";
import { TransactionList } from "@/components/banking/transaction-list";
import { useBank } from "@/lib/store";

export default function ActivityPage() {
  const { snapshot } = useBank();

  return (
    <div>
      <div className="page-intro">
        <h1>Token movement</h1>
        <p className="mars-time">Mars-local ledger</p>
      </div>
      <section className="bank-section activity-register">
        <div className="bank-section-heading">
          <div>
            <h2>Posted by sol</h2>
            <p>Every token in and out, across your full register.</p>
          </div>
          <Link href="/banking/reports">
            Posted movement <ArrowRight />
          </Link>
        </div>
        <TransactionList transactions={snapshot.transactions} />
      </section>
    </div>
  );
}
