import { Suspense } from "react";
import {
  TransferForm,
  type TransferLinkPrefill,
} from "@/components/banking/transfer-form";
import "@/components/banking/transfer-surface.css";

type TransferQuery = {
  from?: string | string[];
  to?: string | string[];
  payid?: string | string[];
  amount?: string | string[];
  note?: string | string[];
};

function firstParam(value: string | string[] | undefined): string | undefined {
  const raw = Array.isArray(value) ? value[0] : value;
  const trimmed = raw?.trim();
  return trimmed ? trimmed : undefined;
}

function prefillFromQuery(query: TransferQuery): TransferLinkPrefill {
  return {
    from: firstParam(query.from),
    to: firstParam(query.to),
    payid: firstParam(query.payid),
    amount: firstParam(query.amount),
    note: firstParam(query.note),
  };
}

export default async function TransferPage({
  searchParams,
}: {
  searchParams: Promise<TransferQuery>;
}) {
  const prefill = prefillFromQuery(await searchParams);
  const prefillKey = [
    prefill.from,
    prefill.to,
    prefill.payid,
    prefill.amount,
    prefill.note,
  ].join("\0");

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
            account in your Mars Bank register, or request tokens from another
            resident.
          </p>
        </div>
        <Suspense fallback={<div className="transfer-loading">Plotting accounts…</div>}>
          <TransferForm key={prefillKey} prefill={prefill} />
        </Suspense>
      </section>
    </div>
  );
}
