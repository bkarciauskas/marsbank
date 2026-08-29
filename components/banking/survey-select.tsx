"use client";

import { Check, ChevronDown } from "lucide-react";
import {
  useEffect,
  useId,
  useRef,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
} from "react";

export type SurveySelectOption = {
  value: string;
  label: string;
};

export function SurveySelect({
  id,
  value,
  options,
  onChange,
}: {
  id: string;
  value: string;
  options: SurveySelectOption[];
  onChange: (value: string) => void;
}) {
  const listId = useId();
  const root = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const list = useRef<HTMLUListElement>(null);
  const [open, setOpen] = useState(false);
  const selected = options.find((option) => option.value === value) ?? options[0];
  const selectedIndex = Math.max(
    0,
    options.findIndex((option) => option.value === value),
  );
  const [activeIndex, setActiveIndex] = useState(selectedIndex);

  useEffect(() => {
    if (!open) {
      return;
    }
    list.current?.focus();

    function onPointer(event: PointerEvent) {
      if (!root.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    }
    function onDocumentKey(event: globalThis.KeyboardEvent) {
      if (event.key === "Escape") {
        setOpen(false);
        trigger.current?.focus();
      }
    }
    document.addEventListener("pointerdown", onPointer);
    document.addEventListener("keydown", onDocumentKey);
    return () => {
      document.removeEventListener("pointerdown", onPointer);
      document.removeEventListener("keydown", onDocumentKey);
    };
  }, [open]);

  function openList() {
    setActiveIndex(selectedIndex);
    setOpen(true);
  }

  function choose(next: string) {
    onChange(next);
    setOpen(false);
    trigger.current?.focus();
  }

  function moveActive(next: number) {
    setActiveIndex(Math.max(0, Math.min(options.length - 1, next)));
  }

  function onListKey(event: ReactKeyboardEvent<HTMLUListElement>) {
    if (event.key === "ArrowDown") {
      event.preventDefault();
      moveActive(activeIndex + 1);
    }
    if (event.key === "ArrowUp") {
      event.preventDefault();
      moveActive(activeIndex - 1);
    }
    if (event.key === "Home") {
      event.preventDefault();
      moveActive(0);
    }
    if (event.key === "End") {
      event.preventDefault();
      moveActive(options.length - 1);
    }
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      const next = options[activeIndex];
      if (next) {
        choose(next.value);
      }
    }
  }

  function onTriggerKey(event: ReactKeyboardEvent<HTMLButtonElement>) {
    if (
      event.key === "ArrowDown" ||
      event.key === "ArrowUp" ||
      event.key === "Enter" ||
      event.key === " "
    ) {
      event.preventDefault();
      openList();
    }
  }

  return (
    <div className={`survey-select${open ? " is-open" : ""}`} ref={root}>
      <button
        aria-controls={listId}
        aria-expanded={open}
        aria-haspopup="listbox"
        aria-label={selected?.label}
        className="survey-select-trigger"
        id={id}
        onClick={() => {
          if (open) {
            setOpen(false);
          } else {
            openList();
          }
        }}
        onKeyDown={onTriggerKey}
        ref={trigger}
        type="button"
      >
        <span>{selected?.label}</span>
        <ChevronDown />
      </button>
      {open ? (
        <ul
          aria-activedescendant={`${listId}-${options[activeIndex]?.value}`}
          className="survey-select-list"
          id={listId}
          onKeyDown={onListKey}
          ref={list}
          role="listbox"
          tabIndex={-1}
        >
          {options.map((option, index) => {
            const selectedOption = option.value === value;
            return (
              <li
                aria-selected={selectedOption}
                className={index === activeIndex ? "is-active" : undefined}
                id={`${listId}-${option.value}`}
                key={option.value}
                onClick={(event) => {
                  event.preventDefault();
                  event.stopPropagation();
                  choose(option.value);
                }}
                onMouseDown={(event) => {
                  event.preventDefault();
                  event.stopPropagation();
                }}
                onMouseEnter={() => setActiveIndex(index)}
                role="option"
              >
                {selectedOption ? <Check /> : <span />}
                {option.label}
              </li>
            );
          })}
        </ul>
      ) : null}
    </div>
  );
}
