"use client";

import { useEffect } from "react";

const TEXT_TYPES = new Set(["", "text", "number", "email", "tel", "date", "password", "search", "url"]);

function isField(el: Element | null): el is HTMLInputElement | HTMLSelectElement {
  if (!el) return false;
  if (el instanceof HTMLSelectElement) return !el.disabled;
  if (el instanceof HTMLInputElement) return TEXT_TYPES.has(el.type) && !el.disabled && !el.readOnly;
  return false;
}

function visible(el: HTMLElement) {
  return el.offsetParent !== null || getComputedStyle(el).position === "fixed";
}

/**
 * Enter = move to the next editable field (the line below), Shift+Enter = previous field.
 * Works across the whole app; forms marked data-enter-submit keep normal submit behaviour.
 */
export default function EnterNavigator() {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Enter" || e.ctrlKey || e.metaKey || e.altKey || e.isComposing) return;
      const target = e.target as HTMLElement | null;
      if (!target || !isField(target)) return;
      if (target.closest("[data-enter-submit]")) return;

      // stay inside an open modal if the field is in one
      const scope: ParentNode = target.closest(".fixed.inset-0") ?? document;
      const fields = Array.from(scope.querySelectorAll<HTMLElement>("input, select")).filter((el) => isField(el) && visible(el));
      const i = fields.indexOf(target);
      if (i === -1) return;
      const next = fields[e.shiftKey ? i - 1 : i + 1];
      e.preventDefault();
      if (next) {
        next.focus();
        if (next instanceof HTMLInputElement) {
          try {
            next.select();
          } catch {
            /* date inputs */
          }
        }
        next.scrollIntoView({ block: "nearest" });
      } else {
        target.blur();
      }
    };
    document.addEventListener("keydown", onKey, true);
    return () => document.removeEventListener("keydown", onKey, true);
  }, []);
  return null;
}
