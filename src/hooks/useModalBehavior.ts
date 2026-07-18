"use client";

import { useEffect, type RefObject } from "react";

const FOCUSABLE_SELECTOR =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

/**
 * Shared behavior for overlay dialogs: lock body scroll while open, close on
 * Escape, and — when a container ref is provided — move focus into the
 * dialog, trap Tab inside it, and restore focus on close. Pair with
 * role="dialog" + aria-modal on the overlay and a backdrop pointer-down handler.
 * Using pointer-down prevents a selection drag that starts in the dialog and
 * ends on the backdrop from being mistaken for an outside click.
 */
export function useModalBehavior(
  open: boolean,
  onClose: () => void,
  containerRef?: RefObject<HTMLElement | null>,
) {
  useEffect(() => {
    if (!open) {
      return;
    }

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const previouslyFocused =
      document.activeElement instanceof HTMLElement ? document.activeElement : null;

    const container = containerRef?.current;
    if (container) {
      // Focus the dialog itself (give it tabIndex={-1}) so the first Tab
      // lands on the first control rather than something behind the overlay.
      if (container.tabIndex === -1) {
        container.focus();
      } else {
        container.querySelector<HTMLElement>(FOCUSABLE_SELECTOR)?.focus();
      }
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onClose();
        return;
      }

      if (event.key !== "Tab") {
        return;
      }
      const trap = containerRef?.current;
      if (!trap) {
        return;
      }
      const focusables = Array.from(trap.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR));
      if (focusables.length === 0) {
        event.preventDefault();
        return;
      }
      const first = focusables[0];
      const last = focusables[focusables.length - 1];
      const active = document.activeElement;
      const inside = active instanceof HTMLElement && trap.contains(active);

      if (event.shiftKey) {
        if (!inside || active === first) {
          event.preventDefault();
          last.focus();
        }
      } else if (!inside || active === last) {
        event.preventDefault();
        first.focus();
      }
    };
    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener("keydown", handleKeyDown);
      previouslyFocused?.focus?.();
    };
  }, [open, onClose, containerRef]);
}
