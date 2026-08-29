"use client";

import Image from "next/image";
import { useEffect, useId, useState } from "react";

const slides = [
  {
    src: "/assets/images/mars-habitat-promenade.jpg",
    alt: "Residents crossing the pressurized Jezero promenade beneath a rust-red sky.",
    position: "center 36%",
  },
  {
    src: "/assets/images/mars-crater-terrace.jpg",
    alt: "A habitat terrace looking across a crater settlement late in the sol.",
    position: "center 42%",
  },
  {
    src: "/assets/images/mars-settlement-atrium.jpg",
    alt: "Residents gathering inside a sealed settlement atrium.",
    position: "center 40%",
  },
  {
    src: "/assets/images/mars-ridge-dawn.jpg",
    alt: "First light reaching a ridge above a distant Mars settlement.",
    position: "center 58%",
  },
] as const;

const INTERVAL_MS = 6500;

export function TokenStorySlides() {
  const labelId = useId();
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);

  useEffect(() => {
    const motion = window.matchMedia("(prefers-reduced-motion: reduce)");
    if (motion.matches || paused) {
      return;
    }

    const timer = window.setInterval(() => {
      setIndex((current) => (current + 1) % slides.length);
    }, INTERVAL_MS);

    return () => window.clearInterval(timer);
  }, [paused]);

  return (
    <div
      aria-labelledby={labelId}
      aria-roledescription="carousel"
      className="token-story-slides"
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget)) {
          setPaused(false);
        }
      }}
      onFocus={() => setPaused(true)}
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
    >
      <p className="sr-only" id={labelId}>
        Life inside the Mars settlements
      </p>
      {slides.map((slide, slideIndex) => (
        <figure
          aria-hidden={slideIndex !== index}
          className={slideIndex === index ? "is-current" : undefined}
          key={slide.src}
        >
          <Image
            alt={slideIndex === index ? slide.alt : ""}
            fill
            priority={slideIndex === 0}
            sizes="(max-width: 850px) 100vw, 50vw"
            src={slide.src}
            style={{ objectPosition: slide.position }}
          />
        </figure>
      ))}
    </div>
  );
}
