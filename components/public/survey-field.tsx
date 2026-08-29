"use client";

import Image from "next/image";
import { useEffect, useRef } from "react";

const SHEET = "/assets/images/survey-sheet.jpg";
const MINT = "#DCE8E6";

const stageStyle = {
  position: "absolute",
  inset: 0,
  overflow: "hidden",
} as const;

const bedStyle = {
  position: "absolute",
  inset: "-8%",
  transform: "scale(1.045)",
} as const;

const readStyle = {
  position: "absolute",
  inset: 0,
  pointerEvents: "none",
  background: `url("${SHEET}") center 35% / cover no-repeat, linear-gradient(rgb(220 232 230 / 0.2), rgb(220 232 230 / 0.2))`,
  mixBlendMode: "screen",
  opacity: 0,
  maskImage:
    "linear-gradient(to bottom, transparent 0%, rgb(16 21 24 / 0.4) 40%, #101518 50%, rgb(16 21 24 / 0.4) 60%, transparent 100%)",
  maskRepeat: "no-repeat",
  maskSize: "100% 28%",
  maskPosition: "0% -50%",
} as const;

const ruleStyle = {
  position: "absolute",
  inset: 0,
  pointerEvents: "none",
  mixBlendMode: "screen",
  backgroundImage: `linear-gradient(to bottom, transparent, rgb(220 232 230 / 0.34), transparent), linear-gradient(${MINT}, ${MINT})`,
  backgroundRepeat: "no-repeat",
  backgroundSize: "100% 80px, 100% 1px",
  backgroundPosition: "0 0, 0 39px",
  opacity: 1,
} as const;

const indexStyle = {
  position: "absolute",
  top: 0,
  bottom: 0,
  left: "3.8%",
  width: 13,
  backgroundImage: `linear-gradient(${MINT}, ${MINT}), linear-gradient(${MINT}, ${MINT}), linear-gradient(${MINT}, ${MINT})`,
  backgroundRepeat: "no-repeat",
  backgroundSize: "1px 11px, 13px 1px, 13px 1px",
  backgroundPosition: "0 0, 0 0, 0 10px",
  opacity: 0.85,
} as const;

export function SurveyField() {
  const stageRef = useRef<HTMLDivElement>(null);
  const bedRef = useRef<HTMLDivElement>(null);
  const readRef = useRef<HTMLSpanElement>(null);
  const ruleRef = useRef<HTMLSpanElement>(null);
  const indexRef = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    const stage = stageRef.current;
    const bed = bedRef.current;
    const read = readRef.current;
    const rule = ruleRef.current;
    const index = indexRef.current;
    if (!stage || !bed || !read || !rule || !index) {
      return;
    }

    const motion = window.matchMedia("(prefers-reduced-motion: reduce)");
    if (motion.matches || typeof bed.animate !== "function") {
      return;
    }

    const plot = bed.animate(
      [
        { transform: "translate3d(0, 0, 0) scale(1.045)" },
        { transform: "translate3d(1.4%, -0.9%, 0) scale(1.045)" },
        { transform: "translate3d(-1.1%, 0.7%, 0) scale(1.045)" },
        { transform: "translate3d(0, 0, 0) scale(1.045)" },
      ],
      {
        duration: 42000,
        easing: "cubic-bezier(0.45, 0.05, 0.55, 0.95)",
        iterations: Infinity,
      },
    );
    const scan = read.animate(
      [
        { maskPosition: "0% -50%", opacity: 0.78 },
        { maskPosition: "0% 150%", opacity: 0.78 },
      ],
      { duration: 16000, easing: "linear", iterations: Infinity },
    );
    const ruleRun = rule.animate(
      [
        { transform: "translate3d(0, 0%, 0)" },
        { transform: "translate3d(0, 100%, 0)" },
      ],
      { duration: 16000, easing: "linear", iterations: Infinity },
    );
    const indexRun = index.animate(
      [
        { transform: "translate3d(0, 8%, 0)" },
        { transform: "translate3d(0, 86%, 0)" },
      ],
      { duration: 16000, easing: "linear", iterations: Infinity },
    );

    const running = [plot, scan, ruleRun, indexRun];
    for (const animation of running) {
      animation.pause();
    }

    let visible = false;
    const sync = () => {
      const surveying = visible && !document.hidden;
      stage.classList.toggle("is-surveying", surveying);
      if (surveying) {
        for (const animation of running) {
          animation.play();
        }
        return;
      }
      for (const animation of running) {
        animation.pause();
      }
    };

    let observer: IntersectionObserver | undefined;
    if (typeof IntersectionObserver === "undefined") {
      visible = true;
      sync();
    } else {
      observer = new IntersectionObserver((entries) => {
        visible = entries.some((entry) => entry.isIntersecting);
        sync();
      });
      observer.observe(stage);
    }

    document.addEventListener("visibilitychange", sync);

    return () => {
      observer?.disconnect();
      document.removeEventListener("visibilitychange", sync);
      stage.classList.remove("is-surveying");
      for (const animation of running) {
        animation.cancel();
      }
    };
  }, []);

  return (
    <div className="survey-stage" ref={stageRef} style={stageStyle}>
      <div className="survey-bed" ref={bedRef} style={bedStyle}>
        <Image
          alt=""
          className="survey-plate"
          fill
          priority
          sizes="(max-width: 850px) 100vw, 58vw"
          src={SHEET}
        />
        <span aria-hidden className="survey-read" ref={readRef} style={readStyle} />
        <span aria-hidden className="survey-rule" ref={ruleRef} style={ruleStyle} />
        <span
          aria-hidden
          className="survey-index"
          ref={indexRef}
          style={indexStyle}
        />
      </div>
    </div>
  );
}
