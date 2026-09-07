"use client";

import { useEffect, useState } from "react";

export function useViewerCivilHour(): number | null {
  const [hour, setHour] = useState<number | null>(null);

  useEffect(() => {
    const sample = () => {
      setHour(new Date().getHours());
    };

    sample();

    const msUntilNextHour = () => {
      const now = new Date();
      return (
        new Date(
          now.getFullYear(),
          now.getMonth(),
          now.getDate(),
          now.getHours() + 1,
        ).getTime() - now.getTime()
      );
    };

    let timeoutId = window.setTimeout(function onBoundary() {
      sample();
      timeoutId = window.setTimeout(onBoundary, msUntilNextHour());
    }, msUntilNextHour());

    window.addEventListener("focus", sample);

    return () => {
      window.clearTimeout(timeoutId);
      window.removeEventListener("focus", sample);
    };
  }, []);

  return hour;
}
