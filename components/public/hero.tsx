import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { SurveyField } from "@/components/public/survey-field";

const ticks = [
  "Mars-local accounts",
  "Habitat finance",
  "Tokens held in custody",
] as const;

export function Hero() {
  return (
    <section className="hero" aria-label="Mars Bank">
      <div className="hero-copy">
        <h1>The only bank on Mars</h1>
        <p className="hero-body">
          Hold, move and plan with the unit that runs this world: model tokens.
        </p>
        <Link className="hero-action" href="/login">
          Enter Mars Bank <ArrowRight />
        </Link>
        <ul className="hero-ticks">
          {ticks.map((label, index) => (
            <li key={label}>
              <span>{String(index + 1).padStart(2, "0")}</span>
              {label}
            </li>
          ))}
        </ul>
      </div>
      <div className="hero-image">
        <SurveyField />
      </div>
    </section>
  );
}
