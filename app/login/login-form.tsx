"use client";

import { Eye, EyeOff, Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import {
  defaultDemoResident,
  demoResidents,
  type DemoResident,
} from "@/lib/fixtures";
import "./login-form.css";

export function LoginForm() {
  const router = useRouter();
  const [residentSlug, setResidentSlug] = useState(defaultDemoResident.slug);
  const [email, setEmail] = useState(defaultDemoResident.email);
  const [password, setPassword] = useState(defaultDemoResident.password);
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  function selectResident(resident: DemoResident) {
    setResidentSlug(resident.slug);
    setEmail(resident.email);
    setPassword(resident.password);
    setError("");
  }

  function onEmailChange(next: string) {
    setEmail(next);
    const match = demoResidents.find((resident) => resident.email === next);
    setResidentSlug(match?.slug ?? "");
    if (match) {
      setPassword(match.password);
    }
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setSubmitting(true);
    const response = await fetch("/api/session", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });
    setSubmitting(false);
    if (!response.ok) {
      setError("That ID and password do not match the demo access record.");
      return;
    }
    router.push("/banking");
    router.refresh();
  }

  return (
    <form className="login-form" onSubmit={submit}>
      <fieldset className="demo-roster">
        <legend>Demo resident</legend>
        <div className="demo-roster-grid">
          {demoResidents.map((resident) => {
            const selected = resident.slug === residentSlug;
            return (
              <label
                className={selected ? "is-selected" : undefined}
                key={resident.slug}
              >
                <input
                  checked={selected}
                  name="demo-resident"
                  onChange={() => selectResident(resident)}
                  type="radio"
                  value={resident.slug}
                />
                <span aria-hidden="true" className="customer-avatar">
                  {resident.initials}
                </span>
                <span>
                  <strong>{resident.givenName}</strong>
                  <em>{resident.habitat.replace(" Habitat", "")}</em>
                </span>
              </label>
            );
          })}
        </div>
      </fieldset>
      <label htmlFor="mars-bank-id">
        Mars Bank ID
        <input
          aria-describedby={error ? "login-error" : undefined}
          autoComplete="off"
          id="mars-bank-id"
          name="email"
          onChange={(event) => onEmailChange(event.target.value)}
          value={email}
        />
      </label>
      <label htmlFor="mars-bank-password">
        Password
        <span className="password-field">
          <input
            autoComplete="off"
            id="mars-bank-password"
            name="password"
            onChange={(event) => setPassword(event.target.value)}
            type={showPassword ? "text" : "password"}
            value={password}
          />
          <button
            aria-label={showPassword ? "Hide password" : "Show password"}
            onClick={() => setShowPassword((current) => !current)}
            type="button"
          >
            {showPassword ? <EyeOff /> : <Eye />}
          </button>
        </span>
      </label>
      {error ? (
        <p className="form-error" id="login-error" role="alert">
          {error}
        </p>
      ) : null}
      <button className="submit-login" disabled={submitting} type="submit">
        {submitting ? <Loader2 className="spin" /> : null}
        {submitting ? "Opening your register" : "Enter Mars Bank"}
      </button>
      <p className="login-terms">
        This is a fictional banking demo. Pick a resident to fill the Mars Bank
        ID and password, then enter. By entering, you agree to Mars Bank&apos;s
        demo terms and digital banking conditions.
      </p>
    </form>
  );
}
