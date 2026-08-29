import Link from "next/link";
import {
  ArrowRight,
  Building2,
  CircleHelp,
  CreditCard,
  Landmark,
  LockKeyhole,
  Repeat2,
} from "lucide-react";
import { Hero } from "@/components/public/hero";
import { PublicHeader } from "@/components/public/public-header";
import { TokenStorySlides } from "@/components/public/token-story-slides";
import { Wordmark } from "@/components/brand/wordmark";

const quickLinks = [
  { icon: Landmark, label: "Sol accounts", href: "/login" },
  { icon: Building2, label: "Habitat finance", href: "#habitat" },
  { icon: CreditCard, label: "Expedition cards", href: "/login" },
  { icon: Repeat2, label: "Send tokens", href: "/login" },
] as const;

export default function HomePage() {
  return (
    <>
      <PublicHeader />
      <main>
        <Hero />
        <section className="explore-section public-width" id="everyday">
          <div className="section-heading">
            <h2>Money for life off Earth</h2>
            <p>
              Air, water, power and time all count here. Your money should be
              just as exact.
            </p>
          </div>
          <div className="quick-link-grid">
            {quickLinks.map(({ icon: Icon, label, href }) => (
              <Link href={href} key={label}>
                <Icon />
                <span>{label}</span>
                <ArrowRight />
              </Link>
            ))}
          </div>
        </section>

        <section className="token-story public-width" id="saving">
          <div className="token-story-image">
            <TokenStorySlides />
          </div>
          <div className="token-story-copy">
            <h2>Dollars don&apos;t work here. Tokens do.</h2>
            <p>
              Earth currency stops at the landing pad. Everything this
              settlement runs on, from crop cycles to rover routing, is metered
              in model input and output tokens. Mars Bank holds yours as money
              you can spend. No coins. No chains. No speculation.
            </p>
            <Link href="/login">
              Start spending tokens <ArrowRight />
            </Link>
          </div>
        </section>

        <section className="service-band public-width" id="habitat">
          <article>
            <span className="service-number">01</span>
            <h3>Make the habitat yours</h3>
            <p>
              Put daily tokens against your habitat loan. They stay ready for
              the next sol while reducing the balance behind your front airlock.
            </p>
          </article>
          <article id="business">
            <span className="service-number">02</span>
            <h3>Keep the settlement supplied</h3>
            <p>
              Separate crew pay, operating tokens, reserves and cards. See the
              whole position before the next cargo window opens.
            </p>
          </article>
          <article id="private">
            <span className="service-number">03</span>
            <h3>Plan past the next launch window</h3>
            <p>
              Private banking for complex holdings, habitat ownership and plans
              measured in Mars years, not Earth quarters.
            </p>
          </article>
        </section>

        <section className="security-section" id="support">
          <div className="public-width security-inner">
            <LockKeyhole />
            <div>
              <h2>Earth is minutes away. Your bank is here.</h2>
              <p>
                Control accounts, cards and token transfers locally from any
                connected habitat. No round trip to Earth required.
              </p>
            </div>
            <Link href="/login">
              Enter secure banking <ArrowRight />
            </Link>
          </div>
        </section>
      </main>
      <footer className="public-footer">
        <div className="public-width">
          <div className="footer-top">
            <Wordmark inverse />
            <Link href="/login">Enter Mars Bank</Link>
          </div>
          <div className="footer-links">
            <a href="#everyday">Daily tokens</a>
            <a href="#habitat">Habitat finance</a>
            <a href="#saving">Long-horizon saving</a>
            <a href="#business">Settlement business</a>
            <a href="#support">Help and security</a>
          </div>
          <div className="footer-note">
            <CircleHelp />
            <p>
              One Mars Bank token represents one model input or output unit.
              Tokens are account units, not blockchain assets, investments or
              legal tender.
            </p>
          </div>
        </div>
      </footer>
    </>
  );
}
