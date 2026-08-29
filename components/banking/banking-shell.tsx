"use client";

import {
  ArrowLeftRight,
  Bell,
  ChartNoAxesColumn,
  CreditCard,
  House,
  Landmark,
  LogOut,
  MessageCircleQuestion,
  Search,
  ShieldCheck,
} from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { type FormEvent, type ReactNode, useState } from "react";
import { MarsMark } from "@/components/brand/wordmark";
import { useBank } from "@/lib/store";
import "./settings-surface.css";

const nav = [
  { href: "/banking", label: "Position", icon: House, onTabBar: true },
  { href: "/banking/accounts", label: "Accounts", icon: Landmark, onTabBar: true },
  { href: "/banking/cards", label: "Cards", icon: CreditCard, onTabBar: true },
  { href: "/banking/transfer", label: "Send", icon: ArrowLeftRight, onTabBar: true },
  {
    href: "/banking/reports",
    label: "Reports",
    icon: ChartNoAxesColumn,
    onTabBar: false,
  },
] as const;

const tabBarNav = nav.filter((item) => item.onTabBar);

const searchScopes = ["Everything", "Movements", "Accounts"] as const;

type SearchScope = (typeof searchScopes)[number];

function isCurrent(pathname: string, href: string): boolean {
  return href === "/banking" ? pathname === href : pathname.startsWith(href);
}

export function BankingShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { snapshot } = useBank();
  const [query, setQuery] = useState("");
  const [scope, setScope] = useState<SearchScope>("Everything");

  async function logout() {
    await fetch("/api/session", { method: "DELETE" });
    router.push("/");
    router.refresh();
  }

  function search(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const trimmed = query.trim();
    if (trimmed.length === 0) {
      return;
    }
    const destination = scope === "Accounts" ? "/banking/accounts" : "/banking/activity";
    router.push(`${destination}?q=${encodeURIComponent(trimmed)}`);
  }

  return (
    <div className="banking-shell">
      <header className="bank-topbar">
        <Link className="desk-lockup" href="/banking">
          <MarsMark />
          <span>Mars Bank</span>
        </Link>
        <form className="desk-search" onSubmit={search} role="search">
          <Search aria-hidden="true" />
          <input
            aria-label="Search transactions, accounts and payees"
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search transactions, accounts and payees"
            type="search"
            value={query}
          />
          <label className="desk-search-scope">
            <span className="sr-only">Search scope</span>
            <select
              onChange={(event) => setScope(event.target.value as SearchScope)}
              value={scope}
            >
              {searchScopes.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
          </label>
        </form>
        <div className="desk-identity">
          <span className="desk-demo-flag">Demo data</span>
          <Link
            aria-label="Notifications"
            className="desk-icon-button"
            href="/banking/settings"
          >
            <Bell />
          </Link>
          <Link
            aria-current={
              pathname.startsWith("/banking/settings") ? "page" : undefined
            }
            className="desk-customer"
            href="/banking/settings"
          >
            <span className="customer-avatar">{snapshot.customer.initials}</span>
            {snapshot.customer.displayName}
          </Link>
          <button className="desk-logout" onClick={logout} type="button">
            <LogOut /> Log out
          </button>
        </div>
      </header>
      <aside className="bank-sidebar">
        <nav aria-label="Banking">
          {nav.map(({ href, icon: Icon, label }) => (
            <Link
              aria-current={isCurrent(pathname, href) ? "page" : undefined}
              className={isCurrent(pathname, href) ? "active" : ""}
              href={href}
              key={href}
            >
              <Icon />
              <span>{label}</span>
            </Link>
          ))}
        </nav>
        <nav aria-label="Support" className="rail-support">
          <a href="mailto:security@marsbank.mars">
            <ShieldCheck />
            <span>Security</span>
          </a>
          <a href="mailto:support@marsbank.mars">
            <MessageCircleQuestion />
            <span>Help</span>
          </a>
        </nav>
      </aside>
      <div className="bank-stage">
        <main className="bank-content">{children}</main>
      </div>
      <nav aria-label="Mobile banking" className="mobile-bank-nav">
        {tabBarNav.map(({ href, icon: Icon, label }) => (
          <Link
            className={isCurrent(pathname, href) ? "active" : ""}
            href={href}
            key={href}
          >
            <Icon />
            <span>{label}</span>
          </Link>
        ))}
      </nav>
    </div>
  );
}
