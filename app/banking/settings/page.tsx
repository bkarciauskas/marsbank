"use client";

import { RotateCcw } from "lucide-react";
import { useState } from "react";
import { ThemeToggle } from "@/components/brand/theme-toggle";
import { useBank } from "@/lib/store";
import "@/components/banking/settings-surface.css";

export default function SettingsPage() {
  const { reset, snapshot } = useBank();
  const [restored, setRestored] = useState(false);
  const [confirmingReset, setConfirmingReset] = useState(false);
  const [resetting, setResetting] = useState(false);

  async function restoreDemo() {
    setResetting(true);
    await reset();
    setResetting(false);
    setConfirmingReset(false);
    setRestored(true);
  }

  return (
    <div>
      <div className="page-intro">
        <h1>Settings</h1>
      </div>
      <section className="bank-section">
        <div className="bank-section-heading">
          <div>
            <h2>Profile</h2>
          </div>
        </div>
        <dl className="settings-register">
          <div>
            <dt>Name</dt>
            <dd>{snapshot.customer.displayName}</dd>
          </div>
          <div>
            <dt>Mars Bank ID</dt>
            <dd>{snapshot.customer.email}</dd>
          </div>
          <div>
            <dt>Member ID</dt>
            <dd>{snapshot.customer.memberId}</dd>
          </div>
        </dl>
      </section>
      <section className="bank-section">
        <div className="bank-section-heading">
          <div>
            <h2>Appearance</h2>
          </div>
        </div>
        <ThemeToggle />
      </section>
      <section className="bank-section">
        <div className="bank-section-heading">
          <div>
            <h2>Demo register</h2>
            <p>
              Balances and transfers are shared across every signed-in demo
              resident. Restore all six registers to their seeded balances.
            </p>
          </div>
        </div>
        {confirmingReset ? (
          <div className="reset-confirmation">
            <p>
              This removes every shared transfer and restores Cameron, Aaron,
              Ben, Richard, Robin, and Blake.
            </p>
            <div>
              <button
                className="restore-register"
                disabled={resetting}
                onClick={() => void restoreDemo()}
                type="button"
              >
                <RotateCcw />
                {resetting ? "Restoring all registers" : "Restore all registers"}
              </button>
              <button
                className="secondary-action"
                disabled={resetting}
                onClick={() => setConfirmingReset(false)}
                type="button"
              >
                Keep shared balances
              </button>
            </div>
          </div>
        ) : (
          <button
            className="restore-register"
            onClick={() => {
              setRestored(false);
              setConfirmingReset(true);
            }}
            type="button"
          >
            <RotateCcw /> Restore shared demo
          </button>
        )}
        {restored ? (
          <p className="settings-note">All six registers restored.</p>
        ) : null}
      </section>
    </div>
  );
}
