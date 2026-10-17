"use client";
import { useEffect } from "react";
export function useDialogFocus(active: boolean) {
  useEffect(() => {
    if (!active) return;
    const dialog = document.querySelector<HTMLElement>('[role="dialog"]');
    if (!dialog) return;
    const previous =
      document.activeElement instanceof HTMLElement
        ? document.activeElement
        : null;
    const selector =
      "button:not(:disabled), input:not(:disabled), select:not(:disabled), textarea:not(:disabled), a[href]";
    const first = dialog.querySelector<HTMLElement>(selector);
    first?.focus();
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const keydown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        dialog
          .querySelector<HTMLButtonElement>('button[aria-label="Fermer"]')
          ?.click();
        return;
      }
      if (event.key !== "Tab") return;
      const items = Array.from(
        dialog.querySelectorAll<HTMLElement>(selector),
      ).filter((node) => node.offsetParent !== null);
      const first = items[0],
        last = items.at(-1);
      if (!first || !last) return;
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    document.addEventListener("keydown", keydown);
    return () => {
      document.removeEventListener("keydown", keydown);
      document.body.style.overflow = overflow;
      previous?.focus();
    };
  }, [active]);
}
