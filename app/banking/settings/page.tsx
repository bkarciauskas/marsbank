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
    <div className="desk desk-task">
      <div className="desk-intro">
        <div>
          <h1>Settings</h1>
          <p>Profile, appearance, and the shared demo balances.</p>
        </div>
      </div>

      <section className="desk-card">
        <div className="desk-card-heading">
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

      <section className="desk-card">
        <div className="desk-card-heading">
          <div>
            <h2>Appearance</h2>
          </div>
        </div>
        <div className="settings-appearance">
          <ThemeToggle />
        </div>
      </section>

      <section className="desk-card">
        <div className="desk-card-heading">
          <div>
            <h2>Shared demo</h2>
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
                className="desk-primary-action"
                disabled={resetting}
                onClick={() => void restoreDemo()}
                type="button"
              >
                <RotateCcw />
                {resetting ? "Restoring all registers" : "Restore all registers"}
              </button>
              <button
                className="desk-quiet-action"
                disabled={resetting}
                onClick={() => setConfirmingReset(false)}
                type="button"
              >
                Keep shared balances
              </button>
            </div>
          </div>
        ) : (
          <div className="settings-actions">
            <button
              className="desk-primary-action"
              onClick={() => {
                setRestored(false);
                setConfirmingReset(true);
              }}
              type="button"
            >
              <RotateCcw /> Restore shared demo
            </button>
          </div>
        )}
        {restored ? (
          <p className="settings-note">All six registers restored.</p>
        ) : null}
      </section>
    </div>
  );
}
