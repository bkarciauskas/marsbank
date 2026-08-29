import Link from "next/link";
import { PublicHeader } from "@/components/public/public-header";
import { LoginForm } from "./login-form";

export const metadata = {
  title: "Enter Mars Bank",
};

export default function LoginPage() {
  return (
    <>
      <PublicHeader />
      <main className="login-page">
        <section className="login-card">
          <div className="login-heading">
            <p>Earth can wait.</p>
            <h1>Your accounts can&apos;t.</h1>
          </div>
          <LoginForm />
          <div className="login-help">
            <a href="mailto:support@marsbank.mars">Recover demo access</a>
            <Link href="/">Return to the public site</Link>
          </div>
        </section>
        <footer className="login-footer">
          <span>Privacy register</span>
          <span>Security protocol</span>
          <span>Banking terms</span>
        </footer>
      </main>
    </>
  );
}
