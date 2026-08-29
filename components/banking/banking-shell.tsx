"use client";

import {
  ArrowLeftRight,
  ChartNoAxesColumn,
  CreditCard,
  House,
  Landmark,
  LogOut,
  MessageCircleQuestion,
  ShieldCheck,
} from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import type { ReactNode } from "react";
import { Wordmark } from "@/components/brand/wordmark";
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

export function BankingShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { snapshot } = useBank();

  async function logout() {
    await fetch("/api/session", { method: "DELETE" });
    router.push("/");
    router.refresh();
  }

  return (
    <div className="banking-shell">
      <aside className="bank-sidebar">
        <Wordmark href="/banking" inverse />
        <nav aria-label="Banking">
          {nav.map(({ href, icon: Icon, label }) => {
            const active =
              href === "/banking" ? pathname === href : pathname.startsWith(href);
            return (
              <Link className={active ? "active" : ""} href={href} key={href}>
                <Icon />
                <span>{label}</span>
              </Link>
            );
          })}
        </nav>
        <div className="sidebar-actions">
          <Link
            aria-current={
              pathname.startsWith("/banking/settings") ? "page" : undefined
            }
            className={
              pathname.startsWith("/banking/settings")
                ? "registry-identity is-current"
                : "registry-identity"
            }
            href="/banking/settings"
          >
            <div className="customer-avatar">
              {snapshot.customer.initials}
            </div>
            <div>
              <strong>{snapshot.customer.displayName}</strong>
              <span>{snapshot.customer.memberId}</span>
            </div>
          </Link>
        </div>
      </aside>
      <div className="bank-stage">
        <header className="bank-topbar">
          <div className="bank-context">
            <span>Mars-local ledger</span>
            <strong>Primary settlement register</strong>
          </div>
          <nav aria-label="Account utilities" className="bank-utility">
            <Link className="bank-settings-link" href="/banking/settings">
              <span className="customer-avatar">
                {snapshot.customer.initials}
              </span>
              {snapshot.customer.displayName}
            </Link>
            <a href="mailto:security@marsbank.mars">
              <ShieldCheck /> Security
            </a>
            <a href="mailto:support@marsbank.mars">
              <MessageCircleQuestion /> Support
            </a>
            <button onClick={logout} type="button">
              <LogOut /> Log out
            </button>
          </nav>
        </header>
        <main className="bank-content">{children}</main>
      </div>
      <nav aria-label="Mobile banking" className="mobile-bank-nav">
        {tabBarNav.map(({ href, icon: Icon, label }) => (
          <Link
            className={
              href === "/banking"
                ? pathname === href
                  ? "active"
                  : ""
                : pathname.startsWith(href)
                  ? "active"
                  : ""
            }
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
