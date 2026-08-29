import { Suspense } from "react";
import { TransferForm } from "@/components/banking/transfer-form";

export default function TransferPage() {
  return (
    <div className="transfer-page">
      <div className="page-intro">
        <h1>Send tokens</h1>
      </div>
      <section className="transfer-panel">
        <div className="transfer-panel-heading">
          <h2>Move value at Mars speed</h2>
          <p>
            Send whole token units to a Cursor identity, PayID or another
            account in your Mars Bank register.
          </p>
        </div>
        <Suspense fallback={<div className="transfer-loading">Plotting accounts…</div>}>
          <TransferForm />
        </Suspense>
      </section>
    </div>
  );
}
