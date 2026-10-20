"use client";

import { Bell } from "lucide-react";
import { useEffect, useId, useRef, useState } from "react";
import { formatTokens } from "@/lib/money";
import {
  incomingTransfers,
  isUnread,
  markAllRead,
  unreadCount,
} from "@/lib/notifications";
import { useBank } from "@/lib/store";
import { useIncomingRead } from "@/lib/use-incoming-read";

const postedAt = new Intl.DateTimeFormat("en-AU", {
  day: "numeric",
  month: "short",
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
  timeZone: "UTC",
});

export function IncomingBell() {
  const { snapshot } = useBank();
  const [readThrough, setReadThrough] = useIncomingRead(snapshot.customer.email);
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  const panelId = useId();
  const feed = incomingTransfers(snapshot);
  const unread = unreadCount(feed, readThrough);

  useEffect(() => {
    if (!open) return;
    function onPointer(event: PointerEvent) {
      if (!root.current?.contains(event.target as Node)) setOpen(false);
    }
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }
    document.addEventListener("pointerdown", onPointer);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onPointer);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div className="desk-bell" ref={root}>
      <button
        aria-controls={panelId}
        aria-expanded={open}
        aria-label={unread > 0 ? `Notifications, ${unread} unread` : "Notifications"}
        className="desk-icon-button"
        onClick={() => setOpen((current) => !current)}
        type="button"
      >
        <Bell />
        {unread > 0 ? (
          <span aria-hidden="true" className="desk-bell-count">
            {unread > 9 ? "9+" : unread}
          </span>
        ) : null}
      </button>
      {open ? (
        <section
          aria-label="Incoming transfers"
          className="desk-bell-panel"
          id={panelId}
        >
          <header>
            <h2>Incoming transfers</h2>
            <button
              disabled={unread === 0}
              onClick={() => setReadThrough(markAllRead(feed, readThrough))}
              type="button"
            >
              Mark all as read
            </button>
          </header>
          {feed.length === 0 ? (
            <p className="desk-bell-empty">
              No tokens from other residents yet.
            </p>
          ) : (
            <ul>
              {feed.map((transfer) => (
                <li
                  className={isUnread(transfer, readThrough) ? "unread" : undefined}
                  key={transfer.id}
                >
                  <strong>
                    {transfer.senderName} sent {formatTokens(transfer.amount)}
                  </strong>
                  <small>
                    {transfer.description} ·{" "}
                    <time dateTime={transfer.postedOn}>
                      {postedAt.format(new Date(transfer.postedOn))} UTC
                    </time>
                  </small>
                </li>
              ))}
            </ul>
          )}
        </section>
      ) : null}
    </div>
  );
}
