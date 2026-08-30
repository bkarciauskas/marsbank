"use client";

import { Snowflake, Sun, Wifi } from "lucide-react";
import { MarsMark } from "@/components/brand/wordmark";
import { useBank } from "@/lib/store";
import "@/components/banking/cards-surface.css";

export default function CardsPage() {
  const { snapshot, updateCardStatus } = useBank();

  return (
    <div className="cards-page">
      <div className="page-intro">
        <h1>Cards for every airlock</h1>
      </div>
      <div className="cards-grid">
        {snapshot.cards.map((card, index) => {
          const account = snapshot.accounts.find(
            (candidate) => candidate.id === card.accountId,
          );
          const frozen = card.status === "frozen";
          return (
            <article className="card-panel" key={card.id}>
              <div className={`bank-card ${index === 1 ? "oxide" : ""}`}>
                <div className="bank-card-top">
                  <span>
                    <MarsMark inverse />
                    MARS BANK
                  </span>
                  <Wifi />
                </div>
                <strong>•••• •••• •••• {card.last4}</strong>
                <div>
                  <span>{card.holderName}</span>
                  <span>{card.expiry}</span>
                </div>
                {frozen ? <span className="frozen-label">FROZEN</span> : null}
              </div>
              <div className="card-meta">
                <div>
                  <strong>{card.form === "virtual" ? "Virtual" : "Physical"} card</strong>
                  <span>{account?.name}</span>
                </div>
                <span className={`status-badge ${frozen ? "frozen" : ""}`}>
                  {frozen ? <Snowflake /> : <Sun />}
                  {frozen ? "Frozen" : "Active"}
                </span>
              </div>
              <button
                className="freeze-button"
                onClick={() =>
                  void updateCardStatus(
                    card.id,
                    frozen ? "active" : "frozen",
                  )
                }
                type="button"
              >
                {frozen ? <Sun /> : <Snowflake />}
                {frozen ? "Unfreeze card" : "Freeze card"}
              </button>
            </article>
          );
        })}
      </div>
      <section className="card-security-note">
        <Snowflake />
        <div>
          <h2>Lost beyond the airlock?</h2>
          <p>
            Freeze the card before the next hatch closes. Your token account
            stays open, and you can bring the card back online here at any time.
          </p>
        </div>
      </section>
    </div>
  );
}
