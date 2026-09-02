"use client";

import { Menu, Search, X } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { useTheme } from "@/components/brand/theme-toggle";
import { Wordmark } from "@/components/brand/wordmark";

const primaryLinks = [
  ["Daily tokens", "/#everyday"],
  ["Habitat finance", "/#habitat"],
  ["Long-horizon saving", "/#saving"],
  ["Settlement business", "/#business"],
  ["Private office", "/#private"],
] as const;

export function PublicHeader() {
  const [open, setOpen] = useState(false);
  const theme = useTheme();

  return (
    <header className="public-header">
      <div className="utility-bar">
        <div className="public-width utility-inner">
          <span>Residents and enterprises</span>
          <nav aria-label="Utility">
            <Link href="/#business">Settlement business</Link>
            <Link href="/#support">Help and security</Link>
            <Link href="/login">Mars Bank online</Link>
            <Link href="/demo">Demos</Link>
          </nav>
        </div>
      </div>
      <div className="main-nav">
        <div className="public-width main-nav-inner">
          <button
            aria-expanded={open}
            aria-label={open ? "Close menu" : "Open menu"}
            className="mobile-menu-button"
            onClick={() => setOpen((current) => !current)}
            type="button"
          >
            {open ? <X /> : <Menu />}
          </button>
          <Wordmark inverse={theme === "dark"} />
          <nav aria-label="Primary" className={open ? "nav-links nav-open" : "nav-links"}>
            {primaryLinks.map(([label, href]) => (
              <Link href={href} key={href} onClick={() => setOpen(false)}>
                {label}
              </Link>
            ))}
            <Link className="mobile-demo-link" href="/demo" onClick={() => setOpen(false)}>
              Demos
            </Link>
          </nav>
          <div className="nav-end">
            <button aria-label="Search" className="search-button" type="button">
              <Search />
            </button>
            <Link className="login-button" href="/login">
              Enter
            </Link>
          </div>
        </div>
      </div>
    </header>
  );
}
