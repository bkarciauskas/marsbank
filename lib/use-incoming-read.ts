"use client";

import { useCallback, useSyncExternalStore } from "react";
import type { ReadThrough } from "./notifications";

const storagePrefix = "marsbank-incoming-read:";
const changeEvent = "marsbank-incoming-read";

export function incomingReadKey(residentEmail: string): string {
  return `${storagePrefix}${residentEmail.trim().toLowerCase()}`;
}

function subscribe(onChange: () => void): () => void {
  window.addEventListener("storage", onChange);
  window.addEventListener(changeEvent, onChange);
  return () => {
    window.removeEventListener("storage", onChange);
    window.removeEventListener(changeEvent, onChange);
  };
}

/** Per-resident read marker for the incoming-transfer bell, kept in this browser. */
export function useIncomingRead(
  residentEmail: string,
): [ReadThrough, (next: ReadThrough) => void] {
  const key = incomingReadKey(residentEmail);
  const readThrough = useSyncExternalStore(
    subscribe,
    () => window.localStorage.getItem(key),
    () => null,
  );
  const setReadThrough = useCallback(
    (next: ReadThrough) => {
      if (next === null) window.localStorage.removeItem(key);
      else window.localStorage.setItem(key, next);
      window.dispatchEvent(new Event(changeEvent));
    },
    [key],
  );
  return [readThrough, setReadThrough];
}
